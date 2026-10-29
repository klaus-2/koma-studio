"""Requirement-file parsing and the effective requirement set per profile.

Pure model layer: no subprocesses, no index knowledge. The torch lines are
deliberately NOT filtered here — uv resolves torch transitively
(easyocr/transformers) into the compiled lock regardless, so the authoritative
torch handling lives in `torch_wheels` (lock trim + the CUDA wheel install).
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

from packaging.requirements import InvalidRequirement, Requirement
from packaging.utils import canonicalize_name
from pydantic import BaseModel, HttpUrl, field_validator


class DependencyError(RuntimeError):
    """Provisioning failed without a verified dependency environment."""


class IndexSettings(BaseModel):
    url: HttpUrl

    @field_validator("url")
    @classmethod
    def secure_url(cls, value: HttpUrl) -> HttpUrl:
        if (
            value.scheme != "https"
            or value.username
            or value.password
            or value.query
            or value.fragment
        ):
            raise ValueError("Index must be HTTPS without embedded credentials")
        return value


# Every distribution that provides the onnxruntime namespace. Installing one
# over another silently replaces the shared files, so only the profile's
# expected variant may survive.
ONNX_VARIANTS = frozenset(
    {
        "onnxruntime",
        "onnxruntime-gpu",
        "onnxruntime-directml",
        "onnxruntime-openvino",
        "onnxruntime-rocm",
    }
)


@dataclass(slots=True)
class RequirementSet:
    requirements: list[Requirement] = field(default_factory=list)
    constraints: list[Requirement] = field(default_factory=list)
    index: str | None = None


def read_requirements(
    path: Path,
    *,
    root: Path,
    result: RequirementSet,
    stack: frozenset[Path] = frozenset(),
    constraint: bool = False,
) -> None:
    resolved = path.resolve(strict=True)
    if not resolved.is_relative_to(root):
        raise DependencyError("Requirement include escapes the project")
    if resolved in stack or len(stack) >= 32:
        raise DependencyError("Cyclic or excessively deep requirement includes")
    if resolved.stat().st_size > 2 * 1024 * 1024:
        raise DependencyError("Requirements file exceeds the size budget")

    with resolved.open(encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            line = line.split(" #", maxsplit=1)[0].strip()

            directive, separator, argument = line.partition(" ")
            if directive in {"-r", "--requirement", "-c", "--constraint"}:
                if not separator or not argument.strip():
                    raise DependencyError("Empty requirement include")
                read_requirements(
                    resolved.parent / Path(argument.strip()),
                    root=root,
                    result=result,
                    stack=stack | {resolved},
                    constraint=constraint or directive in {"-c", "--constraint"},
                )
                continue

            if directive == "--index-url":
                index = str(IndexSettings.model_validate({"url": argument.strip()}).url)
                if result.index is not None and result.index != index:
                    raise DependencyError("Conflicting primary package indexes")
                result.index = index
                continue

            if line.startswith("-") or line.endswith("\\"):
                raise DependencyError("Unsupported requirement-file directive")

            try:
                requirement = Requirement(line)
            except InvalidRequirement as exc:
                raise DependencyError("Invalid PEP 508 requirement") from exc
            if requirement.url is not None:
                raise DependencyError("Direct URL requirements require an explicit lock workflow")

            target = result.constraints if constraint else result.requirements
            target.append(requirement)


def _active(requirement: Requirement) -> bool:
    return requirement.marker is None or requirement.marker.evaluate()


def effective_requirements(
    base: RequirementSet,
    profile: RequirementSet,
    *,
    selected: str,
    expected_onnx: str,
    require_pinned_onnx: bool = True,
) -> RequirementSet:
    """Merge the base and profile sets, dropping foreign ONNX variants.

    On the Windows legacy profile the base ``numpy>=2.0.0`` pin is dropped so
    the profile file's ``numpy<2`` stays the single source of truth — ORT
    1.18.1 is compiled against the NumPy 1.x C-API.
    """
    legacy_windows = selected == "nvidia-cuda-legacy" and sys.platform == "win32"
    result = RequirementSet(index=profile.index or base.index)
    result.constraints.extend(base.constraints)
    result.constraints.extend(profile.constraints)

    for requirement in [*base.requirements, *profile.requirements]:
        if not _active(requirement):
            continue
        name = canonicalize_name(requirement.name)
        if name in ONNX_VARIANTS and name != expected_onnx:
            continue
        if legacy_windows and name == "numpy" and requirement in base.requirements:
            continue
        result.requirements.append(requirement)

    names = {canonicalize_name(item.name) for item in result.requirements}
    if require_pinned_onnx and expected_onnx not in names:
        raise DependencyError("Selected profile does not pin its ONNX runtime")

    if legacy_windows:
        numpy_specs = [
            item for item in profile.requirements
            if canonicalize_name(item.name) == "numpy" and _active(item)
        ]
        if not numpy_specs:
            raise DependencyError("Legacy Windows profile must explicitly constrain NumPy")

    return result
