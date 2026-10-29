"""Windows CUDA torch policy for the provisioner.

PyPI's Windows torch wheels are CPU-only, and easyocr/transformers pull torch
transitively into every compiled lock — while uv's index precedence cannot be
overridden per package (a PyPI extra index still wins with a newer version).
Torch is therefore owned entirely by this module's policy: the compiled lock
has its torch entries trimmed (`drop_torch_entries_from_lock`), and
`ensure_torch_cuda` in `dependencies.py` installs the CUDA build from the
PyTorch index and verifies it landed (self-gated on the Windows CUDA profiles).
"""

from __future__ import annotations

import re
import sys
from collections.abc import Sequence
from pathlib import Path

from packaging.utils import canonicalize_name

# The profiles whose whole wheel stack is the cu11 (CUDA 11.8 + cuDNN 8)
# family on Windows and cu12 elsewhere.
NVIDIA_PROFILES = frozenset(
    {"nvidia-cuda", "nvidia-cuda-legacy", "nvidia-tensorrt"}
)

TORCH_PACKAGES = frozenset({"torch", "torchvision"})
TORCH_CUDA_INDEX_URL = "https://download.pytorch.org/whl/cu124"

TORCH_QUERY_STAGE = "torch-cuda-query"
TORCH_INSTALL_STAGE = "torch-cuda"

# Exit 0: torch has CUDA support. Exit 1: torch is missing or CPU-only and the
# CUDA wheel install must run. Anything else: the query itself failed.
TORCH_CUDA_QUERY = r"""
try:
    import torch
except ImportError:
    raise SystemExit(1)
raise SystemExit(0 if torch.version.cuda is not None else 1)
"""


def windows_cuda_torch(selected: str) -> bool:
    """Whether torch must come from the PyTorch index (Windows CUDA profiles)."""
    return selected in NVIDIA_PROFILES and sys.platform == "win32"


def drop_torch_entries_from_lock(lock_text: str) -> str:
    """Remove the torch package blocks a Windows CUDA-profile lock must not carry.

    easyocr/transformers pull torch transitively, so the compiled lock pins
    PyPI's CPU-only Windows wheel no matter what the direct requirements say.
    Torch is owned by `ensure_torch_cuda` (the PyTorch CUDA index), so its
    entries are dropped and the install stage never touches the installed CUDA
    build.
    """
    kept: list[str] = []
    skipping = False
    for line in lock_text.splitlines(keepends=True):
        if line[:1] in {" ", "\t"} and line.strip():
            # Continuation (--hash / "# via") of the current entry.
            if not skipping:
                kept.append(line)
            continue
        entry = re.match(r"([A-Za-z0-9_.-]+)==", line)
        skipping = (
            entry is not None
            and canonicalize_name(entry.group(1)) in TORCH_PACKAGES
        )
        if not skipping:
            kept.append(line)
    return "".join(kept)


def torch_cuda_query_child(
    interpreter_argv: Sequence[str] | None,
    target_python: Path,
    profile: str,
) -> list[str]:
    """Argv for the torch CUDA query. Positional shape (stage, profile) matches
    the two-argument contract the test fake interpreter implements."""
    if interpreter_argv is not None:
        return [*interpreter_argv, TORCH_QUERY_STAGE, profile]
    return [str(target_python), "-I", "-c", TORCH_CUDA_QUERY, profile]
