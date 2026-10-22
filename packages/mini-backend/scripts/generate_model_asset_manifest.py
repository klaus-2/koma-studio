"""Generate the canonical model-asset manifest for the backend-managed models.

Every asset the Python backend installs is declared ONCE here: its path inside
the upstream tree, its real byte size and its sha256. The install manifests are
built from this file, so a size can never drift away from the digest that
protects it.

Sources (both unauthenticated):
  * ModelScope  GET /api/v1/models/{repo}/repo/files?Revision={rev}&Root={leaf}
                -> Data.Files[].Size + Data.Files[].Sha256 (covers the plain-text
                dictionaries too)
  * HuggingFace GET /api/models/{repo}/tree/{rev}?recursive=true
                -> size for every file; lfs.oid is the sha256 for LFS files only
                (the dictionaries are git-SHA1 there, so ModelScope is the
                sha256 source for them)

Usage:
    python generate_model_asset_manifest.py            # write the snapshot
    python generate_model_asset_manifest.py --check    # fail if the snapshot drifted
    python generate_model_asset_manifest.py --verify   # also re-download and hash every asset
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND_ROOT = HERE.parent
SNAPSHOT_PATH = BACKEND_ROOT / "models" / "manifests" / "model-assets.json"

MODELSCOPE_API = "https://www.modelscope.cn/api/v1/models/{repo}/repo/files"
MODELSCOPE_REPO = "RapidAI/RapidOCR"
MODELSCOPE_REVISION = "v3.4.0"
HF_TREE_API = "https://huggingface.co/api/models/{repo}/tree/{rev}"
HF_REPO = "pitapo/rapidocr"
HF_REVISION = "main"

USER_AGENT = "koma-studio-model-manifest/1.0"
TIMEOUT_SECONDS = 120

DETECTOR_PATH = "onnx/PP-OCRv5/det/ch_PP-OCRv5_mobile_det.onnx"

# model id -> (recognizer upstream name, dictionary file name)
PADDLEOCR_MODELS: dict[str, tuple[str, str]] = {
    "paddleocr": ("eslav_PP-OCRv5_rec_mobile_infer", "ppocrv5_eslav_dict.txt"),
    "paddleocr_latin_v5": ("latin_PP-OCRv5_rec_mobile_infer", "ppocrv5_latin_dict.txt"),
    "paddleocr_ch_v5": ("ch_PP-OCRv5_rec_mobile_infer", "ppocrv5_dict.txt"),
    "paddleocr_en_v5": ("en_PP-OCRv5_rec_mobile_infer", "ppocrv5_en_dict.txt"),
}


def _get_json(url: str) -> object:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def _download_sha256(url: str) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        while chunk := response.read(1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
    return size, digest.hexdigest()


def _modelscope_files() -> dict[str, tuple[int, str]]:
    """path -> (size, sha256) for every asset of the ModelScope repo."""
    resolved: dict[str, tuple[int, str]] = {}
    roots = {
        "onnx/PP-OCRv5/det",
        "onnx/PP-OCRv5/rec",
        "paddle/PP-OCRv5/rec/eslav_PP-OCRv5_rec_mobile_infer",
        "paddle/PP-OCRv5/rec/latin_PP-OCRv5_rec_mobile_infer",
        "paddle/PP-OCRv5/rec/ch_PP-OCRv5_rec_mobile_infer",
        "paddle/PP-OCRv5/rec/en_PP-OCRv5_rec_mobile_infer",
    }
    for root in sorted(roots):
        url = (
            f"{MODELSCOPE_API.format(repo=MODELSCOPE_REPO)}"
            f"?Revision={MODELSCOPE_REVISION}&Root={root}"
        )
        payload = _get_json(url)
        files = payload.get("Data", {}).get("Files", []) if isinstance(payload, dict) else []
        for entry in files:
            if entry.get("Type") != "blob":
                continue
            path = str(entry.get("Path") or "")
            sha = str(entry.get("Sha256") or "").lower()
            size = int(entry.get("Size") or 0)
            if not path or not sha or size <= 0:
                raise SystemExit(f"modelscope manifest entry is incomplete: {entry!r}")
            resolved[path] = (size, sha)
    return resolved


def _huggingface_tree() -> dict[str, int]:
    """path -> size for every file of the HuggingFace mirror."""
    url = HF_TREE_API.format(repo=HF_REPO, rev=HF_REVISION) + "?recursive=true"
    payload = _get_json(url)
    if not isinstance(payload, list):
        raise SystemExit(f"unexpected huggingface tree payload: {payload!r}")
    return {
        str(entry.get("path") or ""): int(entry.get("size") or 0)
        for entry in payload
        if entry.get("type") == "file" and entry.get("size")
    }


def build_snapshot(*, verify: bool) -> dict[str, object]:
    modelscope = _modelscope_files()
    huggingface = _huggingface_tree()

    models: dict[str, object] = {}
    for model_id, (upstream, dictionary) in PADDLEOCR_MODELS.items():
        paths = [
            DETECTOR_PATH,
            f"onnx/PP-OCRv5/rec/{upstream}.onnx",
            f"paddle/PP-OCRv5/rec/{upstream}/{dictionary}",
        ]
        assets = []
        total = 0
        for path in paths:
            if path not in modelscope:
                raise SystemExit(f"missing in the modelscope manifest: {path}")
            size, sha = modelscope[path]
            mirror_size = huggingface.get(path)
            if mirror_size is None:
                raise SystemExit(f"missing on the huggingface mirror: {path}")
            if mirror_size != size:
                raise SystemExit(
                    f"mirror size differs for {path}: modelscope={size} mirror={mirror_size}"
                )
            if verify:
                _, downloaded_sha = _download_sha256(
                    f"https://huggingface.co/{HF_REPO}/resolve/{HF_REVISION}/{path}"
                )
                if downloaded_sha != sha:
                    raise SystemExit(
                        f"mirror digest differs for {path}: expected={sha} got={downloaded_sha}"
                    )
            assets.append({"path": path, "size": size, "sha256": sha})
            total += size
        models[model_id] = {"totalBytes": total, "assets": assets}

    return {
        "sources": {
            "modelscope": {
                "repo": MODELSCOPE_REPO,
                "revision": MODELSCOPE_REVISION,
                "api": MODELSCOPE_API,
            },
            "huggingface": {
                "repo": HF_REPO,
                "revision": HF_REVISION,
                "api": HF_TREE_API,
            },
        },
        "models": models,
    }


def serialize(snapshot: dict[str, object]) -> str:
    return json.dumps(snapshot, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


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
        print(f"model asset manifest is up to date: {SNAPSHOT_PATH}")
        return 0

    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PATH.write_text(payload, encoding="utf-8", newline="\n")
    models = snapshot["models"]
    assert isinstance(models, dict)
    for model_id, entry in models.items():
        print(f"{model_id}: {entry['totalBytes']} bytes")
    print(f"wrote {SNAPSHOT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
