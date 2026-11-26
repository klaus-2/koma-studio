from __future__ import annotations

import errno
from http.client import IncompleteRead
from pathlib import Path
import sys
import unittest
from urllib.error import HTTPError, URLError

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

import core.hf_download as hf
from core.hf_download import (
    ChecksumMismatchError,
    DiskWriteError,
    NetworkDownloadError,
    RateLimitedError,
    download_file,
)


class _FakeResponse:
    def __init__(self, body: bytes, status: int, headers: dict | None = None) -> None:
        self._body = body
        self.status = status
        self._offset = 0
        self.headers = headers if headers is not None else {}

    def read(self, size: int) -> bytes:
        chunk = self._body[self._offset : self._offset + size]
        self._offset += len(chunk)
        return chunk

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *_: object) -> None:
        return None


class RetryableTests(unittest.TestCase):
    def test_is_retryable_excludes_disk_full(self) -> None:
        self.assertFalse(hf._is_retryable(OSError(errno.ENOSPC, "full")))
        self.assertTrue(hf._is_retryable(OSError(errno.ECONNRESET, "reset")))
        self.assertTrue(hf._is_retryable(IncompleteRead(b"")))
        self.assertTrue(hf._is_retryable(HTTPError("u", 503, "x", None, None)))  # type: ignore[arg-type]
        self.assertFalse(hf._is_retryable(HTTPError("u", 404, "x", None, None)))  # type: ignore[arg-type]

    def test_translate_failure_taxonomy(self) -> None:
        cases: list[tuple[OSError | IncompleteRead, type[Exception]]] = [
            (URLError("dns"), NetworkDownloadError),
            (OSError(errno.ENOSPC, "full"), DiskWriteError),
            (IncompleteRead(b""), NetworkDownloadError),
        ]
        for exc, expected in cases:
            with self.subTest(exc=type(exc).__name__):
                self.assertIsInstance(hf._translate_failure(exc, "u"), expected)
        # HTTPError (subclass of both OSError and HTTPException) 429 mapping.
        self.assertIsInstance(
            hf._translate_failure(HTTPError("u", 429, "x", {}, None), "u"),  # type: ignore[arg-type]
            RateLimitedError,
        )

    def test_resume_appends_to_partial(self) -> None:
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "model.bin"
            part = target.with_suffix(".bin.part")
            part.write_bytes(b"AAAA")
            seen_ranges: list[str | None] = []

            def fake_open(request: hf.Request) -> _FakeResponse:
                if request.get_method() == "HEAD":
                    return _FakeResponse(b"", 200, headers={"content-length": "8"})
                seen_ranges.append(request.get_header("Range"))
                return _FakeResponse(b"BBBB", 206)

            original_open = hf._open
            hf._open = fake_open  # type: ignore[assignment]
            try:
                download_file(
                    "https://huggingface.co/x/resolve/main/model.bin", target
                )
            finally:
                hf._open = original_open  # type: ignore[assignment]

            self.assertEqual(target.read_bytes(), b"AAAABBBB")
            self.assertEqual(seen_ranges, ["bytes=4-"])
            self.assertFalse(part.exists())


class SizeMismatchTests(unittest.TestCase):
    def test_declared_size_mismatch_raises_checksum_error_and_drops_the_part(self) -> None:
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "model.bin"
            part = target.with_suffix(".bin.part")

            def fake_open(request: hf.Request) -> _FakeResponse:
                return _FakeResponse(
                    b"0123456789ABCDEF", 200, headers={"Content-Length": "16"}
                )

            original_open = hf._open
            hf._open = fake_open  # type: ignore[assignment]
            try:
                with self.assertRaises(ChecksumMismatchError) as ctx:
                    download_file(
                        "https://huggingface.co/x/resolve/main/model.bin",
                        target,
                        expected_size=8,
                    )
            finally:
                hf._open = original_open  # type: ignore[assignment]

            self.assertIn("Size mismatch", str(ctx.exception))
            self.assertEqual(ctx.exception.expected, "8")
            self.assertEqual(ctx.exception.got, "16")
            self.assertFalse(part.exists())
            self.assertFalse(target.exists())

    def test_download_declares_content_length_when_no_total_was_set(self) -> None:
        import tempfile
        from core.download_jobs import DownloadJob, JobProgressBridge
        from core.hf_download import progress_bridge_var

        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "weights.bin"
            job = DownloadJob(model_id="direct")
            bridge = JobProgressBridge(job)
            token = progress_bridge_var.set(bridge)

            def fake_open(request: hf.Request) -> _FakeResponse:
                return _FakeResponse(b"12345678", 200, headers={"Content-Length": "8"})

            original_open = hf._open
            hf._open = fake_open  # type: ignore[assignment]
            try:
                download_file("https://huggingface.co/x/resolve/main/weights.bin", target)
            finally:
                hf._open = original_open  # type: ignore[assignment]
                progress_bridge_var.reset(token)

            snap = job.snapshot()
            self.assertEqual(snap["totalBytes"], 8)
            self.assertEqual(snap["bytesDownloaded"], 8)
            self.assertEqual(snap["percent"], 100.0)


if __name__ == "__main__":
    unittest.main()
