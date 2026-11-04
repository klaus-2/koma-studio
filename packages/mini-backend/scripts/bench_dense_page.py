"""Dense-page stopwatch baseline for the mini-backend batch pipeline.

Dev measurement script (Pass-1 task T2) — NOT benchmarking infrastructure.
It drives one deterministic dense fixture page through ``POST /pipeline/batch``
over HTTP (multipart upload of bytes, mirroring the frontend wire contract),
polls ``GET /pipeline/batch/progress`` at 500 ms to record the observed event
sequence, and parses per-operation ``inference.completed`` durations from the
sidecar's JSON log.

Each invocation records ONE arm (one sidecar process). The release A/B is
produced by running it twice — once against a sidecar with the environment
unset and once against a fresh sidecar with ``KOMA_SKIP_GPU_RELEASE=1`` (the
env is fixed at process start; never reuse a process across arms). The second
invocation merges into the existing artifact when ``--out`` already holds one.
"""

from __future__ import annotations

import argparse
import ctypes
import hashlib
import io
import json
import os
import platform
import random
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Final

from PIL import Image, ImageDraw, ImageFont

FIXTURE_SEED_BASE: Final = 20261104
PAGE_WIDTH: Final = 1600
PAGE_HEIGHT: Final = 2200
TEXT_BLOCK_COUNT: Final = 50
POLL_INTERVAL_SECONDS: Final = 0.5
HTTP_TIMEOUT_SECONDS: Final = 7200.0
SESSION_HEADER: Final = "x-koma-local-session"
SKIP_RELEASE_ENV: Final = "KOMA_SKIP_GPU_RELEASE"
STAGE_NAMES: Final = ("detect", "ocr", "translation", "segment", "clean")
REPO_ROOT: Final = Path(__file__).resolve().parents[3]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base-url", default="http://127.0.0.1:8001")
    parser.add_argument(
        "--log-file",
        required=True,
        type=Path,
        help="Sidecar stdout log (JSON lines) captured for this arm's process.",
    )
    parser.add_argument(
        "--out",
        required=True,
        type=Path,
        help="Baseline artifact JSON path; an existing artifact gains this arm's runs.",
    )
    parser.add_argument("--repetitions", type=int, default=3)
    parser.add_argument(
        "--source-language",
        default="en",
        help="Batch source language (must match an installed OCR model's language).",
    )
    parser.add_argument(
        "--run-translation",
        action="store_true",
        help="Enable the batch translation stage (requires an installed translator).",
    )
    parser.add_argument("--emit-fixture", type=Path, default=None)
    parser.add_argument(
        "--session-secret",
        default="",
        help="Value for the x-koma-local-session header (when the sidecar requires it).",
    )
    parser.add_argument(
        "--skip-release",
        action="store_true",
        help="Mark this arm as the KOMA_SKIP_GPU_RELEASE arm (recording only; "
        "the sidecar process itself must be started with the env set).",
    )
    return parser.parse_args()


# --------------------------------------------------------------------------- #
# Narrow JSON accessors (the repo avoids Any-typed payloads)
# --------------------------------------------------------------------------- #
def as_dict(value: object) -> dict[str, object] | None:
    return value if isinstance(value, dict) else None


def as_list(value: object) -> list[object] | None:
    return value if isinstance(value, list) else None


def as_float(value: object) -> float | None:
    return float(value) if isinstance(value, (int, float)) else None


def as_int(value: object) -> int | None:
    return int(value) if isinstance(value, int) else None


def as_str(value: object) -> str | None:
    return value if isinstance(value, str) else None


# --------------------------------------------------------------------------- #
# HTTP client (stdlib; multipart upload of bytes only — never local paths)
# --------------------------------------------------------------------------- #
class HttpResponse:
    def __init__(self, status: int, headers: dict[str, str], body: bytes) -> None:
        self.status = status
        self.headers = headers
        self.body = body

    def header(self, name: str) -> str:
        return self.headers.get(name.lower(), "")


class HttpClient:
    def __init__(self, base_url: str, session_secret: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.session_secret = session_secret

    def _headers(self, content_type: str | None) -> dict[str, str]:
        headers = {"User-Agent": "koma-bench-dense-page/1"}
        if content_type is not None:
            headers["Content-Type"] = content_type
        if self.session_secret:
            headers[SESSION_HEADER] = self.session_secret
        return headers

    def get(self, path: str) -> HttpResponse:
        request = urllib.request.Request(
            f"{self.base_url}{path}", headers=self._headers(None), method="GET"
        )
        with urllib.request.urlopen(request, timeout=60.0) as response:
            return HttpResponse(
                response.status,
                {key.lower(): value for key, value in response.headers.items()},
                response.read(),
            )

    def get_json(self, path: str) -> object:
        return json.loads(self.get(path).body.decode("utf-8"))

    def post_multipart(
        self,
        path: str,
        *,
        file_field: str,
        file_name: str,
        file_bytes: bytes,
        fields: dict[str, str] | None = None,
    ) -> HttpResponse:
        boundary = "koma-bench-dense-page-boundary"
        chunks: list[bytes] = []
        for name, value in (fields or {}).items():
            chunks.append(
                (
                    f"--{boundary}\r\n"
                    f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
                    f"{value}\r\n"
                ).encode("utf-8")
            )
        chunks.append(
            (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{file_field}"; '
                f'filename="{file_name}"\r\n'
                f"Content-Type: image/png\r\n\r\n"
            ).encode("utf-8")
        )
        chunks.append(file_bytes)
        chunks.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=b"".join(chunks),
            headers=self._headers(f"multipart/form-data; boundary={boundary}"),
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            return HttpResponse(
                response.status,
                {key.lower(): value for key, value in response.headers.items()},
                response.read(),
            )


def execution_fallback_headers(response: HttpResponse) -> dict[str, str]:
    return {
        name: value for name, value in response.headers.items() if name.startswith("x-koma-execution-")
    }


# --------------------------------------------------------------------------- #
# Deterministic dense fixture (seeded; glyph fidelity irrelevant, region count is)
# --------------------------------------------------------------------------- #
def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in ("arial.ttf", "segoeui.ttf", "calibri.ttf"):
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def build_fixture_png(seed: int, *, emit_path: Path | None) -> bytes:
    rng = random.Random(seed)
    image = Image.new("RGB", (PAGE_WIDTH, PAGE_HEIGHT), (246, 243, 236))
    draw = ImageDraw.Draw(image)
    columns, rows = 5, 10
    cell_w, cell_h = PAGE_WIDTH // columns, PAGE_HEIGHT // rows
    alphabet = "ABCDEFGHKMNPRSTUVWXYZ0123456789"
    for block_index in range(TEXT_BLOCK_COUNT):
        col, row = block_index % columns, block_index // columns
        box_w = cell_w - 48 - rng.randint(0, 24)
        box_h = cell_h - 52 - rng.randint(0, 20)
        x0 = col * cell_w + 24 + rng.randint(0, 12)
        y0 = row * cell_h + 20 + rng.randint(0, 10)
        draw.rectangle((x0, y0, x0 + box_w, y0 + box_h), outline=(20, 20, 20), width=3)
        font = load_font(20)
        for line_index in range(2 + rng.randint(0, 2)):
            words = [
                "".join(rng.choice(alphabet) for _ in range(rng.randint(2, 7)))
                for _ in range(4)
            ]
            draw.text(
                (x0 + 8, y0 + 8 + line_index * 28),
                " ".join(words),
                fill=(15, 15, 15),
                font=font,
            )
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    if emit_path is not None:
        emit_path.parent.mkdir(parents=True, exist_ok=True)
        emit_path.write_bytes(buffer.getvalue())
    return buffer.getvalue()


# --------------------------------------------------------------------------- #
# Sidecar JSON log parsing (F10: "inference.completed" carries duration_seconds)
# --------------------------------------------------------------------------- #
_TS_FORMATS: Final = ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S")


def parse_log_ts(raw: object) -> float | None:
    text = as_str(raw)
    if text is None:
        return None
    for fmt in _TS_FORMATS:
        try:
            return datetime.strptime(text, fmt).timestamp()
        except ValueError:
            continue
    return None


class LogLine:
    def __init__(self, epoch: float, message: str, fields: dict[str, object]) -> None:
        self.epoch = epoch
        self.message = message
        self.fields = fields


def read_log_lines(log_path: Path) -> list[LogLine]:
    lines: list[LogLine] = []
    for raw_line in log_path.read_text(encoding="utf-8", errors="replace").splitlines():
        stripped = raw_line.strip()
        if not stripped.startswith("{"):
            continue
        try:
            payload = as_dict(json.loads(stripped))
        except json.JSONDecodeError:
            continue
        if payload is None:
            continue
        epoch = parse_log_ts(payload.get("ts"))
        message = as_str(payload.get("msg"))
        if epoch is None or message is None:
            continue
        lines.append(LogLine(epoch, message, payload))
    return lines


def durations_in_window(
    log_lines: list[LogLine], start_epoch: float, end_epoch: float
) -> list[tuple[float, float, str]]:
    matched: list[tuple[float, float, str]] = []
    for line in log_lines:
        if line.message != "inference.completed":
            continue
        if not start_epoch <= line.epoch <= end_epoch:
            continue
        duration = as_float(line.fields.get("duration_seconds"))
        if duration is None:
            continue
        matched.append((line.epoch, duration, json.dumps(line.fields, ensure_ascii=False)))
    return matched


def oom_log_lines_in_window(
    log_lines: list[LogLine], start_epoch: float, end_epoch: float
) -> list[str]:
    return [
        json.dumps(line.fields, ensure_ascii=False)
        for line in log_lines
        if start_epoch <= line.epoch <= end_epoch
        and line.message in {"batch.gpu_oom_fallback", "execution.gpu_oom_fallback"}
    ]


def attribute_to_stages(
    stage_windows: list[tuple[str, float, float]],
    durations: list[tuple[float, float, str]],
) -> dict[str, list[tuple[float, float, str]]]:
    attributed: dict[str, list[tuple[float, float, str]]] = {
        stage: [] for stage, _, _ in stage_windows
    }
    for epoch, duration, raw in durations:
        home: str | None = None
        for stage, window_start, window_end in stage_windows:
            if window_start <= epoch <= window_end:
                home = stage
                break
        if home is None:
            home = "unattributed"
        attributed.setdefault(home, []).append((epoch, duration, raw))
    return attributed


# --------------------------------------------------------------------------- #
# Progress polling (500 ms; D9 adjudication input)
# --------------------------------------------------------------------------- #
class ProgressPoller:
    """Observes snapshot transitions of GET /pipeline/batch/progress."""

    def __init__(self, client: HttpClient, batch_id: str) -> None:
        self._client = client
        self._batch_id = batch_id
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._start_perf: float = 0.0
        self.events: list[dict[str, object]] = []
        self.hops: list[tuple[float, str]] = []
        self.final_snapshot: dict[str, object] | None = None
        self.poll_gaps: int = 0

    def start(self) -> None:
        self._start_perf = time.perf_counter()
        self._thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=5.0)

    def _record(self, t_ms: int, event: str, detail: dict[str, object]) -> None:
        entry: dict[str, object] = {"t_ms": t_ms, "event": event}
        entry.update(detail)
        self.events.append(entry)

    def _poll_loop(self) -> None:
        previous: dict[str, object] | None = None
        while not self._stop.is_set():
            try:
                snapshot = as_dict(
                    self._client.get_json(
                        f"/pipeline/batch/progress?batch_id={self._batch_id}"
                    )
                )
            except (urllib.error.URLError, OSError):
                self.poll_gaps += 1
                snapshot = None
            if snapshot is not None:
                t_ms = int((time.perf_counter() - self._start_perf) * 1000)
                self._absorb(snapshot, t_ms, previous)
                previous = snapshot
                self.final_snapshot = snapshot
                if snapshot.get("finished") is True or snapshot.get("cancelled") is True:
                    return
            self._stop.wait(POLL_INTERVAL_SECONDS)

    def _absorb(
        self, snapshot: dict[str, object], t_ms: int, previous: dict[str, object] | None
    ) -> None:
        stage = as_str(snapshot.get("currentStage"))
        if previous is None:
            self._record(t_ms, "item_started", {"index": snapshot.get("currentIndex")})
            if stage is not None:
                self._record(t_ms, "item_stage", {"stage": stage})
                self.hops.append((time.time(), stage))
            return
        previous_stage = as_str(previous.get("currentStage"))
        if stage is not None and stage != previous_stage:
            self._record(t_ms, "item_stage", {"stage": stage})
            self.hops.append((time.time(), stage))
        previous_completed = as_int(previous.get("completed")) or 0
        completed = as_int(snapshot.get("completed")) or 0
        if completed > previous_completed:
            self._record(t_ms, "item_finished", {"completed": completed})
        if previous.get("finished") is not True and snapshot.get("finished") is True:
            self._record(t_ms, "finish", {})
        if previous.get("cancelled") is not True and snapshot.get("cancelled") is True:
            self._record(t_ms, "cancel", {})


# --------------------------------------------------------------------------- #
# Batch run
# --------------------------------------------------------------------------- #
def extract_report(response: HttpResponse) -> dict[str, object] | None:
    if "zip" in response.header("content-type"):
        with zipfile.ZipFile(io.BytesIO(response.body)) as archive:
            raw = archive.read("batch_report.json")
        return as_dict(json.loads(raw.decode("utf-8")))
    return as_dict(json.loads(response.body.decode("utf-8")))


def report_summary(report: dict[str, object]) -> dict[str, object]:
    results = as_list(report.get("results"))
    first = as_dict(results[0]) if results else None
    stages_info: dict[str, object] = {}
    oom_stages: list[str] = []
    for stage in STAGE_NAMES:
        payload = as_dict((first or {}).get(stage))
        if payload is None:
            continue
        stages_info[stage] = {
            "regions_count": payload.get("regions_count"),
            "model_used": payload.get("model_used"),
            "fell_back_to_cpu": payload.get("fell_back_to_cpu"),
            "fallback_reason": payload.get("fallback_reason"),
        }
        if payload.get("fallback_reason") == "gpu_oom_to_cpu":
            oom_stages.append(stage)
    errors: list[dict[str, object]] = []
    raw_errors = as_list((first or {}).get("errors"))
    for error in raw_errors or []:
        entry = as_dict(error)
        if entry is not None:
            errors.append({"stage": entry.get("stage"), "message": entry.get("message")})
    return {
        "status": (first or {}).get("status"),
        "succeeded": report.get("succeeded"),
        "partial": report.get("partial"),
        "failed": report.get("failed"),
        "effective_concurrency": report.get("effective_concurrency"),
        "stages": stages_info,
        "errors": errors,
        "oom_fallback_stages": oom_stages,
    }


def build_stage_windows(
    hops: list[tuple[float, str]], run_end_epoch: float
) -> tuple[list[tuple[str, float, float]], dict[str, float]]:
    windows: list[tuple[str, float, float]] = []
    for index, (hop_epoch, stage) in enumerate(hops):
        window_end = hops[index + 1][0] if index + 1 < len(hops) else run_end_epoch
        windows.append((stage, hop_epoch, window_end))
    spans = {
        stage: round(window_end - window_start, 3)
        for stage, window_start, window_end in windows
    }
    return windows, spans


def run_batch_once(
    client: HttpClient,
    *,
    run_id: str,
    skip_release: bool,
    fixture_png: bytes,
    log_path: Path,
    source_language: str,
    run_translation: bool,
) -> dict[str, object]:
    batch_id = f"bench-{run_id}".replace("_", "-")
    poller = ProgressPoller(client, batch_id)
    run_start_epoch = time.time()
    poller.start()
    try:
        started_at = time.perf_counter()
        response = client.post_multipart(
            "/pipeline/batch",
            file_field="files",
            file_name=f"{run_id}.png",
            file_bytes=fixture_png,
            fields={
                "source_language": source_language,
                "target_language": "ptBR",
                "run_detect": "true",
                "run_ocr": "true",
                "run_translation": "true" if run_translation else "false",
                "run_segment": "true",
                "run_clean": "true",
                "concurrency": "1",
                "batch_id": batch_id,
            },
        )
        wall_clock = time.perf_counter() - started_at
    finally:
        poller.stop()
    run_end_epoch = time.time()
    if response.status != 200:
        raise RuntimeError(
            f"POST /pipeline/batch returned {response.status}: "
            f"{response.body[:500].decode('utf-8', errors='replace')}"
        )
    report = extract_report(response)
    summary = report_summary(report) if report is not None else {}

    windows, observed_spans = build_stage_windows(poller.hops, run_end_epoch)
    # Re-read the log: the runs appended their inference.completed lines after
    # the startup snapshot taken in main().
    attributed = attribute_to_stages(
        windows,
        durations_in_window(read_log_lines(log_path), run_start_epoch, run_end_epoch),
    )
    per_stage: list[dict[str, object]] = []
    for stage in STAGE_NAMES:
        matches = attributed.get(stage, [])
        per_stage.append(
            {
                "stage": stage,
                "duration_seconds": [round(duration, 4) for _, duration, _ in matches],
                "observed_span_s": observed_spans.get(stage),
                "raw_log_lines": [raw for _, _, raw in matches],
            }
        )
    unattributed = attributed.get("unattributed", [])
    if unattributed:
        per_stage.append(
            {
                "stage": "unattributed",
                "duration_seconds": [round(duration, 4) for _, duration, _ in unattributed],
                "observed_span_s": None,
                "raw_log_lines": [raw for _, _, raw in unattributed],
            }
        )

    run: dict[str, object] = {
        "run_id": run_id,
        "skip_release": skip_release,
        "wall_clock_s": round(wall_clock, 3),
        "fixture_sha256": hashlib.sha256(fixture_png).hexdigest(),
        "per_stage": per_stage,
        "report_summary": summary,
        "batch_fallback_headers": execution_fallback_headers(response),
        "oom_log_lines": oom_log_lines_in_window(
            read_log_lines(log_path), run_start_epoch, run_end_epoch
        ),
        "progress_poll_gaps": poller.poll_gaps,
        "progress_events": poller.events,
        "progress_final": poller.final_snapshot,
    }
    return run


# --------------------------------------------------------------------------- #
# Machine / tree / artifact
# --------------------------------------------------------------------------- #
def total_ram_gb() -> float | None:
    try:
        class MemoryStatusEx(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        stat = MemoryStatusEx()
        stat.dwLength = ctypes.sizeof(MemoryStatusEx)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
            return round(stat.ullTotalPhys / (1024**3), 1)
    except (OSError, AttributeError):
        return None
    return None


def machine_info(client: HttpClient) -> dict[str, object]:
    try:
        device = as_dict(client.get_json("/device/info")) or {}
        gpu_name: object = device.get("name")
    except (urllib.error.URLError, OSError):
        gpu_name = None
    return {
        "os": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "cpu": platform.processor() or platform.machine(),
        "gpu": gpu_name,
        "ram_gb": total_ram_gb(),
    }


def tree_info() -> dict[str, object]:
    sha = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=REPO_ROOT, capture_output=True, text=True, check=True
    ).stdout.strip()
    dirty = subprocess.run(
        ["git", "status", "--porcelain"], cwd=REPO_ROOT, capture_output=True, text=True, check=True
    ).stdout.splitlines()
    return {"git_sha": sha, "dirty_paths_count": len(dirty)}


def baseline_gaps() -> list[dict[str, object]]:
    return [
        {
            "per_stage_ocr_translation_durations": "not-logged",
            "reason": (
                "OCR engines and translators do not route through "
                "models/execution.run_inference, so no inference.completed "
                "duration line exists for them; observed_span_s (progress-poll "
                "hop deltas) is the recorded proxy. No instrumentation was added."
            ),
        },
        {
            "encoder_decoder_split": "not-measured",
            "reason": (
                "No encoder/decoder timing lines exist in the shipped logs "
                "(transformers_vlm emits vlm_runtime_loaded only; the CT2 "
                "translator emits translation.gguf.loading only). Splitting them "
                "is a Pass-2 decision and no instrumentation was added."
            ),
        },
        {
            "progress_event_granularity": "500ms-poll",
            "reason": (
                "The progress registry exposes snapshots only; the event sequence "
                "is reconstructed from 500 ms polls, so hop boundaries carry up to "
                "about 500 ms of observation lag. This is the D9 question: are "
                "stage hops missed or illegible at the frontend's poll rate?"
            ),
        },
        {
            "translation_stage": "disabled",
            "reason": (
                "No translation model is installed in this machine's active "
                "app-data dir (com.komastudio.desktop/models), so the batch ran "
                "detect/ocr/segment/clean only; the translation stage would "
                "fail and poison the run status."
            ),
        },
        {
            "oneshot_ocr_benchmark": "skipped-user-directed",
            "reason": (
                "The one-shot whole-image OCR engine (glm_ocr_onnx) is a "
                "GLM/VLM-family model too heavy for this machine (GTX 1050 Ti) "
                "— running it was explicitly excluded by the user on "
                "2026-11-04. D1's one-shot engine comparison needs a capable "
                "machine or a lighter one-shot engine; no other model was "
                "substituted for it."
            ),
        },
    ]


def fixture_signature(artifact: dict[str, object]) -> dict[str, object]:
    signature = as_dict(artifact.get("fixture"))
    if signature is None:
        raise SystemExit("Existing artifact is missing the fixture signature.")
    return signature


def main() -> int:
    args = parse_args()
    if args.repetitions < 1:
        raise SystemExit("--repetitions must be >= 1")
    env_skip_release = os.environ.get(SKIP_RELEASE_ENV, "").strip().lower() in {"1", "true", "yes"}
    if args.skip_release != env_skip_release:
        print(
            f"note: --skip-release={args.skip_release} but {SKIP_RELEASE_ENV} resolves to "
            f"{env_skip_release}; recording the flag value.",
            file=sys.stderr,
        )

    client = HttpClient(args.base_url, args.session_secret)
    health = client.get("/health")
    if health.status != 200:
        raise SystemExit(f"Sidecar /health returned {health.status}; start the sidecar first.")

    log_path = args.log_file
    if not log_path.is_file():
        raise SystemExit(f"Log file not found: {log_path}")

    out_path = args.out
    existing: dict[str, object] | None = None
    if out_path.is_file():
        loaded = as_dict(json.loads(out_path.read_text(encoding="utf-8")))
        if loaded is None:
            raise SystemExit(f"Existing artifact at {out_path} is not a JSON object.")
        existing = loaded

    runs: list[dict[str, object]] = []
    for run_index in range(1 + args.repetitions):  # warmup + repetitions
        is_warmup = run_index == 0
        run_id = (
            "warmup"
            if is_warmup
            else (f"skip-release-r{run_index}" if args.skip_release else f"baseline-r{run_index}")
        )
        fixture_png = build_fixture_png(
            FIXTURE_SEED_BASE + run_index,
            emit_path=args.emit_fixture if (is_warmup and args.emit_fixture is not None) else None,
        )
        print(f"[{run_id}] running batch...", flush=True)
        run = run_batch_once(
            client,
            run_id=run_id,
            skip_release=args.skip_release,
            fixture_png=fixture_png,
            log_path=log_path,
            source_language=args.source_language,
            run_translation=args.run_translation,
        )
        runs.append(run)
        summary = as_dict(run.get("report_summary")) or {}
        oom_stages = as_list(summary.get("oom_fallback_stages")) or []
        print(
            f"[{run_id}] wall_clock_s={run.get('wall_clock_s')} "
            f"status={summary.get('status')} oom_stages={oom_stages}",
            flush=True,
        )
        if oom_stages:
            print(
                f"[{run_id}] GPU OOM fallback observed — stopping this arm's "
                "remaining repetitions (first-class finding).",
                flush=True,
            )
            break

    artifact: dict[str, object] = existing if existing is not None else {
        "machine": machine_info(client),
        "tree": tree_info(),
        "fixture": {"size_px": [PAGE_WIDTH, PAGE_HEIGHT], "text_regions": TEXT_BLOCK_COUNT},
        "sidecar": {
            "base_url": client.base_url,
            "log_file": str(log_path),
            "session_header_sent": bool(client.session_secret),
            "skip_release_env_at_script": env_skip_release,
        },
        "gaps": baseline_gaps(),
    }
    if existing is not None and fixture_signature(existing) != {
        "size_px": [PAGE_WIDTH, PAGE_HEIGHT],
        "text_regions": TEXT_BLOCK_COUNT,
    }:
        raise SystemExit("Refusing to merge: existing artifact fixture signature differs.")
    artifact["runs"] = (as_list(artifact.get("runs")) or []) + runs
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    print(f"artifact written: {out_path} ({len(as_list(artifact.get('runs')) or [])} runs)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
