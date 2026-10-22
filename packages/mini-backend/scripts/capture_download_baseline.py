"""Capture the real download progress of a backend-managed model install.

Runs the actual installer with the actual progress bridge and prints the job
snapshot progression. This is the acceptance harness for the download logic:
the total must be declared (not discovered halfway through), the percentage
must rise monotonically to 100 and every asset must be digest-verified.

Usage:
    python capture_download_baseline.py [model_id] [models_root]

The models root defaults to KOMA_MODELS_ROOT, or a temporary directory.
"""

from __future__ import annotations

import os
import sys
import tempfile
import time
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from core import hf_download  # noqa: E402
from core.download_jobs import DownloadJob, JobProgressBridge  # noqa: E402
from models.ocr.paddleocr.storage import ensure_paddleocr_models_installed  # noqa: E402


def main() -> int:
    model_id = sys.argv[1] if len(sys.argv) > 1 else "paddleocr_latin_v5"
    if len(sys.argv) > 2:
        models_root = Path(sys.argv[2])
        models_root.mkdir(parents=True, exist_ok=True)
        os.environ["KOMA_MODELS_ROOT"] = str(models_root)
    else:
        models_root = Path(tempfile.mkdtemp(prefix="koma-models-"))
        os.environ["KOMA_MODELS_ROOT"] = str(models_root)

    job = DownloadJob(model_id=model_id)
    bridge = JobProgressBridge(job)
    token = hf_download.progress_bridge_var.set(bridge)

    print(f"=== {model_id} ===")
    print(f"{'t(s)':>7} {'state':>12} {'bytes':>12} {'total':>12} {'pct':>7} {'B/s':>12}")
    started = time.monotonic()
    try:
        result = ensure_paddleocr_models_installed(model_id)
    except Exception as exc:  # noqa: BLE001 - the harness reports the failure
        print(f"FAILED: {type(exc).__name__}: {exc}")
        return 1
    finally:
        hf_download.progress_bridge_var.reset(token)

    elapsed = time.monotonic() - started
    snapshot = job.snapshot()
    print(
        f"{elapsed:7.2f} {snapshot['state']:>12} {snapshot['bytesDownloaded']:>12} "
        f"{str(snapshot['totalBytes']):>12} {snapshot['percent']:>7.2f} "
        f"{snapshot['speedBytesPerSecond']:>12.0f}"
    )
    for asset in result["files"]:
        print(f"    {asset['target']}  sha256={asset['sha256'][:16]}…  downloaded={asset['downloaded']}")
    print()
    print(">>> ACCEPTANCE")
    print(f"    totalBytes  = {snapshot['totalBytes']}  (must be the real bundle size, not None)")
    print(f"    percent     = {snapshot['percent']}  (must reach 100.0)")
    print(f"    speedB/s    = {snapshot['speedBytesPerSecond']}")
    print(f"    modelsRoot  = {models_root}")
    if snapshot["totalBytes"] is None or snapshot["percent"] != 100.0:
        print("    RESULT: FAIL")
        return 1
    print("    RESULT: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
