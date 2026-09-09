from __future__ import annotations

import contextvars
import hashlib
import json
import logging
import random
import socket
import time
from pathlib import Path
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


_HF_API_ROOT = "https://huggingface.co/api/models"
_HF_RESOLVE_ROOT = "https://huggingface.co"
_USER_AGENT = "koma-studio-mini-backend/1.0"
_RETRYABLE_HTTP_STATUS = {408, 425, 429, 500, 502, 503, 504}
_CHUNK_SIZE = 1024 * 1024  # 1 MB
_READ_TIMEOUT = 60  # per-chunk read timeout in seconds
_CONNECT_TIMEOUT = 30  # connection timeout in seconds
_MAX_RETRY_AFTER_SLEEP = 120.0  # cap on server-provided Retry-After seconds

logger = logging.getLogger(__name__)


class DownloadCancelled(Exception):
    """Raised when the owning download job requests cancellation."""


class RateLimitedError(RuntimeError):
    """Remote server answered HTTP 429 and retries were exhausted."""

    def __init__(self, message: str, http_status: int = 429) -> None:
        super().__init__(message)
        self.http_status = http_status


class ChecksumMismatchError(RuntimeError):
    """Downloaded file does not match the expected SHA-256."""

    def __init__(self, message: str, *, expected: str, got: str) -> None:
        super().__init__(message)
        self.expected = expected
        self.got = got


class DownloadProgressBridge(Protocol):
    """Progress/cancellation channel between the job and hf_download.

    Intentionally a duck-typed Protocol: the implementation lives in
    core.download_jobs so this layer doesn't know about jobs (no import
    cycle) and the storages (models/*/storage.py) don't need to receive
    callbacks — the sink travels in a ContextVar set by the worker thread.
    """

    def report_download(self, file_key: str, delta_bytes: int, file_total: int | None) -> None:
        ...

    def report_phase(self, phase: str) -> None:
        ...

    def raise_if_cancelled(self) -> None:
        ...


progress_bridge_var: contextvars.ContextVar[DownloadProgressBridge | None] = (
    contextvars.ContextVar("hf_download_progress_bridge", default=None)
)


def _active_bridge() -> DownloadProgressBridge | None:
    return progress_bridge_var.get()


def _normalize_sha(value: str | None) -> str | None:
    if not value:
        return None

    normalized = value.strip().lower()
    if normalized.startswith("sha256:"):
        normalized = normalized.split(":", 1)[1]
    if len(normalized) != 64:
        return None
    if not all(ch in "0123456789abcdef" for ch in normalized):
        return None
    return normalized


def _build_hf_resolve_url(repo: str, revision: str, target: str) -> str:
    return f"{_HF_RESOLVE_ROOT}/{repo}/resolve/{revision}/{target}"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def fetch_hf_siblings(repo: str, revision: str = "main") -> list[dict[str, Any]]:
    api_url = f"{_HF_API_ROOT}/{repo}/revision/{revision}"
    request = Request(
        api_url,
        headers={
            "User-Agent": _USER_AGENT,
            "Accept": "application/json",
        },
    )

    try:
        with urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError) as exc:
        raise RuntimeError(
            f"Failed to query the HuggingFace API for '{repo}': {exc}"
        ) from exc
    except Exception as exc:
        raise RuntimeError(
            f"Failed to parse the HuggingFace API response for '{repo}': {exc}"
        ) from exc

    siblings = payload.get("siblings", [])
    if not isinstance(siblings, list):
        raise RuntimeError(f"Invalid HuggingFace API response for '{repo}'.")
    return [item for item in siblings if isinstance(item, dict)]


def _probe_hf_resolve_url(url: str) -> bool:
    head_request = Request(
        url,
        method="HEAD",
        headers={
            "User-Agent": _USER_AGENT,
        },
    )
    try:
        with urlopen(head_request, timeout=30):
            return True
    except HTTPError as exc:
        # Some hosts block HEAD, so we fall back to a lightweight GET below.
        if exc.code not in {405, 501}:
            return False
    except URLError:
        return False
    except Exception:
        return False

    get_request = Request(
        url,
        headers={
            "User-Agent": _USER_AGENT,
            "Range": "bytes=0-0",
        },
    )
    try:
        with urlopen(get_request, timeout=30):
            return True
    except (HTTPError, URLError):
        return False
    except Exception:
        return False


def resolve_hf_file(
    repo: str, candidate_paths: list[str], revision: str = "main"
) -> tuple[str, str, str]:
    api_error: RuntimeError | None = None
    siblings: list[dict[str, Any]] = []
    try:
        siblings = fetch_hf_siblings(repo=repo, revision=revision)
    except RuntimeError as exc:
        api_error = exc

    if siblings:
        by_path: dict[str, dict[str, Any]] = {}
        by_path_lower: dict[str, dict[str, Any]] = {}
        for sibling in siblings:
            raw_name = sibling.get("rfilename")
            if not isinstance(raw_name, str):
                continue
            normalized_name = raw_name.strip()
            if not normalized_name:
                continue
            by_path[normalized_name] = sibling
            by_path_lower[normalized_name.lower()] = sibling

        for candidate in candidate_paths:
            target = candidate.strip()
            if not target:
                continue
            sibling = by_path.get(target)
            if sibling is None:
                sibling = by_path_lower.get(target.lower())
            if sibling is None:
                continue

            resolved_target = str(sibling.get("rfilename") or "").strip() or target

            lfs = sibling.get("lfs")
            sha = None
            if isinstance(lfs, dict):
                sha = _normalize_sha(lfs.get("sha256")) or _normalize_sha(
                    lfs.get("oid")
                )

            if not sha:
                # Some small files are not stored in LFS. In those cases we
                # accept no remote checksum and validate local integrity only.
                sha = ""

            url = _build_hf_resolve_url(
                repo=repo,
                revision=revision,
                target=resolved_target,
            )
            return resolved_target, sha, url

    # Fallback: same approach as the reference project (direct per-file URL).
    for candidate in candidate_paths:
        target = candidate.strip()
        if not target:
            continue
        url = _build_hf_resolve_url(repo=repo, revision=revision, target=target)
        if _probe_hf_resolve_url(url):
            return target, "", url

    tried = ", ".join(candidate_paths)
    if api_error:
        raise RuntimeError(
            f"{api_error} No accessible file in repo '{repo}' for candidates: {tried}",
        ) from api_error
    raise RuntimeError(
        f"No file found in repo '{repo}' for candidates: {tried}"
    )


def _sleep_before_retry(attempt: int, delay_override: float | None = None) -> None:
    if delay_override is None:
        base_delay = min(4.0, 0.5 * (2 ** max(0, attempt - 1)))
        jitter = random.uniform(0.0, 0.35)
        delay_override = base_delay + jitter

    bridge = _active_bridge()
    deadline = time.monotonic() + delay_override
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return
        if bridge is not None:
            bridge.raise_if_cancelled()
        time.sleep(min(0.25, remaining))


def _retry_delay_for(exc: Exception, attempt: int) -> float:
    """Exponential backoff with jitter, honoring Retry-After when present."""
    delay = min(4.0, 0.5 * (2 ** max(0, attempt - 1))) + random.uniform(0.0, 0.35)
    headers = getattr(exc, "headers", None)
    raw_retry_after = headers.get("Retry-After") if headers is not None else None
    if raw_retry_after:
        try:
            server_delay = float(str(raw_retry_after).strip())
        except (TypeError, ValueError):
            return delay
        if server_delay > 0:
            delay = max(delay, min(server_delay, _MAX_RETRY_AFTER_SLEEP))
    return delay


def _is_retryable_error(exc: Exception) -> bool:
    if isinstance(exc, HTTPError):
        return exc.code in _RETRYABLE_HTTP_STATUS
    return isinstance(
        exc, (URLError, socket.timeout, TimeoutError, ConnectionError, OSError)
    )


def _get_content_length(url: str) -> int | None:
    """Try to get the total file size via HEAD request."""
    head_request = Request(url, method="HEAD", headers={"User-Agent": _USER_AGENT})
    try:
        with urlopen(head_request, timeout=_CONNECT_TIMEOUT) as resp:
            cl = resp.headers.get("Content-Length")
            return int(cl) if cl else None
    except Exception:
        return None


def download_file(url: str, target_path: Path, max_retries: int = 5) -> None:
    """Download a file with resume support and per-chunk read timeout.

    For large files (multi-GB GGUF models), the download resumes from where it
    left off on each retry instead of starting over. A per-read socket timeout
    prevents the connection from stalling indefinitely.
    """
    temp_path = target_path.with_suffix(target_path.suffix + ".part")
    target_path.parent.mkdir(parents=True, exist_ok=True)

    bridge = _active_bridge()
    if bridge is not None:
        bridge.report_phase("downloading")

    total_size = _get_content_length(url)
    attempts = max(1, int(max_retries))

    for attempt in range(1, attempts + 1):
        # Check how much we already have from a previous partial download
        existing_bytes = 0
        if temp_path.exists():
            existing_bytes = temp_path.stat().st_size
            # If we know the total and we already have it all, just finalize
            if total_size and existing_bytes >= total_size:
                temp_path.replace(target_path)
                return

        if bridge is not None:
            bridge.raise_if_cancelled()
            bridge.report_download(url, 0, total_size)

        headers: dict[str, str] = {"User-Agent": _USER_AGENT}
        if existing_bytes > 0:
            headers["Range"] = f"bytes={existing_bytes}-"
            logger.info(
                "Resuming download from %d bytes (attempt %d/%d): %s",
                existing_bytes,
                attempt,
                attempts,
                url,
            )

        request = Request(url, headers=headers)
        try:
            with urlopen(request, timeout=_CONNECT_TIMEOUT) as response:
                status_code = response.status
                if existing_bytes > 0 and status_code == 200:
                    # Server ignored Range header — restart from scratch
                    existing_bytes = 0
                    mode = "wb"
                elif status_code == 206:
                    mode = "ab"
                else:
                    mode = "wb"
                    existing_bytes = 0

                # Set socket-level read timeout to prevent stalls
                raw_sock = response.fp
                if hasattr(raw_sock, "raw"):
                    raw_sock = raw_sock.raw
                if hasattr(raw_sock, "_sock"):
                    try:
                        raw_sock._sock.settimeout(_READ_TIMEOUT)
                    except Exception:
                        pass

                with temp_path.open(mode) as handle:
                    bytes_this_session = 0
                    last_progress_time = time.monotonic()
                    while True:
                        if bridge is not None:
                            bridge.raise_if_cancelled()
                        chunk = response.read(_CHUNK_SIZE)
                        if not chunk:
                            break
                        handle.write(chunk)
                        bytes_this_session += len(chunk)
                        last_progress_time = time.monotonic()
                        if bridge is not None:
                            bridge.report_download(url, len(chunk), total_size)

            # Download complete
            temp_path.replace(target_path)
            return

        except DownloadCancelled:
            # Keep the .part so a future job resumes from the same byte.
            raise

        except Exception as exc:
            is_last_attempt = attempt >= attempts

            # Keep partial file for resume on retryable errors — even on the
            # last attempt, so a later job/session can pick up from here.
            if _is_retryable_error(exc) and not is_last_attempt:
                delay = _retry_delay_for(exc, attempt)
                logger.warning(
                    "Download attempt %d/%d failed (will resume in %.1fs): %s",
                    attempt,
                    attempts,
                    delay,
                    exc,
                )
                retry_bridge = _active_bridge()
                if retry_bridge is not None:
                    # Leave "verifying" (multi-file) and signal the wait.
                    retry_bridge.report_phase("downloading")
                _sleep_before_retry(attempt, delay)
                continue

            if not _is_retryable_error(exc):
                # Non-retryable failures (e.g., HTTP 404) leave junk partials.
                temp_path.unlink(missing_ok=True)
            if isinstance(exc, HTTPError) and exc.code == 429:
                raise RateLimitedError(
                    f"Rate limited by remote server (HTTP 429): {url}"
                ) from exc
            if isinstance(exc, (HTTPError, URLError)):
                raise RuntimeError(f"Failed to download file: {exc}") from exc
            raise RuntimeError(f"Failed to save downloaded file: {exc}") from exc


def ensure_file_from_hf(
    *,
    repo: str,
    candidate_paths: list[str],
    target_path: Path,
    revision: str = "main",
    expected_sha256: str | None = None,
) -> dict[str, Any]:
    configured_sha = _normalize_sha(expected_sha256)
    if expected_sha256 and not configured_sha:
        raise RuntimeError(
            f"Invalid SHA256 checksum configured for '{repo}': {expected_sha256}"
        )

    selected_path, resolved_sha, download_url = resolve_hf_file(
        repo=repo,
        candidate_paths=candidate_paths,
        revision=revision,
    )
    expected_sha = configured_sha or resolved_sha

    if target_path.exists():
        if expected_sha:
            current_sha = sha256_file(target_path)
            if current_sha.lower() == expected_sha.lower():
                return {
                    "path": selected_path,
                    "sha256": current_sha,
                    "downloadUrl": download_url,
                    "downloaded": False,
                }
            target_path.unlink(missing_ok=True)
        else:
            # No remote/configured SHA: assume the local file is already valid.
            return {
                "path": selected_path,
                "sha256": sha256_file(target_path),
                "downloadUrl": download_url,
                "downloaded": False,
            }

    download_file(download_url, target_path)
    bridge = _active_bridge()
    if bridge is not None:
        bridge.report_phase("verifying")
        bridge.raise_if_cancelled()
    current_sha = sha256_file(target_path)
    if expected_sha and current_sha.lower() != expected_sha.lower():
        target_path.unlink(missing_ok=True)
        raise ChecksumMismatchError(
            f"Invalid SHA256 checksum for '{selected_path}'. Expected: {expected_sha} | Got: {current_sha}",
            expected=expected_sha,
            got=current_sha,
        )

    return {
        "path": selected_path,
        "sha256": current_sha,
        "downloadUrl": download_url,
        "downloaded": True,
    }


def ensure_files_from_hf(
    *,
    repo: str,
    files: list[str],
    target_dir: Path,
    revision: str = "main",
) -> list[dict[str, Any]]:
    target_dir.mkdir(parents=True, exist_ok=True)
    payloads: list[dict[str, Any]] = []
    for relative_path in [str(item).strip() for item in files if str(item).strip()]:
        target_path = target_dir / relative_path
        payload = ensure_file_from_hf(
            repo=repo,
            candidate_paths=[relative_path],
            target_path=target_path,
            revision=revision,
        )
        payloads.append(
            {
                "target": relative_path,
                "source": payload["path"],
                "sha256": payload["sha256"],
                "downloaded": payload["downloaded"],
            }
        )
    return payloads
