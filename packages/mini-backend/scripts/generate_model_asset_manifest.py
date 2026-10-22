"""Generate the canonical model-asset manifest for every managed model.

Every asset the Python backend installs is declared ONCE here: its path inside
the upstream tree, its real byte size and its sha256. The install manifests are
built from this file, so a size can never drift away from the digest that
protects it.

The asset LISTS come from the backend's own registries (they already own the
asset lists); this script only resolves the sizes and digests from upstream.

Sources:
  * HuggingFace ``GET /api/models/{repo}/tree/{rev}?recursive=true``
    -> ``size`` per file; ``lfs.oid`` is the sha256 for LFS files. For small
    non-LFS files the oid is a git SHA1, so the content is hashed locally.
  * ModelScope ``GET /api/v1/models/{repo}/repo/files?Revision={rev}&Root={leaf}``
    -> ``Size`` + ``Sha256`` (covers the plain-text dictionaries too).
  * GitHub releases ``GET /repos/{repo}/releases``
    -> ``size`` per asset; the digest is computed from the downloaded bytes.

Usage:
    python generate_model_asset_manifest.py            # write the snapshot
    python generate_model_asset_manifest.py --check    # fail if the snapshot drifted
    python generate_model_asset_manifest.py --verify   # also re-download and hash every asset
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
BACKEND_ROOT = HERE.parent
SNAPSHOT_PATH = BACKEND_ROOT / "models" / "manifests" / "model-assets.json"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

MODELSCOPE_API = "https://www.modelscope.cn/api/v1/models/{repo}/repo/files"
MODELSCOPE_REPO = "RapidAI/RapidOCR"
MODELSCOPE_REVISION = "v3.4.0"
HF_TREE_API = "https://huggingface.co/api/models/{repo}/tree/{rev}"
HF_REVISION = "main"
GITHUB_RELEASE_API = "https://api.github.com/repos/{repo}/releases"

USER_AGENT = "koma-studio-model-manifest/1.0"
TIMEOUT_SECONDS = 120
_MAX_INLINE_HASH_BYTES = 8 * 1024 * 1024

DETECTOR_PATH = "onnx/PP-OCRv5/det/ch_PP-OCRv5_mobile_det.onnx"

# model id -> (recognizer upstream name, dictionary file name)
PADDLEOCR_MODELS: dict[str, tuple[str, str]] = {
    "paddleocr": ("eslav_PP-OCRv5_rec_mobile_infer", "ppocrv5_eslav_dict.txt"),
    "paddleocr_latin_v5": ("latin_PP-OCRv5_rec_mobile_infer", "ppocrv5_latin_dict.txt"),
    "paddleocr_ch_v5": ("ch_PP-OCRv5_rec_mobile_infer", "ppocrv5_dict.txt"),
    "paddleocr_en_v5": ("en_PP-OCRv5_rec_mobile_infer", "ppocrv5_en_dict.txt"),
}


def _get(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return response.read()


def _get_json(url: str) -> Any:
    return json.loads(_get(url).decode("utf-8"))


def _download_sha256(url: str) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        while chunk := response.read(1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
    return size, digest.hexdigest()


# ----------------------------------------------------------------- upstream --


def _hf_tree(repo: str) -> list[dict[str, Any]]:
    return _get_json(HF_TREE_API.format(repo=repo, rev=HF_REVISION) + "?recursive=true")


def _hf_assets(repo: str) -> dict[str, dict[str, Any]]:
    """path -> {size, sha256} for a HuggingFace repo (sha256 from the LFS oid)."""
    assets: dict[str, dict[str, Any]] = {}
    for entry in _hf_tree(repo):
        if entry.get("type") != "file":
            continue
        path = str(entry.get("path") or "")
        size = int(entry.get("size") or 0)
        if not path or size <= 0:
            continue
        lfs = entry.get("lfs")
        sha256 = ""
        if isinstance(lfs, dict):
            oid = str(lfs.get("oid") or "")
            if len(oid) == 64:
                sha256 = oid.lower()
        assets[path] = {"size": size, "sha256": sha256}
    return assets


def _hf_resolve_url(repo: str, path: str) -> str:
    return f"https://huggingface.co/{repo}/resolve/{HF_REVISION}/{path}"


def _github_release_assets(repo: str, tag: str) -> dict[str, dict[str, Any]]:
    """asset name -> {size, url} for a GitHub release."""
    release = _get_json(GITHUB_RELEASE_API.format(repo=repo) + f"/tags/{tag}")
    return {
        str(asset["name"]): {
            "size": int(asset["size"]),
            "url": str(asset["browser_download_url"]),
        }
        for asset in release.get("assets", [])
    }


def _github_asset(url: str) -> dict[str, Any]:
    """Resolve a GitHub release download URL to its size.

    Uses a HEAD request instead of the releases API: the API is rate limited
    for unauthenticated callers and the size is all we need from it.
    """
    request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        size = int(response.headers.get("Content-Length") or 0)
    if size <= 0:
        raise SystemExit(f"missing size for release asset {url}")
    return {"size": size, "url": url}


def _modelscope_assets() -> dict[str, dict[str, Any]]:
    """path -> {size, sha256} for the RapidOCR ModelScope repo."""
    roots = {
        "onnx/PP-OCRv5/det",
        "onnx/PP-OCRv5/rec",
        "paddle/PP-OCRv5/rec/eslav_PP-OCRv5_rec_mobile_infer",
        "paddle/PP-OCRv5/rec/latin_PP-OCRv5_rec_mobile_infer",
        "paddle/PP-OCRv5/rec/ch_PP-OCRv5_rec_mobile_infer",
        "paddle/PP-OCRv5/rec/en_PP-OCRv5_rec_mobile_infer",
    }
    resolved: dict[str, dict[str, Any]] = {}
    for root in sorted(roots):
        url = (
            f"{MODELSCOPE_API.format(repo=MODELSCOPE_REPO)}"
            f"?Revision={MODELSCOPE_REVISION}&Root={root}"
        )
        payload = _get_json(url)
        for entry in payload.get("Data", {}).get("Files", []):
            if entry.get("Type") != "blob":
                continue
            path = str(entry.get("Path") or "")
            size = int(entry.get("Size") or 0)
            sha256 = str(entry.get("Sha256") or "").lower()
            if not path or size <= 0 or len(sha256) != 64:
                raise SystemExit(f"modelscope manifest entry is incomplete: {entry!r}")
            resolved[path] = {"size": size, "sha256": sha256}
    return resolved


# ------------------------------------------------------------------ helpers --


def _asset(
    path: str,
    size: int,
    sha256: str,
    *,
    url: str | None = None,
    target: str | None = None,
) -> dict[str, Any]:
    entry: dict[str, Any] = {"path": path, "size": size, "sha256": sha256}
    if url:
        entry["url"] = url
    if target:
        entry["target"] = target
    return entry


def _hf_bundle(
    repo: str,
    paths: list[str],
    *,
    targets: dict[str, str] | None = None,
    verify: bool = False,
) -> list[dict[str, Any]]:
    assets = _hf_assets(repo)
    bundle: list[dict[str, Any]] = []
    for path in paths:
        info = assets.get(path)
        if info is None:
            raise SystemExit(f"{repo}: missing file {path}")
        sha256 = info["sha256"]
        if len(sha256) != 64:
            # Small non-LFS files carry no upstream sha256; hash them locally.
            if info["size"] > _MAX_INLINE_HASH_BYTES:
                raise SystemExit(
                    f"{repo}: {path} is not LFS-backed and too large to hash inline"
                )
            _, sha256 = _download_sha256(_hf_resolve_url(repo, path))
        entry = _asset(path, info["size"], sha256)
        if targets:
            entry["target"] = targets.get(path, path.rsplit("/", 1)[-1])
        bundle.append(entry)
    return bundle


def _model_total(models: dict[str, dict[str, Any]]) -> None:
    for model_id, entry in models.items():
        entry["totalBytes"] = sum(int(asset["size"]) for asset in entry["assets"])


# --------------------------------------------------------------- the models --


def _paddleocr_models(verify: bool) -> dict[str, dict[str, Any]]:
    modelscope = _modelscope_assets()
    models: dict[str, dict[str, Any]] = {}
    for model_id, (upstream, dictionary) in PADDLEOCR_MODELS.items():
        paths = [
            DETECTOR_PATH,
            f"onnx/PP-OCRv5/rec/{upstream}.onnx",
            f"paddle/PP-OCRv5/rec/{upstream}/{dictionary}",
        ]
        assets = []
        for path in paths:
            info = modelscope.get(path)
            if info is None:
                raise SystemExit(f"modelscope manifest is missing {path}")
            assets.append(_asset(path, info["size"], info["sha256"]))
        models[model_id] = {"assets": assets}
    _model_total(models)
    return models


def _inpainting_models(verify: bool) -> dict[str, dict[str, Any]]:
    from models.inpainting.registry import INPAINT_MODEL_SPECS

    models: dict[str, dict[str, Any]] = {}
    for key, spec in INPAINT_MODEL_SPECS.items():
        bundle = _hf_bundle(
            spec.repo,
            [spec.target_file],
            verify=verify,
        )
        for asset in bundle:
            asset["sha256"] = spec.sha256
        models[key] = {"assets": bundle}
    _model_total(models)
    return models


def _translation_models(verify: bool) -> dict[str, dict[str, Any]]:
    from models.translation.local_storage import _LOCAL_TRANSLATION_MODELS

    models: dict[str, dict[str, Any]] = {}
    for model_id, source in _LOCAL_TRANSLATION_MODELS.items():
        files = [str(item).strip() for item in source["files"]]
        models[model_id] = {"assets": _hf_bundle(str(source["repo"]), files, verify=verify)}
    _model_total(models)
    return models


def _pororo_models(verify: bool) -> dict[str, dict[str, Any]]:
    from models.ocr.pororo.storage import _REQUIRED_FILES

    bundle = []
    for filename, source in _REQUIRED_FILES.items():
        url = str(source["url"])
        path = url.rsplit("/", 1)[-1]
        repo = url.split("/huggingface.co/", 1)[-1].split("/resolve/", 1)[0]
        asset = _hf_bundle(repo, [path], verify=verify)[0]
        asset["sha256"] = str(source["sha256"])
        bundle.append(asset)
    models = {"pororo": {"assets": bundle}}
    _model_total(models)
    return models


def _detection_models(verify: bool) -> dict[str, dict[str, Any]]:
    from models.detection.storage import _DETECTION_MODEL_SOURCES

    models: dict[str, dict[str, Any]] = {}
    for model_id, source in _DETECTION_MODEL_SOURCES.items():
        kind = source.get("kind")
        if kind == "hf_bundle":
            repo = str(source["repo"])
            files = [str(item) for item in source.get("files", [])]
            models[model_id] = {"assets": _hf_bundle(repo, files, verify=verify)}
            continue
        url = str(source["urls"][0])
        name = url.rsplit("/", 1)[-1]
        asset: dict[str, Any] = {}
        if "github.com" in url:
            info = _github_asset(url)
            size = int(info["size"])
            sha256 = ""
            if verify:
                _, sha256 = _download_sha256(str(info["url"]))
            asset = _asset(url.rsplit("/", 1)[-1], size, sha256, url=str(info["url"]))
        else:
            repo = url.split("/huggingface.co/", 1)[-1].split("/resolve/", 1)[0]
            asset = _hf_bundle(repo, [name], verify=verify)[0]
        asset["sha256"] = str(source.get("sha256") or asset.get("sha256") or "")
        models[model_id] = {"assets": [asset]}
    _model_total(models)
    return models


def _transformers_vlm_models(verify: bool) -> dict[str, dict[str, Any]]:
    from models.ocr.transformers_vlm.storage import _TRANSFORMERS_VLM_MODEL_SOURCES

    models: dict[str, dict[str, Any]] = {}
    for model_id, spec in _TRANSFORMERS_VLM_MODEL_SOURCES.items():
        models[model_id] = {
            "assets": _hf_bundle(spec.repo, list(spec.files), verify=verify)
        }
    _model_total(models)
    return models


def _easyocr_models(verify: bool) -> dict[str, dict[str, Any]]:
    """EasyOCR ships its assets as GitHub release zips.

    The URLs and the file name inside each zip come from the installed easyocr
    package, which owns that manifest; this script only resolves their sizes
    and digests.
    """
    from easyocr.config import detection_models, recognition_models

    from models.ocr.easyocr.storage import _EASYOCR_BUCKETS

    supported = {
        str(bucket["recognition_file"]) for bucket in _EASYOCR_BUCKETS.values()
    }
    detection_filename = _EASYOCR_BUCKETS and next(
        iter(spec["filename"] for spec in detection_models.values())
    )

    specs: dict[str, dict[str, Any]] = {}
    for generation in ("gen1", "gen2"):
        for spec in recognition_models[generation].values():
            if str(spec["filename"]) in supported:
                specs[str(spec["filename"])] = spec
    for spec in detection_models.values():
        if str(spec["filename"]) == detection_filename:
            specs[str(spec["filename"])] = spec

    def resolve(spec: dict[str, Any]) -> dict[str, Any]:
        url = str(spec["url"])
        info = _github_asset(url)
        sha256 = ""
        if verify:
            _, sha256 = _download_sha256(str(info["url"]))
        return _asset(
            url.rsplit("/", 1)[-1],
            int(info["size"]),
            sha256,
            url=str(info["url"]),
            target=str(spec["filename"]),
        )

    detection = resolve(specs[detection_filename])
    languages = {
        filename: resolve(spec)
        for filename, spec in sorted(specs.items())
        if filename != detection_filename
    }
    return {
        "easyocr": {
            "detection": detection,
            "languages": languages,
            "totalBytes": int(detection["size"]),
        }
    }


BUILDERS = (
    ("paddleocr", _paddleocr_models),
    ("inpainting", _inpainting_models),
    ("translation", _translation_models),
    ("pororo", _pororo_models),
    ("detection", _detection_models),
    ("transformers_vlm", _transformers_vlm_models),
    ("easyocr", _easyocr_models),
)


def build_snapshot(*, verify: bool) -> dict[str, object]:
    models: dict[str, Any] = {}
    for _group, builder in BUILDERS:
        models.update(builder(verify))
    return {
        "sources": {
            "huggingface": {"api": HF_TREE_API, "revision": HF_REVISION},
            "modelscope": {"api": MODELSCOPE_API, "repo": MODELSCOPE_REPO},
            "github": {"api": GITHUB_RELEASE_API},
        },
        "models": models,
    }


def serialize(snapshot: dict[str, object]) -> str:
    return json.dumps(snapshot, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


# ----------------------------------------------------------- registry sizes --

REGISTRY_FILES = (
    BACKEND_ROOT.parent / "interface" / "src" / "models" / "translation-text-model-registry-data.ts",
    BACKEND_ROOT.parent / "interface" / "src" / "models" / "translation-image-model-registry-data.ts",
)


def human_size(total_bytes: int) -> str:
    """Binary size string, the unit the registry and its parser use."""
    value = float(total_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024 or unit == "GB":
            return f"{value:.2f}{unit}" if unit != "B" else f"{int(value)}B"
        value /= 1024
    return f"{value:.2f}GB"


def _registry_total(snapshot: dict[str, object], model_id: str) -> int | None:
    models = snapshot.get("models")
    if not isinstance(models, dict):
        return None
    entry = models.get(model_id)
    if not isinstance(entry, dict):
        return None
    total = entry.get("totalBytes")
    return int(total) if isinstance(total, int) else None


def registry_size_drift(snapshot: dict[str, object]) -> list[str]:
    """Registry entries whose declared size no longer matches the manifest.

    The registry stays a human-readable source: this check is what keeps it
    honest, and CI fails on a drift instead of a generator rewriting source.
    """
    drifted: list[str] = []
    for path in REGISTRY_FILES:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for match in re.finditer(r'id: "([^"]+)"', text):
            model_id = match.group(1)
            total = _registry_total(snapshot, model_id)
            if total is None:
                continue
            end = text.find("\n  },", match.end())
            if end < 0:
                continue
            block = text[match.end():end]
            declared = re.search(r'fileSize: "([^"]*)"', block)
            if declared and not _same_size(declared.group(1), human_size(total)):
                drifted.append(
                    f"{path.name}: {model_id} declares {declared.group(1)}, "
                    f"upstream says {human_size(total)}"
                )
    return drifted


def _same_size(current: str, size: str) -> bool:
    """True when both strings describe the same magnitude."""
    def to_bytes(raw: str) -> int:
        match = re.match(r"^\s*([\d.]+)\s*([KMGT]?B)\s*$", raw, re.IGNORECASE)
        if not match:
            return -1
        units = {"B": 1, "KB": 1024, "MB": 1024 ** 2, "GB": 1024 ** 3, "TB": 1024 ** 4}
        return int(float(match.group(1)) * units[match.group(2).upper()])

    current_bytes = to_bytes(current)
    size_bytes = to_bytes(size)
    if current_bytes < 0 or size_bytes < 0:
        return False
    return abs(current_bytes - size_bytes) <= max(1024, size_bytes * 0.02)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail when the snapshot drifted")
    parser.add_argument("--verify", action="store_true", help="re-download and hash every asset")
    args = parser.parse_args()

    snapshot = build_snapshot(verify=args.verify)
    payload = serialize(snapshot)

    if args.check:
        if not SNAPSHOT_PATH.exists():
            print(f"missing snapshot: {SNAPSHOT_PATH}")
            return 1
        current = SNAPSHOT_PATH.read_text(encoding="utf-8")
        if current != payload:
            print(f"model asset manifest drifted: {SNAPSHOT_PATH}")
            print("run: python packages/mini-backend/scripts/generate_model_asset_manifest.py")
            return 1
        drifted = registry_size_drift(snapshot)
        if drifted:
            print("registry sizes drifted from the manifest:")
            for line in drifted:
                print(f"  {line}")
            return 1
        print(f"model asset manifest is up to date: {SNAPSHOT_PATH}")
        print("registry sizes match the manifest")
        return 0

    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PATH.write_text(payload, encoding="utf-8", newline="\n")
    drifted = registry_size_drift(snapshot)
    if drifted:
        print("registry entries to update:")
        for line in drifted:
            print(f"  {line}")
    models = snapshot["models"]
    assert isinstance(models, dict)
    for model_id, entry in models.items():
        print(f"{model_id}: {entry['totalBytes']} bytes")
    print(f"wrote {SNAPSHOT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

