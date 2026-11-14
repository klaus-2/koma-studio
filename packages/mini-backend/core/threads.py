"""CPU thread-limit env parsing shared by the ORT session builder, the torch
startup helper and the diagnostics report. Single source of truth for the
``MINI_BACKEND_*_OP_THREADS`` contract: a positive int applies, anything else
(absent, malformed, <= 0) leaves the runtime's own default untouched.

``OMP_NUM_THREADS`` is set by the desktop shells only (they mirror the
intra-op value): OpenMP reads it once at process start, so the sidecar never
sets it itself.
"""

from __future__ import annotations

import os

INTRA_OP_THREADS_ENV: str = "MINI_BACKEND_INTRA_OP_THREADS"
INTER_OP_THREADS_ENV: str = "MINI_BACKEND_INTER_OP_THREADS"


def env_thread_limit(name: str) -> int | None:
    """Positive-int value of ``name`` in the environment, else None."""
    raw = os.getenv(name)
    if raw is None:
        return None
    try:
        value = int(raw.strip())
    except ValueError:
        return None
    return value if value > 0 else None
