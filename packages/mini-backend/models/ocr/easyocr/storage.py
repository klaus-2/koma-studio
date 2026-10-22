from __future__ import annotations

from pathlib import Path
import os
import shutil
import zipfile
from typing import Sequence

from core.hf_download import download_file, progress_bridge_var
from core.languages import normalize_language_code
from models.manifests import model_entry


_MODEL_ROOT_ENV = "KOMA_MODELS_ROOT"
_EASYOCR_SUBDIR = "easyocr-cache"
_EASYOCR_DETECTION_FILE = "craft_mlt_25k.pth"
_EASYOCR_LANGUAGE_MAP: dict[str, str] = {
    "ko": "ko",
    "ja": "ja",
    "zh": "ch_sim",
    "zh-cn": "ch_sim",
    "zh-tw": "ch_tra",
    "en": "en",
    "ru": "ru",
    "fr": "fr",
    "de": "de",
    "nl": "nl",
    "es": "es",
    "it": "it",
    "tr": "tr",
    "pl": "pl",
    "pt": "pt",
    "pt-br": "pt",
    "th": "th",
    "vi": "vi",
    "id": "id",
    "hu": "hu",
    "ar": "ar",
}
_EASYOCR_BUCKETS: dict[str, dict[str, object]] = {
    "en": {
        "languages": {"en"},
        "recognition_file": "english_g2.pth",
    },
    "ko": {
        "languages": {"ko"},
        "recognition_file": "korean_g2.pth",
    },
    "ja": {
        "languages": {"ja"},
        "recognition_file": "japanese_g2.pth",
    },
    "ch_sim": {
        "languages": {"ch_sim"},
        "recognition_file": "chinese_sim.pth",
    },
    "ch_tra": {
        "languages": {"ch_tra"},
        "recognition_file": "chinese.pth",
    },
    "ru": {
        "languages": {"ru"},
        "recognition_file": "cyrillic_g2.pth",
    },
    "latin": {
        "languages": {"fr", "de", "nl", "es", "it", "pt", "tr", "pl", "vi", "id", "hu"},
        "recognition_file": "latin_g2.pth",
    },
    "th": {
        "languages": {"th"},
        "recognition_file": "thai.pth",
    },
    "ar": {
        "languages": {"ar"},
        "recognition_file": "arabic.pth",
    },
}


def resolve_easyocr_models_root() -> Path | None:
    raw_root = os.getenv(_MODEL_ROOT_ENV, "").strip()
    if not raw_root:
        return None

    root = Path(raw_root).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root / "easyocr"


def resolve_easyocr_bucket_id(language: str | None) -> str:
    normalized = str(language or "").strip().lower()
    for bucket_id, bucket in _EASYOCR_BUCKETS.items():
        languages = bucket["languages"]
        if isinstance(languages, set) and normalized in languages:
            return bucket_id
    return "en"


def resolve_easyocr_supported_languages() -> list[str]:
    languages = sorted(
        {
            language
            for bucket in _EASYOCR_BUCKETS.values()
            for language in bucket["languages"]
            if isinstance(language, str)
        },
    )
    try:
        from easyocr.config import all_lang_list  # type: ignore
    except Exception:
        return languages

    supported = set(all_lang_list)
    return [language for language in languages if language in supported]


def resolve_easyocr_languages_for_source(language: str | None) -> list[str]:
    normalized = normalize_language_code(language, default="en", allow_auto=False)
    mapped = _EASYOCR_LANGUAGE_MAP.get(normalized, "en")
    return [mapped]


def _normalize_languages(languages: Sequence[str] | None) -> list[str]:
    normalized = list(dict.fromkeys([str(item).strip() for item in (languages or []) if str(item).strip()]))
    return normalized or ["en"]


def _resolve_bucket_dir(bucket_id: str, create: bool = True) -> Path | None:
    models_root = resolve_easyocr_models_root()
    if models_root is None:
        return None

    storage_dir = models_root / _EASYOCR_SUBDIR / bucket_id
    if create:
        storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir


def _resolve_legacy_storage_dir(create: bool = True) -> Path | None:
    models_root = resolve_easyocr_models_root()
    if models_root is None:
        return None

    storage_dir = models_root / _EASYOCR_SUBDIR
    if create:
        storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir


def resolve_easyocr_storage_dir(
    languages: Sequence[str] | None = None,
    *,
    prefer_legacy_if_ready: bool = True,
    create: bool = True,
) -> Path | None:
    if not languages:
        return _resolve_legacy_storage_dir(create=create)

    normalized_languages = _normalize_languages(languages)
    language = normalized_languages[0]
    bucket_id = resolve_easyocr_bucket_id(language)
    bucket_dir = _resolve_bucket_dir(bucket_id, create=create)

    if prefer_legacy_if_ready and _storage_dir_ready(_resolve_legacy_storage_dir(create=False), language):
        return _resolve_legacy_storage_dir(create=create)
    return bucket_dir


def _resolve_recognition_file(language: str) -> str:
    bucket_id = resolve_easyocr_bucket_id(language)
    bucket = _EASYOCR_BUCKETS.get(bucket_id, _EASYOCR_BUCKETS["en"])
    recognition_file = bucket["recognition_file"]
    return str(recognition_file)


def _required_files_for_language(language: str) -> tuple[str, str]:
    return _EASYOCR_DETECTION_FILE, _resolve_recognition_file(language)


def _easyocr_manifest_assets(language: str) -> list[dict[str, object]]:
    """Manifest entries for the detection and recognition assets of a language.

    The manifest owns the sizes and digests; the installed easyocr package owns
    the URLs and the file names, so neither side duplicates the other.
    """
    entry = model_entry("easyocr")
    if entry is None:
        raise RuntimeError("The model asset manifest does not describe easyocr.")
    detection = entry.get("detection")
    languages = entry.get("languages")
    if not isinstance(detection, dict) or not isinstance(languages, dict):
        raise RuntimeError("The model asset manifest is missing the easyocr assets.")
    recognition = languages.get(_resolve_recognition_file(language))
    if not isinstance(recognition, dict):
        raise RuntimeError(
            f"The model asset manifest does not describe the easyocr assets for {language!r}."
        )
    return [detection, recognition]


def _install_easyocr_asset(asset: dict[str, object], storage_dir: Path) -> None:
    """Download one EasyOCR release archive and extract the model file.

    EasyOCR's own downloader has no progress hooks and cannot be cancelled, so
    the archive is fetched here — with resume, a size check and a digest check
    — and the model file is extracted from it.
    """
    target = storage_dir / str(asset["target"])
    if target.is_file():
        return

    archive = storage_dir / f"{target.name}.zip"
    download_file(
        str(asset["url"]),
        archive,
        max_retries=3,
        expected_size=int(asset["size"]),
        expected_sha256=str(asset["sha256"]) or None,
    )
    try:
        with zipfile.ZipFile(archive) as bundle:
            member = next(
                name for name in bundle.namelist()
                if name.rsplit("/", 1)[-1] == target.name
            )
            with bundle.open(member) as source, target.open("wb") as sink:
                shutil.copyfileobj(source, sink)
    finally:
        archive.unlink(missing_ok=True)


def _storage_dir_ready(storage_dir: Path | None, language: str) -> bool:
    if storage_dir is None or not storage_dir.exists():
        return False
    required_files = _required_files_for_language(language)
    return all((storage_dir / file_name).is_file() for file_name in required_files)


def easyocr_runtime_ready(languages: Sequence[str] | None = None) -> bool:
    requested_languages = _normalize_languages(languages)
    return all(
        _storage_dir_ready(resolve_easyocr_storage_dir([language], create=False), language)
        for language in requested_languages
    )


def ensure_easyocr_models_installed(
    languages: Sequence[str],
    use_gpu: bool,
) -> dict[str, object]:
    models_root = resolve_easyocr_models_root()
    if models_root is None:
        raise RuntimeError(
            "KOMA_MODELS_ROOT is not configured for managed EasyOCR installs.",
        )

    try:
        import easyocr  # type: ignore
    except Exception as exc:  # pragma: no cover - optional dependency
        raise RuntimeError("easyocr is not installed in the local environment.") from exc

    normalized_languages = _normalize_languages(languages)
    installed_languages: list[str] = []

    for language in normalized_languages:
        storage_dir = resolve_easyocr_storage_dir([language], prefer_legacy_if_ready=False, create=True)
        if storage_dir is None:
            raise RuntimeError("EasyOCR storage directory is unavailable.")

        if not _storage_dir_ready(storage_dir, language):
            assets = _easyocr_manifest_assets(language)
            bridge = progress_bridge_var.get()
            if bridge is not None:
                bridge.declare_total(sum(int(asset["size"]) for asset in assets))
            for asset in assets:
                _install_easyocr_asset(asset, storage_dir)

        reader_kwargs: dict[str, object] = {
            "gpu": use_gpu,
            "model_storage_directory": str(storage_dir),
            # The assets are already on disk, verified and size-checked.
            "download_enabled": False,
            "verbose": False,
        }
        easyocr.Reader([language], **reader_kwargs)

        if _storage_dir_ready(storage_dir, language):
            installed_languages.append(language)

    storage_root = _resolve_legacy_storage_dir(create=True)
    if storage_root is None:
        raise RuntimeError("EasyOCR root directory is unavailable.")

    files = sorted(
        [
            str(path.relative_to(storage_root)).replace("\\", "/")
            for path in storage_root.rglob("*")
            if path.is_file()
        ],
    )

    return {
        "directory": str(storage_root),
        "fileCount": len(files),
        "files": files,
        "languages": sorted(set(installed_languages)),
    }
