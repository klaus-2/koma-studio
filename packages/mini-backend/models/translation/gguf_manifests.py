"""User-supplied GGUF translation models ("bring your own weights").

A manifest is a small JSON file that names `.gguf` files already present under
`KOMA_MODELS_ROOT/<model_id>/`. Builtin models stay in
`local_gguf.GGUF_MODEL_CONFIGS`; this module only adds user entries on top.

Schema (version 1):

    {
      "version": 1,
      "models": [
        {
          "id": "my-sakura",
          "name": "My Sakura 7B",
          "file": "my-sakura-q5.gguf",
          "source_languages": ["ja"],
          "target_languages": ["en", "pt"],
          "n_ctx": 4096,
          "n_gpu_layers": -1
        }
      ]
    }

Invalid entries are skipped with a warning: a broken manifest must never stop
the backend from listing the builtin models.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path

from core.models_store import is_valid_model_id, resolve_model_dir, resolve_models_root

logger = logging.getLogger(__name__)

MANIFEST_ENV = "KOMA_GGUF_MANIFESTS"
MANIFEST_FILENAME = "gguf-manifests.json"
MANIFEST_VERSION = 1
MAX_CUSTOM_GGUF_MODELS = 32
MAX_NAME_CHARS = 120
MAX_FILE_CHARS = 200
MAX_LANGUAGES = 64
DEFAULT_N_CTX = 2048
MIN_N_CTX = 256
MAX_N_CTX = 32768
DEFAULT_N_GPU_LAYERS = -1
MIN_N_GPU_LAYERS = -1
MAX_N_GPU_LAYERS = 512


@dataclass(frozen=True, slots=True)
class GGUFModelConfig:
    gguf_file: str
    source_languages: frozenset[str]
    target_languages: frozenset[str]
    n_ctx: int = DEFAULT_N_CTX
    n_gpu_layers: int = DEFAULT_N_GPU_LAYERS
    # Display name for user models; builtin entries leave it empty and the
    # registry keeps its own curated names.
    name: str = ""


@dataclass(frozen=True, slots=True)
class _CacheEntry:
    path: Path
    mtime_ns: int
    configs: dict[str, GGUFModelConfig]


_CACHE: _CacheEntry | None = None


def clear_gguf_manifest_cache() -> None:
    """Drop the parsed manifest so the next call re-reads the file."""
    global _CACHE
    _CACHE = None


def resolve_manifest_path() -> Path | None:
    """`KOMA_GGUF_MANIFESTS` wins; otherwise `<models root>/gguf-manifests.json`.

    A relative env path resolves against the process working directory, the
    same way `KOMA_MODELS_ROOT` does.
    """
    raw = os.getenv(MANIFEST_ENV, "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    root = resolve_models_root()
    if root is None:
        return None
    return root / MANIFEST_FILENAME


def load_custom_gguf_configs() -> dict[str, GGUFModelConfig]:
    """Parse the manifest, cached until the file's mtime changes."""
    global _CACHE
    path = resolve_manifest_path()
    if path is None:
        return {}
    try:
        mtime_ns = path.stat().st_mtime_ns
    except OSError:
        return {}
    if _CACHE is not None and _CACHE.path == path and _CACHE.mtime_ns == mtime_ns:
        return _CACHE.configs
    configs = _read_manifest(path)
    _CACHE = _CacheEntry(path=path, mtime_ns=mtime_ns, configs=configs)
    return configs


def custom_gguf_ready(model_id: str) -> bool:
    """True when the manifest's `.gguf` exists under the models root.

    Deliberately does **not** require `manifest.json`/`model_is_installed`:
    these files are copied in by the user, not installed by the downloader.
    """
    config = load_custom_gguf_configs().get(model_id)
    if config is None:
        return False
    model_dir = resolve_model_dir(model_id)
    if model_dir is None:
        return False
    return (model_dir / config.gguf_file).is_file()


def _as_dict(value: object) -> dict[str, object] | None:
    if not isinstance(value, dict):
        return None
    return {str(key): item for key, item in value.items()}


def _read_manifest(path: Path) -> dict[str, GGUFModelConfig]:
    try:
        payload: object = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError):
        logger.warning(
            "translation.custom_gguf.unreadable_manifest", extra={"path": str(path)}
        )
        return {}

    raw = _as_dict(payload)
    if raw is None:
        logger.warning(
            "translation.custom_gguf.invalid_root", extra={"path": str(path)}
        )
        return {}

    if raw.get("version") != MANIFEST_VERSION:
        logger.warning(
            "translation.custom_gguf.unsupported_version",
            extra={"path": str(path), "version": raw.get("version")},
        )
        return {}

    entries = raw.get("models")
    if not isinstance(entries, list):
        logger.warning(
            "translation.custom_gguf.missing_models", extra={"path": str(path)}
        )
        return {}

    configs: dict[str, GGUFModelConfig] = {}
    for entry in entries[:MAX_CUSTOM_GGUF_MODELS]:
        parsed = _parse_entry(entry)
        if parsed is None:
            continue
        model_id, config = parsed
        if model_id in configs:
            logger.warning(
                "translation.custom_gguf.duplicate_id", extra={"model_id": model_id}
            )
            continue
        configs[model_id] = config

    if len(entries) > MAX_CUSTOM_GGUF_MODELS:
        logger.warning(
            "translation.custom_gguf.truncated",
            extra={"count": len(entries), "kept": MAX_CUSTOM_GGUF_MODELS},
        )
    return configs


def _parse_entry(entry: object) -> tuple[str, GGUFModelConfig] | None:
    raw = _as_dict(entry)
    if raw is None:
        logger.warning("translation.custom_gguf.entry_not_an_object")
        return None

    model_id = raw.get("id")
    if not isinstance(model_id, str):
        return None
    model_id = model_id.strip()
    # ids are already-normalized slugs by contract; `is_valid_model_id` also
    # lower-cases internally, so an uppercase id would register under a name
    # that no longer matches the manifest.
    if model_id != model_id.lower() or not is_valid_model_id(model_id):
        logger.warning(
            "translation.custom_gguf.invalid_id", extra={"model_id": model_id}
        )
        return None

    name = raw.get("name")
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > MAX_NAME_CHARS:
        logger.warning(
            "translation.custom_gguf.invalid_name", extra={"model_id": model_id}
        )
        return None

    file_name = raw.get("file")
    if not isinstance(file_name, str):
        return None
    file_name = file_name.strip()
    path = Path(file_name)
    if (
        not file_name.lower().endswith(".gguf")
        or len(file_name) > MAX_FILE_CHARS
        or path.is_absolute()
        or path.name != file_name
        or "/" in file_name
        or "\\" in file_name
    ):
        logger.warning(
            "translation.custom_gguf.invalid_file",
            extra={"model_id": model_id, "file": file_name},
        )
        return None

    sources = _parse_languages(raw.get("source_languages"))
    targets = _parse_languages(raw.get("target_languages"))
    if not sources or not targets:
        logger.warning(
            "translation.custom_gguf.invalid_languages", extra={"model_id": model_id}
        )
        return None

    return (
        model_id,
        GGUFModelConfig(
            gguf_file=file_name,
            source_languages=sources,
            target_languages=targets,
            n_ctx=_parse_int(raw.get("n_ctx"), DEFAULT_N_CTX, MIN_N_CTX, MAX_N_CTX),
            n_gpu_layers=_parse_int(
                raw.get("n_gpu_layers"),
                DEFAULT_N_GPU_LAYERS,
                MIN_N_GPU_LAYERS,
                MAX_N_GPU_LAYERS,
            ),
            name=name.strip(),
        ),
    )


def _parse_languages(value: object) -> frozenset[str]:
    if not isinstance(value, list):
        return frozenset()
    languages = {
        item.strip().lower()
        for item in value
        if isinstance(item, str) and item.strip()
    }
    if len(languages) > MAX_LANGUAGES:
        return frozenset()
    return frozenset(languages)


def _parse_int(value: object, default: int, minimum: int, maximum: int) -> int:
    # Bools are ints in Python; a manifest saying `"n_ctx": true` must not become
    # 1 (which would then clamp nothing and fail inside llama.cpp).
    if isinstance(value, bool) or not isinstance(value, int):
        return default
    if value < minimum or value > maximum:
        return default
    return value
