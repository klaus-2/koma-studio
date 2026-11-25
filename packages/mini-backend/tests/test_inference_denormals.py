from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.denormals import current_thread_flushes_denormals  # noqa: E402
from models import execution  # noqa: E402

pytestmark = pytest.mark.skipif(
    sys.platform != "win32", reason="per-thread denormal control is wired on Windows only"
)


def test_inference_workers_flush_denormals_to_zero() -> None:
    async def probe() -> bool:
        return await execution.run_inference(current_thread_flushes_denormals)

    assert asyncio.run(probe()) is True
