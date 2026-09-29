from __future__ import annotations

import errno
import threading
import unittest

from core.download_jobs import (
    DownloadCancelled,
    DownloadErrorCode,
    DownloadJob,
    InsufficientDiskError,
    JobManager,
    JobState,
    classify_error,
)
from core.hf_download import (
    ChecksumMismatchError,
    DiskWriteError,
    NetworkDownloadError,
    RateLimitedError,
)


def _installer(model_id: str, _lang: str | None, _extras: object) -> dict[str, object]:
    return {"modelId": model_id}


class DownloadJobUnitTests(unittest.TestCase):
    def test_submit_dedups_active_job(self) -> None:
        manager = JobManager()
        manager.installer = _installer
        try:
            first, created = manager.submit("model-a")
            second, created_again = manager.submit("model-a")
            self.assertTrue(created)
            self.assertFalse(created_again)
            self.assertIs(first, second)
            self.assertTrue(first.wait(timeout=5))
            self.assertIs(first.state, JobState.READY)
        finally:
            manager.installer = None

    def test_cancel_queued_job_is_terminal_without_running(self) -> None:
        job = DownloadJob(model_id="m")
        self.assertTrue(job.request_cancel())
        self.assertIs(job.state, JobState.CANCELLED)
        self.assertTrue(job.done_event.is_set())
        self.assertFalse(job.request_cancel())

    def test_resume_rewind_never_goes_negative_and_percent_is_honest(self) -> None:
        job = DownloadJob(model_id="m")
        job.record_download("f", 500, 1000)
        job.record_download("f", -500, 1000)
        job.record_download("f", 250, 1000)
        snap = job.snapshot()
        self.assertEqual(snap["bytesDownloaded"], 250)
        self.assertEqual(snap["totalBytes"], 1000)
        self.assertEqual(snap["percent"], 25.0)

    def test_reads_are_safe_while_worker_prunes(self) -> None:
        manager = JobManager()
        manager.installer = _installer
        stop = threading.Event()
        errors: list[BaseException] = []

        def reader() -> None:
            while not stop.is_set():
                try:
                    manager.list_snapshots()
                    manager.find_active_by_model("m-0")
                except BaseException as exc:  # noqa: BLE001 - the test asserts on it
                    errors.append(exc)
                    return

        thread = threading.Thread(target=reader)
        thread.start()
        try:
            jobs = [manager.submit(f"m-{i}")[0] for i in range(60)]
            for job in jobs:
                self.assertTrue(job.wait(timeout=10))
        finally:
            stop.set()
            thread.join(timeout=5)
            manager.installer = None
        self.assertEqual(errors, [])


class ClassifyErrorTests(unittest.TestCase):
    def test_by_exception_type(self) -> None:
        cases: list[tuple[BaseException, DownloadErrorCode]] = [
            (DownloadCancelled(), DownloadErrorCode.CANCELLED),
            (RateLimitedError("x"), DownloadErrorCode.RATE_LIMITED),
            (ChecksumMismatchError("x", expected="a", got="b"), DownloadErrorCode.CHECKSUM_MISMATCH),
            (NetworkDownloadError("x"), DownloadErrorCode.NETWORK),
            (DiskWriteError("x", os_errno=errno.ENOSPC), DownloadErrorCode.DISK_FULL),
            (InsufficientDiskError("x", required_bytes=1, available_bytes=0), DownloadErrorCode.DISK_FULL),
            (OSError(errno.ENOSPC, "full"), DownloadErrorCode.DISK_FULL),
            (OSError(errno.ECONNRESET, "reset"), DownloadErrorCode.NETWORK),
            (ValueError("?"), DownloadErrorCode.UNKNOWN),
        ]
        for exc, expected in cases:
            with self.subTest(exc=type(exc).__name__):
                self.assertIs(classify_error(exc)[0], expected)


if __name__ == "__main__":
    unittest.main()
