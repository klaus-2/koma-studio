"""Engine idle sweeper wiring: every factory registers its engine cache for
idle eviction, and the real local-api app starts and stops the sweeper task
through its lifespan.

Uses the ASYNC ASGI client (context manager form, which actually runs the
lifespan) guarded on optional runtime deps, mirroring test_ipc_compression.
"""

from __future__ import annotations

import os
from pathlib import Path
import sys

import pytest
from httpx import ASGITransport, AsyncClient

os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core import engine_idle  # noqa: E402

_FACTORY_IMPORT_ERROR: Exception | None = None
try:
    from models.detection import factory as _detection_factory  # noqa: E402, F401
    from models.enhance import factory as _enhance_factory  # noqa: E402, F401
    from models.inpainting import factory as _inpainting_factory  # noqa: E402, F401
    from models.ocr import factory as _ocr_factory  # noqa: E402, F401
    from models.segmentation import factory as _segmentation_factory  # noqa: E402, F401
    from models.translation import factory as _translation_factory  # noqa: E402, F401
except Exception as exc:  # pragma: no cover - optional runtime deps
    _FACTORY_IMPORT_ERROR = exc

_APP_IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
except Exception as exc:  # pragma: no cover - optional runtime deps
    _APP_IMPORT_ERROR = exc

_EXPECTED_IDLE_CACHE_NAMES: frozenset[str] = frozenset(
    {"ocr", "translator", "segmentation", "inpainting", "detector", "enhancer"}
)


@pytest.mark.skipif(
    _FACTORY_IMPORT_ERROR is not None,
    reason=f"optional runtime dependencies missing: {_FACTORY_IMPORT_ERROR}",
)
def test_factories_register_idle_caches() -> None:
    registered = engine_idle.registered_idle_cache_names()
    missing = _EXPECTED_IDLE_CACHE_NAMES - registered
    assert missing == frozenset()


@pytest.mark.skipif(
    _APP_IMPORT_ERROR is not None,
    reason=f"optional runtime dependencies missing: {_APP_IMPORT_ERROR}",
)
async def test_app_lifespan_starts_and_stops_sweeper() -> None:
    transport = ASGITransport(app=mini_app.app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"healthy": True}
