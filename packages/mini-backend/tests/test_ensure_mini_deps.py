"""ensure-mini-deps v2 contract: mini_backend_tools.dependencies.

The v2 provisioner resolves the full requirement set before uninstalling
conflicting wheel families, installs from a hashed lock, and probes the
runtime in a fresh interpreter. These tests pin the pure-logic pieces.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from packaging.requirements import Requirement  # noqa: E402

from mini_backend_tools.dependencies import (  # noqa: E402
    DependencyError,
    RequirementSet,
    _effective_requirements,
    _read_requirements,
    load_settings,
)


def test_profile_mapping_survives_parity_contract() -> None:
    """The Tauri/electron parity consumers pin the profile mapping literal."""
    spec = importlib.util.spec_from_file_location(
        "ensure_mini_deps",
        MINI_BACKEND_DIR / "scripts" / "ensure-mini-deps.py",
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    mapping = module.PROFILE_REQUIREMENTS
    assert mapping[("nvidia-cuda", "Windows")] == "requirements-windows-nvidia.txt"
    assert (
        mapping[("nvidia-cuda-legacy", "Windows")]
        == "requirements-windows-nvidia-legacy.txt"
    )
    assert mapping[("amd-rocm", "Linux")] == "requirements-linux-amd.txt"


def test_environment_validation() -> None:
    settings = load_settings({"MINI_BACKEND_ACCELERATION_PROFILE": " NVIDIA-CUDA "})
    assert settings.profile == "nvidia-cuda"

    with pytest.raises(Exception):
        load_settings({"MINI_DEPS_OUTER_ATTEMPTS": "-1"})


def test_read_requirements_resolves_includes_and_rejects_urls(
    tmp_path: Path,
) -> None:
    (tmp_path / "base.txt").write_text(
        "fastapi==0.115.0\nnumpy>=2.0.0\n", encoding="utf-8"
    )
    (tmp_path / "profile.txt").write_text(
        "-r base.txt\nonnxruntime-gpu==1.22.0\n", encoding="utf-8"
    )

    result = RequirementSet()
    _read_requirements(tmp_path / "profile.txt", root=tmp_path, result=result)

    names = {item.name for item in result.requirements}
    assert names == {"fastapi", "numpy", "onnxruntime-gpu"}

    (tmp_path / "bad.txt").write_text("-e git+https://x\n", encoding="utf-8")
    with pytest.raises(DependencyError):
        bad_result = RequirementSet()
        _read_requirements(tmp_path / "bad.txt", root=tmp_path, result=bad_result)


def test_effective_requirements_filters_onnx_variants() -> None:
    def req(line: str) -> Requirement:
        return Requirement(line)

    base = RequirementSet(requirements=[req("torch>=2.5.0"), req("onnxruntime")])
    profile = RequirementSet(requirements=[req("onnxruntime-gpu==1.22.0")])

    effective = _effective_requirements(
        base, profile, selected="nvidia-cuda", expected_onnx="onnxruntime-gpu"
    )
    names = {item.name for item in effective.requirements}
    assert names == {"torch", "onnxruntime-gpu"}


def test_legacy_windows_profile_requires_explicit_numpy() -> None:
    def req(line: str) -> Requirement:
        return Requirement(line)

    base = RequirementSet(requirements=[req("numpy>=2.0.0"), req("onnxruntime")])
    without_numpy = RequirementSet(
        requirements=[req("onnxruntime-gpu==1.18.1")]
    )
    with pytest.raises(DependencyError):
        _effective_requirements(
            base,
            without_numpy,
            selected="nvidia-cuda-legacy",
            expected_onnx="onnxruntime-gpu",
        )

    with_numpy = RequirementSet(
        requirements=[req("onnxruntime-gpu==1.18.1"), req("numpy<2")]
    )
    effective = _effective_requirements(
        base,
        with_numpy,
        selected="nvidia-cuda-legacy",
        expected_onnx="onnxruntime-gpu",
    )
    numpy_versions = [
        str(item.specifier)
        for item in effective.requirements
        if item.name == "numpy"
    ]
    assert numpy_versions == ["<2"]


if __name__ == "__main__":
    import unittest

    unittest.main()
