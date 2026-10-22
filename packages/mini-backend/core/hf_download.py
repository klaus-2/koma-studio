"""HuggingFace file resolution and resumable downloads.

Synchronous on purpose: every caller runs on the download worker thread
(core.download_jobs), never on the event loop.
"""

from __future__ import annotations

import contextvars
import errno
import hashlib
import json
import logging
import random
import time
from collections.abc import Sequence
from http.client import HTTPException, HTTPResponse
from pathlib import Path
from typing import Literal, Protocol, cast
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

_HF_API_ROOT = "https://huggingface.co/api/models"
_HF_RESOLVE_ROOT = "https://huggingface.co"
_USER_AGENT = "koma-studio-mini-backend/1.0"
_RETRYABLE_HTTP_STATUS = frozenset({408, 425, 429, 500, 502, 503, 504})
_CHUNK_SIZE = 1024 * 1024
# urlopen installs this timeout on the socket itself, so it bounds the connect
# AND every subsequent read — a stalled transfer fails instead of hanging.
_SOCKET_TIMEOUT_SECONDS = 60.0
_MAX_BACKOFF_SECONDS = 4.0
_MAX_RETRY_AFTER_SECONDS = 120.0
_CANCEL_POLL_SECONDS = 0.25

# Backoff jitter only; not security-sensitive.
_jitter = random.Random()  # noqa: S311

logger = logging.getLogger(__name__)

type DownloadPhase = Literal["downloading", "verifying"]


# --------------------------------------------------------------------- errors


class HFDownloadError(RuntimeError):
    """Base for every failure raised by this module."""


class HFResolveError(HFDownloadError):
    """The HuggingFace API/probe could not locate the requested file."""


class NetworkDownloadError(HFDownloadError):
    """Transport failed after retries were exhausted."""


class DiskWriteError(HFDownloadError):
    """The local filesystem rejected the download (ENOSPC, permissions...)."""

    def __init__(self, message: str, *, os_errno: int | None) -> None:
        super().__init__(message)
        self.os_errno = os_errno


class RateLimitedError(HFDownloadError):
    """Remote server answered HTTP 429 and retries were exhausted."""

    def __init__(self, message: str, http_status: int = 429) -> None:
        super().__init__(message)
        self.http_status = http_status


class ChecksumMismatchError(HFDownloadError):
    """Downloaded file does not match the expected SHA-256."""

    def __init__(self, message: str, *, expected: str, got: str) -> None:
        super().__init__(message)
        self.expected = expected
        self.got = got

class DownloadCancelled(Exception):  # noqa: N818 - established wire/API name
    """Raised when the owning download job requests cancellation."""


# ----------------------------------------------------------- progress bridge


class DownloadProgressBridge(Protocol):
    """Progress/cancellation channel between the job and this module.

    Duck-typed so core.download_jobs implements it without an import cycle;
    the active bridge travels in a ContextVar set by the worker thread.
    """

    def report_download(self, file_key: str, delta_bytes: int) -> None:
        """``delta_bytes`` may be negative when a resume is discarded."""
        ...

    def declare_total(self, total_bytes: int) -> None:
        """Declare the whole bundle size before the first byte is transferred.

        The declared total is authoritative and immutable: it makes the
        percentage monotonic across a multi-asset install and it is the only
        denominator the UI ever needs.
        """
        ...

    def report_phase(self, phase: DownloadPhase) -> None: ...

    def raise_if_cancelled(self) -> None: ...


progress_bridge_var: contextvars.ContextVar[DownloadProgressBridge | None] = (
    contextvars.ContextVar("hf_download_progress_bridge", default=None)
)


def _active_bridge() -> DownloadProgressBridge | None:
    return progress_bridge_var.get()


# ------------------------------------------------------------------- helpers


def _open(request: Request) -> HTTPResponse:
    # Every URL here is assembled from the fixed https HuggingFace host with
    # quoted path segments, so the scheme check Bandit wants (S310) holds by
    # construction. The cast pins typeshed's `Any` return to the real type.
    return cast(
        HTTPResponse, urlopen(request, timeout=_SOCKET_TIMEOUT_SECONDS)  # noqa: S310
    )


def _normalize_sha(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().lower().removeprefix("sha256:")
    if len(normalized) != 64 or any(ch not in "0123456789abcdef" for ch in normalized):
        return None
    return normalized


def _build_hf_resolve_url(repo: str, revision: str, target: str) -> str:
    return (
        f"{_HF_RESOLVE_ROOT}/{quote(repo, safe='/')}/resolve/"
        f"{quote(revision, safe='')}/{quote(target, safe='/')}"
    )


def sha256_file(path: Path) -> str:
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def fetch_hf_siblings(repo: str, revision: str = "main") -> list[dict[str, object]]:
    """Return raw sibling dicts (rfilename/lfs) for repo compatibility tests."""
    api_url = (
        f"{_HF_API_ROOT}/{quote(repo, safe='/')}/revision/{quote(revision, safe='')}"
    )
    request = Request(
        api_url, headers={"User-Agent": _USER_AGENT, "Accept": "application/json"}
    )
    try:
        with _open(request) as response:
            raw = response.read().decode("utf-8")
    except OSError as exc:  # HTTPError, URLError and socket timeouts are all OSError
        raise HFResolveError(
            f"Failed to query the HuggingFace API for '{repo}': {exc}"
        ) from exc
    try:
        payload: object = json.loads(raw)
    except (ValueError, TypeError) as exc:
        raise HFResolveError(
            f"Invalid HuggingFace API response for '{repo}': {exc}"
        ) from exc
    siblings = payload.get("siblings") if isinstance(payload, dict) else None
    if not isinstance(siblings, list):
        raise HFResolveError(f"Invalid HuggingFace API response for '{repo}'.")
    return [item for item in siblings if isinstance(item, dict)]


def _probe_hf_resolve_url(url: str) -> bool:
    head = Request(url, method="HEAD", headers={"User-Agent": _USER_AGENT})
    try:
        with _open(head):
            return True
    except HTTPError as exc:
        # Some hosts block HEAD; fall through to a 1-byte ranged GET.
        if exc.code not in {405, 501}:
            return False
    except OSError:
        return False

    ranged = Request(url, headers={"User-Agent": _USER_AGENT, "Range": "bytes=0-0"})
    try:
        with _open(ranged):
            return True
    except OSError:
        return False


def resolve_hf_file(
    repo: str, candidate_paths: Sequence[str], revision: str = "main"
) -> tuple[str, str, str]:
    """Return (resolved_path, sha256, download_url) for the best candidate.

    sha256 is "" when the file is small/non-LFS (no remote digest; local-only
    validation), mirroring the historical contract consumed by callers.
    """
    candidates = [item.strip() for item in candidate_paths if item.strip()]
    api_error: HFResolveError | None = None
    siblings: list[dict[str, object]] = []
    try:
        siblings = fetch_hf_siblings(repo, revision)
    except HFResolveError as exc:
        api_error = exc

    if siblings:
        by_path: dict[str, dict[str, object]] = {}
        by_path_lower: dict[str, dict[str, object]] = {}
        for sibling in siblings:
            raw_name = sibling.get("rfilename")
            if not isinstance(raw_name, str):
                continue
            normalized_name = raw_name.strip()
            if not normalized_name:
                continue
            by_path[normalized_name] = sibling
            by_path_lower[normalized_name.lower()] = sibling

        for target in candidates:
            sibling = by_path.get(target) or by_path_lower.get(target.lower())
            if sibling is None:
                continue

            resolved_target = str(sibling.get("rfilename") or "").strip() or target
            lfs = sibling.get("lfs")
            sha: str | None = None
            if isinstance(lfs, dict):
                lfs_sha = lfs.get("sha256")
                lfs_oid = lfs.get("oid")
                sha = _normalize_sha(lfs_sha if isinstance(lfs_sha, str) else None)
                if sha is None:
                    sha = _normalize_sha(lfs_oid if isinstance(lfs_oid, str) else None)

            if not sha:
                # Small non-LFS files carry no remote digest; local-only validation.
                sha = ""

            url = _build_hf_resolve_url(repo, revision, resolved_target)
            return resolved_target, sha, url

    # API unavailable or file not listed: probe direct per-file URLs.
    for target in candidates:
        url = _build_hf_resolve_url(repo, revision, target)
        if _probe_hf_resolve_url(url):
            return target, "", url

    tried = ", ".join(candidates)
    if api_error is not None:
        raise HFResolveError(
            f"{api_error} No accessible file in repo '{repo}' for candidates: {tried}"
        ) from api_error
    raise HFResolveError(f"No file found in repo '{repo}' for candidates: {tried}")


# ----------------------------------------------------------------- download


def _is_retryable(exc: OSError | HTTPException) -> bool:
    if isinstance(exc, HTTPError):
        return exc.code in _RETRYABLE_HTTP_STATUS
    if isinstance(exc, HTTPException):  # IncompleteRead, RemoteDisconnected...
        return True
    # Retrying a full disk only burns time; everything else on the wire is transient.
    return exc.errno != errno.ENOSPC


def _retry_delay_seconds(exc: OSError | HTTPException, attempt: int) -> float:
    delay = min(_MAX_BACKOFF_SECONDS, 0.5 * 2 ** (attempt - 1))
    delay += _jitter.uniform(0.0, 0.35)
    if not isinstance(exc, HTTPError):
        return delay
    raw_retry_after = exc.headers.get("Retry-After") if exc.headers else None
    if not raw_retry_after:
        return delay
    try:
        server_delay = float(str(raw_retry_after).strip())
    except ValueError:
        return delay
    if server_delay <= 0:
        return delay
    return max(delay, min(server_delay, _MAX_RETRY_AFTER_SECONDS))


def _translate_failure(exc: OSError | HTTPException, url: str) -> HFDownloadError:
    if isinstance(exc, HTTPError):
        if exc.code == 429:
            return RateLimitedError(f"Rate limited by remote server (HTTP 429): {url}")
        return NetworkDownloadError(f"Failed to download file (HTTP {exc.code}): {url}")
    if isinstance(exc, URLError):
        return NetworkDownloadError(f"Failed to download file: {exc.reason} ({url})")
    if isinstance(exc, HTTPException | ConnectionError | TimeoutError):
        return NetworkDownloadError(f"Connection failed mid-download: {exc} ({url})")
    if exc.errno == errno.ENOSPC:
        return DiskWriteError(f"Disk full while writing: {url}", os_errno=exc.errno)
    return DiskWriteError(f"Failed to save downloaded file: {exc}", os_errno=exc.errno)


def _sleep_cancellable(delay: float, bridge: DownloadProgressBridge | None) -> None:
    deadline = time.monotonic() + delay
    while (remaining := deadline - time.monotonic()) > 0:
        if bridge is not None:
            bridge.raise_if_cancelled()
        time.sleep(min(_CANCEL_POLL_SECONDS, remaining))


def _response_total(response, *, requested_offset: int) -> int | None:
    """Total remote size disclosed by the response we already hold.

    * 206 -> the total is the part after "/" in ``Content-Range``
    * 200 -> ``Content-Length``
    * 416 -> the total is the part after "/" in ``Content-Range`` (``bytes */N``)

    A HEAD probe cannot be used for this: ModelScope answers HEAD with
    ``200 OK`` and no ``Content-Length`` at all, which is what left every
    install without a total (and therefore without a percentage).
    """
    headers = getattr(response, "headers", None)
    if headers is None:
        return None
    content_range = headers.get("Content-Range")
    if content_range:
        total = content_range.rsplit("/", 1)[-1].strip()
        if total.isdigit():
            return int(total)
    length = headers.get("Content-Length")
    if length and length.isdigit():
        return int(length)
    return None


def _response_start(response, *, requested_offset: int) -> int:
    """Offset the response body starts at.

    Some hosts answer a ranged GET with ``200`` and still send
    ``Content-Range``, so the status code alone cannot decide whether the
    transfer resumes or restarts.
    """
    if requested_offset <= 0:
        return 0
    headers = getattr(response, "headers", None)
    if headers is not None:
        content_range = headers.get("Content-Range")
        if content_range:
            start = content_range.split(" ", 1)[-1].split("-", 1)[0].strip()
            if start.isdigit():
                return int(start)
    if getattr(response, "status", None) == 206:
        return requested_offset
    return 0


def _download_once(
    url: str,
    temp_path: Path,
    existing_bytes: int,
    bridge: DownloadProgressBridge | None,
) -> tuple[int | None, bool]:
    """Transfer one file.

    Returns ``(remote_total, range_satisfied)``. ``range_satisfied`` is True
    when the server answered 416 — the local partial is already at or beyond
    the end of the remote file — and the caller decides whether to promote it.
    """
    headers = {"User-Agent": _USER_AGENT}
    if existing_bytes > 0:
        headers["Range"] = f"bytes={existing_bytes}-"
        logger.info("Resuming download from %d bytes: %s", existing_bytes, url)

    try:
        response = _open(Request(url, headers=headers))
    except HTTPError as exc:
        if exc.code != 416:
            raise
        return _response_total(exc, requested_offset=existing_bytes), True

    with response:
        total_size = _response_total(response, requested_offset=existing_bytes)
        start = _response_start(response, requested_offset=existing_bytes)
        if existing_bytes > 0 and start != existing_bytes:
            logger.info("Server ignored Range header; restarting from scratch: %s", url)
            if bridge is not None:
                bridge.report_download(url, -existing_bytes)
            start = 0
        with temp_path.open("ab" if start == existing_bytes > 0 else "wb") as handle:
            while chunk := response.read(_CHUNK_SIZE):
                if bridge is not None:
                    bridge.raise_if_cancelled()
                handle.write(chunk)
                if bridge is not None:
                    bridge.report_download(url, len(chunk))
    return total_size, False


def download_file(
    url: str,
    target_path: Path,
    max_retries: int = 5,
    expected_size: int | None = None,
    expected_sha256: str | None = None,
) -> None:
    """Download with resume support; the ``.part`` file survives retries,
    cancellation and even the final failure so a later job continues from it.

    ``expected_size`` and ``expected_sha256`` are the declared facts about the
    asset. A mismatch is rejected instead of being silently resized.
    """
    temp_path = target_path.with_suffix(f"{target_path.suffix}.part")
    target_path.parent.mkdir(parents=True, exist_ok=True)

    bridge = _active_bridge()
    if bridge is not None:
        bridge.report_phase("downloading")

    attempts = max(1, max_retries)
    resume_reported = False
    total_size: int | None = None

    for attempt in range(1, attempts + 1):
        existing_bytes = temp_path.stat().st_size if temp_path.exists() else 0
        if bridge is not None:
            bridge.raise_if_cancelled()
            # A .part left by a previous job is real progress; count it exactly once.
            if not resume_reported:
                bridge.report_download(url, existing_bytes)
                resume_reported = True
        try:
            total_size, range_satisfied = _download_once(
                url, temp_path, existing_bytes, bridge
            )
        except DownloadCancelled:
            raise
        except (OSError, HTTPException) as exc:
            retryable = _is_retryable(exc)
            if retryable and attempt < attempts:
                delay = _retry_delay_seconds(exc, attempt)
                logger.warning(
                    "Download attempt %d/%d failed; resuming in %.1fs: %s",
                    attempt, attempts, delay, exc,
                )
                _sleep_cancellable(delay, bridge)
                continue
            if not retryable:
                # e.g. HTTP 404 — the partial is junk, nothing to resume from.
                temp_path.unlink(missing_ok=True)
            raise _translate_failure(exc, url) from exc

        if range_satisfied:
            # 416: the remote file ends at or before our offset.
            if total_size is not None and total_size == existing_bytes:
                break  # the partial is already the complete file
            temp_path.unlink(missing_ok=True)
            continue  # the remote shrank — download it again from scratch
        break

    if expected_size is not None and total_size is not None and total_size != expected_size:
        temp_path.unlink(missing_ok=True)
        raise HFDownloadError(
            f"Size mismatch for '{target_path.name}'. "
            f"Expected: {expected_size} | Got: {total_size}"
        )

    if expected_sha256:
        digest = sha256_file(temp_path).lower()
        if digest != expected_sha256.lower():
            temp_path.unlink(missing_ok=True)
            raise ChecksumMismatchError(
                f"Invalid SHA256 checksum for '{target_path.name}'. "
                f"Expected: {expected_sha256} | Got: {digest}",
                expected=expected_sha256,
                got=digest,
            )

    temp_path.replace(target_path)


def ensure_file_from_hf(
    *,
    repo: str,
    candidate_paths: Sequence[str],
    target_path: Path,
    revision: str = "main",
    expected_sha256: str | None = None,
) -> dict[str, object]:
    configured_sha = _normalize_sha(expected_sha256)
    if expected_sha256 and configured_sha is None:
        raise HFDownloadError(
            f"Invalid SHA256 checksum configured for '{repo}': {expected_sha256}"
        )

    selected_path, resolved_sha, download_url = resolve_hf_file(
        repo=repo,
        candidate_paths=candidate_paths,
        revision=revision,
    )
    expected_sha = configured_sha or (resolved_sha or None)

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
            f"Invalid SHA256 checksum for '{selected_path}'. "
            f"Expected: {expected_sha} | Got: {current_sha}",
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
    files: Sequence[str],
    target_dir: Path,
    revision: str = "main",
) -> list[dict[str, object]]:
    target_dir.mkdir(parents=True, exist_ok=True)
    payloads: list[dict[str, object]] = []
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
