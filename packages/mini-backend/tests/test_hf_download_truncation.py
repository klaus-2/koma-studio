from __future__ import annotations

import hashlib
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core import hf_download  # noqa: E402
from core.hf_download import download_file  # noqa: E402

PAYLOAD = bytes(range(256)) * 4096
CUT_AT = len(PAYLOAD) // 3


class _DroppingHandler(BaseHTTPRequestHandler):
    drops_left = 1
    ranges_seen: list[str | None] = []

    def do_GET(self) -> None:  # noqa: N802
        range_header = self.headers.get("Range")
        type(self).ranges_seen.append(range_header)
        start = 0
        if range_header:
            start = int(range_header.removeprefix("bytes=").split("-", 1)[0])
        body = PAYLOAD[start:]
        if start:
            self.send_response(206)
            self.send_header(
                "Content-Range", f"bytes {start}-{len(PAYLOAD) - 1}/{len(PAYLOAD)}"
            )
        else:
            self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if type(self).drops_left > 0:
            type(self).drops_left -= 1
            self.wfile.write(body[: CUT_AT - start])
            self.wfile.flush()
            self.close_connection = True
            return
        self.wfile.write(body)

    def log_message(self, *_args) -> None:
        pass


class DroppedConnectionResumeTests(unittest.TestCase):
    def setUp(self) -> None:
        _DroppingHandler.drops_left = 1
        _DroppingHandler.ranges_seen = []
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _DroppingHandler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}/model.bin"
        self._backoff = hf_download._MAX_BACKOFF_SECONDS
        hf_download._MAX_BACKOFF_SECONDS = 0.0

    def tearDown(self) -> None:
        hf_download._MAX_BACKOFF_SECONDS = self._backoff
        self.server.shutdown()
        self.server.server_close()

    def test_early_close_resumes_instead_of_failing_the_checksum(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            target = Path(root) / "model.bin"
            download_file(
                self.url,
                target,
                expected_size=len(PAYLOAD),
                expected_sha256=hashlib.sha256(PAYLOAD).hexdigest(),
            )
            self.assertEqual(target.read_bytes(), PAYLOAD)
        self.assertEqual(_DroppingHandler.ranges_seen, [None, f"bytes={CUT_AT}-"])

    def test_partial_survives_when_retries_run_out(self) -> None:
        _DroppingHandler.drops_left = 10
        with tempfile.TemporaryDirectory() as root:
            target = Path(root) / "model.bin"
            with self.assertRaises(hf_download.HFDownloadError):
                download_file(self.url, target, max_retries=1)
            self.assertFalse(target.exists())
            self.assertEqual(target.with_suffix(".bin.part").stat().st_size, CUT_AT)


if __name__ == "__main__":
    unittest.main()
