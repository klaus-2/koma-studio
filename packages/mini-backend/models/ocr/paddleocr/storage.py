from __future__ import annotations

from pathlib import Path
from typing import Any

from core.hf_download import download_file, sha256_file
from core.models_store import resolve_model_dir


_PADDLE_MODEL_FILES: dict[str, list[dict[str, Any]]] = {
    "paddleocr": [
        {
            "target": "ch_PP-OCRv5_mobile_det.onnx",
            "sha256": "4d97c44a20d30a81aad087d6a396b08f786c4635742afc391f6621f5c6ae78ae",
            "urls": [
                "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0/onnx/PP-OCRv5/det/ch_PP-OCRv5_mobile_det.onnx",
                "https://huggingface.co/monkt/paddleocr-onnx/resolve/main/detection/v5/det.onnx",
            ],
        },
        {
            "target": "eslav_PP-OCRv5_rec_mobile_infer.onnx",
            "sha256": "08705d6721849b1347d26187f15a5e362c431963a2a62bfff4feac578c489aab",
            "urls": [
                "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0/onnx/PP-OCRv5/rec/eslav_PP-OCRv5_rec_mobile_infer.onnx",
                "https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/eslav/rec.onnx",
            ],
        },
        {
            "target": "ppocrv5_eslav_dict.txt",
            "sha256": "",
            "urls": [
                "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0/paddle/PP-OCRv5/rec/eslav_PP-OCRv5_rec_mobile_infer/ppocrv5_eslav_dict.txt",
                "https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/eslav/dict.txt",
            ],
        },
    ],
    "paddleocr_latin_v5": [
        {
            "target": "ch_PP-OCRv5_mobile_det.onnx",
            "sha256": "4d97c44a20d30a81aad087d6a396b08f786c4635742afc391f6621f5c6ae78ae",
            "urls": [
                "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0/onnx/PP-OCRv5/det/ch_PP-OCRv5_mobile_det.onnx",
                "https://huggingface.co/monkt/paddleocr-onnx/resolve/main/detection/v5/det.onnx",
            ],
        },
        {
            "target": "latin_PP-OCRv5_rec_mobile_infer.onnx",
            "sha256": "b20bd37c168a570f583afbc8cd7925603890efbcdc000a59e22c269d160b5f5a",
            "urls": [
                "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0/onnx/PP-OCRv5/rec/latin_PP-OCRv5_rec_mobile_infer.onnx",
                "https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/latin/rec.onnx",
            ],
        },
        {
            "target": "ppocrv5_latin_dict.txt",
            "sha256": "",
            "urls": [
                "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0/paddle/PP-OCRv5/rec/latin_PP-OCRv5_rec_mobile_infer/ppocrv5_latin_dict.txt",
                "https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/latin/dict.txt",
            ],
        },
    ],
    "paddleocr_ch_v5": [
        {
            "target": "ch_PP-OCRv5_mobile_det.onnx",
            "sha256": "4d97c44a20d30a81aad087d6a396b08f786c4635742afc391f6621f5c6ae78ae",
            "urls": [
                "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0/onnx/PP-OCRv5/det/ch_PP-OCRv5_mobile_det.onnx",
                "https://huggingface.co/monkt/paddleocr-onnx/resolve/main/detection/v5/det.onnx",
            ],
        },
        {
            "target": "ch_PP-OCRv5_rec_mobile_infer.onnx",
            "sha256": "5825fc7ebf84ae7a412be049820b4d86d77620f204a041697b0494669b1742c5",
            "urls": [
                "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0/onnx/PP-OCRv5/rec/ch_PP-OCRv5_rec_mobile_infer.onnx",
                "https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/chinese/rec.onnx",
            ],
        },
        {
            "target": "ppocrv5_dict.txt",
            "sha256": "",
            "urls": [
                "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0/paddle/PP-OCRv5/rec/ch_PP-OCRv5_rec_mobile_infer/ppocrv5_dict.txt",
                "https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/chinese/dict.txt",
            ],
        },
    ],
    "paddleocr_en_v5": [
        {
            "target": "ch_PP-OCRv5_mobile_det.onnx",
            "sha256": "4d97c44a20d30a81aad087d6a396b08f786c4635742afc391f6621f5c6ae78ae",
            "urls": [
                "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0/onnx/PP-OCRv5/det/ch_PP-OCRv5_mobile_det.onnx",
                "https://huggingface.co/monkt/paddleocr-onnx/resolve/main/detection/v5/det.onnx",
            ],
        },
        {
            "target": "en_PP-OCRv5_mobile_rec.onnx",
            "sha256": "c3461add59bb4323ecba96a492ab75e06dda42467c9e3d0c18db5d1d21924be8",
            "urls": [
                "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0/onnx/PP-OCRv5/rec/en_PP-OCRv5_rec_mobile_infer.onnx",
                "https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/english/rec.onnx",
            ],
        },
        {
            "target": "ppocrv5_en_dict.txt",
            "sha256": "",
            "urls": [
                "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0/paddle/PP-OCRv5/rec/en_PP-OCRv5_rec_mobile_infer/ppocrv5_en_dict.txt",
                "https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/english/dict.txt",
            ],
        },
    ],
}


def _required_files_for_model(model_id: str) -> list[dict[str, Any]]:
    key = (model_id or "").strip().lower()
    files = _PADDLE_MODEL_FILES.get(key)
    if not files:
        raise RuntimeError(f"Invalid PaddleOCR model for managed install: {model_id}")
    return files


def resolve_paddleocr_model_dir(model_id: str) -> Path | None:
    return resolve_model_dir(model_id.strip().lower())


def paddleocr_runtime_ready(model_id: str) -> bool:
    model_dir = resolve_paddleocr_model_dir(model_id)
    if model_dir is None:
        return False

    required = _required_files_for_model(model_id)
    return all((model_dir / str(item["target"])).exists() for item in required)


def _try_download_from_urls(urls: list[str], target_path: Path) -> str:
    last_error: Exception | None = None
    for url in urls:
        try:
            download_file(url, target_path, max_retries=3)
            return url
        except Exception as exc:
            last_error = exc
    raise RuntimeError(
        f"Failed to download '{target_path.name}' from every configured URL.",
    ) from last_error


def _ensure_required_file(
    *,
    storage_dir: Path,
    file_meta: dict[str, Any],
) -> dict[str, Any]:
    target_name = str(file_meta["target"])
    target_path = storage_dir / target_name
    expected_sha = str(file_meta.get("sha256") or "").strip().lower()
    urls = [str(url).strip() for url in file_meta.get("urls", []) if str(url).strip()]
    if not urls:
        raise RuntimeError(f"Invalid URL configuration for '{target_name}'.")

    if target_path.exists():
        if expected_sha:
            existing_sha = sha256_file(target_path).lower()
            if existing_sha == expected_sha:
                return {
                    "target": target_name,
                    "source": "local-cache",
                    "sha256": existing_sha,
                    "downloaded": False,
                }
            target_path.unlink(missing_ok=True)
        else:
            return {
                "target": target_name,
                "source": "local-cache",
                "sha256": sha256_file(target_path),
                "downloaded": False,
            }

    source_url = _try_download_from_urls(urls, target_path)
    current_sha = sha256_file(target_path).lower()
    if expected_sha and current_sha != expected_sha:
        target_path.unlink(missing_ok=True)
        raise RuntimeError(
            f"Invalid SHA256 checksum for '{target_name}'. Expected: {expected_sha} | Got: {current_sha}",
        )

    return {
        "target": target_name,
        "source": source_url,
        "sha256": current_sha,
        "downloaded": True,
    }


def ensure_paddleocr_models_installed(model_id: str) -> dict[str, Any]:
    normalized_id = (model_id or "").strip().lower()
    required = _required_files_for_model(normalized_id)
    model_dir = resolve_paddleocr_model_dir(normalized_id)
    if model_dir is None:
        raise RuntimeError(
            "KOMA_MODELS_ROOT is not configured for managed PaddleOCR installs.",
        )

    model_dir.mkdir(parents=True, exist_ok=True)
    files_payload: list[dict[str, Any]] = []
    for file_meta in required:
        files_payload.append(_ensure_required_file(storage_dir=model_dir, file_meta=file_meta))

    return {
        "modelId": normalized_id,
        "directory": str(model_dir),
        "fileCount": len(files_payload),
        "files": files_payload,
    }
