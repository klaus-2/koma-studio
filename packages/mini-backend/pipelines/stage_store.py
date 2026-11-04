"""Persistent segment/clean stage store — sqlite-backed disk cache (D3).

Persistence doctrine cloned from ``pipelines.translation_store``: one
connection (``check_same_thread=False``) behind one lock, WAL journal,
``PRAGMA user_version`` schema pin with a typed error on foreign versions,
prune at open, the file under ``KOMA_APP_DATA_DIR`` (dev fallback
``~/.koma-studio``, never under the models root), a ``@cache`` singleton
closed only at lifespan shutdown. Key doctrine cloned from
``pipelines.cache_manager``: version-pinned sha256 over canonical JSON;
images hashed with blake2b(32); blank/empty results are never cached.

Image-hash basis (decided — do not re-derive): ``run_segment_stage`` receives
raw image bytes, so its keys hash the bytes via ``hash_image_bytes``. The
orchestrator hands ``run_clean_stage`` the DECODED image (``image=``, not
bytes), so clean keys hash the decoded RGB array via ``hash_image_array`` —
blake2b(32) over ``rgb.tobytes()`` with shape and dtype folded into the
payload so the digest is stable across processes and shape-sensitive.

Documented deviation from the translation store's prune: besides the
newest-N-per-table retention, clean PNGs (~2-5 MB blobs, three orders larger
than translated texts) are bounded by a total-bytes cap, oldest-first — a
rows-only cap cannot bound disk growth. Entries whose serialized value
exceeds 32 MiB are skipped at write time; the put returns False (skipped).
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import asdict, dataclass
from functools import cache
import hashlib
import json
import logging
import os
from pathlib import Path
import sqlite3
import threading
import time

import numpy as np
from numpy.typing import NDArray

from utils.mask import MaskRegion

logger = logging.getLogger(__name__)

_SCHEMA_VERSION = 1
_DEFAULT_MAX_ROWS = 2_000
_DEFAULT_MAX_TOTAL_BYTES = 1 << 30  # 1 GiB of clean PNG bytes
_MAX_ENTRY_BYTES = 32 << 20  # 32 MiB per serialized entry

_CLEAN_SETTINGS_FIELDS: tuple[str, ...] = (
    "model_key",
    "mask_dilation",
    "hd_strategy",
    "hd_strategy_resize_limit",
    "hd_strategy_crop_margin",
    "hd_strategy_crop_trigger_size",
)

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS segment_cache (
    key TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    engine_key TEXT,
    created_at REAL
);
CREATE TABLE IF NOT EXISTS clean_cache (
    key TEXT PRIMARY KEY,
    png BLOB NOT NULL,
    meta TEXT NOT NULL,
    model_used TEXT,
    created_at REAL
);
"""


class StageStoreError(RuntimeError):
    """The on-disk store exists at a schema version this build cannot read."""


@dataclass(frozen=True)
class SegmentCacheHit:
    engine_key: str
    records: list[dict[str, object]]


@dataclass(frozen=True)
class CleanCacheHit:
    model_used: str
    png: bytes
    hd_strategy: str


# ----------------------------------------------------------------- key helpers


def _canonical_json(payload: object) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _sha256(canonical: str) -> str:
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def hash_image_bytes(image_bytes: bytes) -> str:
    # Identical doctrine to cache_manager._hash_image_bytes.
    return hashlib.blake2b(image_bytes, digest_size=32).hexdigest()


def hash_image_array(rgb: NDArray[np.uint8]) -> str:
    """blake2b(32) over the decoded array's bytes; shape+dtype in the payload."""
    payload: dict[str, object] = {
        "version": 1,
        "shape": list(rgb.shape),
        "dtype": str(rgb.dtype),
        "bytes_hash": hash_image_bytes(rgb.tobytes()),
    }
    return _sha256(_canonical_json(payload))


def fingerprint_seeds(seeds: Sequence[Mapping[str, object]]) -> str:
    """sha256 over the canonical JSON of the full seed dicts (order matters)."""
    payload = {"version": 1, "seeds": list(seeds)}
    return _sha256(_canonical_json(payload))


def fingerprint_mask_regions(regions: Sequence[MaskRegion]) -> str:
    """sha256 over the canonical JSON of ``mask_regions_from_records`` output."""
    payload = {"version": 1, "regions": [asdict(region) for region in regions]}
    return _sha256(_canonical_json(payload))


def fingerprint_clean_settings(fields: Mapping[str, object]) -> str:
    """sha256 over the canonical JSON of the CleanSettings fields, field-for-field."""
    payload = {
        "version": 1,
        "settings": {name: fields.get(name) for name in _CLEAN_SETTINGS_FIELDS},
    }
    return _sha256(_canonical_json(payload))


def build_segment_cache_key(
    *, image_hash: str, model_key: str, seeds_fingerprint: str
) -> str:
    payload: dict[str, object] = {
        "version": 1,
        "image_hash": image_hash,
        "model_key": model_key,
        "seeds_fingerprint": seeds_fingerprint,
    }
    return f"segment::{_sha256(_canonical_json(payload))}"


def build_clean_cache_key(
    *,
    image_hash: str,
    mask_fingerprint: str,
    settings_fingerprint: str,
    default_detection_model: str,
) -> str:
    payload: dict[str, object] = {
        "version": 1,
        "image_hash": image_hash,
        "mask_fingerprint": mask_fingerprint,
        "settings_fingerprint": settings_fingerprint,
        "default_detection_model": default_detection_model,
    }
    return f"clean::{_sha256(_canonical_json(payload))}"


# ------------------------------------------------------------------ the store


def _parse_segment_records(raw: object) -> list[dict[str, object]] | None:
    if not isinstance(raw, str):
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, list):
        return None
    records: list[dict[str, object]] = []
    for entry in parsed:
        if not isinstance(entry, dict):
            return None
        records.append({str(name): value for name, value in entry.items()})
    return records


def _parse_clean_hd_strategy(raw: object) -> str | None:
    if not isinstance(raw, str):
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        return None
    strategy = parsed.get("hd_strategy")
    return strategy if isinstance(strategy, str) and strategy else None


class StageStore:
    """sqlite persistence for segment and clean stage outputs.

    All access is serialized through a single lock around the single shared
    connection (``check_same_thread=False``): the shared inference executor
    can interleave stage calls from different HTTP requests.
    """

    def __init__(self, db_path: Path) -> None:
        self._lock = threading.Lock()
        self._closed = False
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(db_path), check_same_thread=False)
        try:
            self._conn.execute("PRAGMA journal_mode=WAL")
            row = self._conn.execute("PRAGMA user_version").fetchone()
            version = int(row[0]) if row is not None else 0
            if version not in (0, _SCHEMA_VERSION):
                raise StageStoreError(
                    f"stage store schema version {version} is not supported"
                )
            self._conn.executescript(_SCHEMA_SQL)
            if version == 0:
                self._conn.execute(f"PRAGMA user_version = {_SCHEMA_VERSION}")
            self._conn.commit()
        except Exception:
            self._conn.close()
            raise
        logger.info("stage_store.opened", extra={"path": str(db_path)})

    # ---------------------------------------------------------------- segment

    def get_segment(self, key: str) -> SegmentCacheHit | None:
        if not key:
            return None
        with self._lock:
            row = self._conn.execute(
                "SELECT payload, engine_key FROM segment_cache WHERE key = ?", (key,)
            ).fetchone()
        if row is None:
            return None
        records = _parse_segment_records(row[0])
        if records is None:
            return None
        engine_key = row[1]
        return SegmentCacheHit(
            records=records,
            engine_key=engine_key if isinstance(engine_key, str) else "",
        )

    def put_segment(
        self, *, key: str, records: Sequence[Mapping[str, object]], engine_key: str
    ) -> bool:
        if not key or not records:
            return False
        payload = _canonical_json(list(records))
        if len(payload.encode("utf-8")) > _MAX_ENTRY_BYTES:
            return False
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO segment_cache"
                " (key, payload, engine_key, created_at) VALUES (?, ?, ?, ?)",
                (key, payload, engine_key, time.time()),
            )
            self._conn.commit()
        return True

    # ------------------------------------------------------------------ clean

    def get_clean(self, key: str) -> CleanCacheHit | None:
        if not key:
            return None
        with self._lock:
            row = self._conn.execute(
                "SELECT png, meta, model_used FROM clean_cache WHERE key = ?", (key,)
            ).fetchone()
        if row is None:
            return None
        png, meta_raw, model_used = row[0], row[1], row[2]
        if not isinstance(png, bytes):
            return None
        hd_strategy = _parse_clean_hd_strategy(meta_raw)
        if hd_strategy is None:
            return None
        return CleanCacheHit(
            model_used=model_used if isinstance(model_used, str) else "",
            png=png,
            hd_strategy=hd_strategy,
        )

    def put_clean(
        self, *, key: str, png: bytes, model_used: str, hd_strategy: str
    ) -> bool:
        if not key or not png:
            return False
        if len(png) > _MAX_ENTRY_BYTES:
            return False
        meta = json.dumps({"hd_strategy": hd_strategy}, separators=(",", ":"))
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO clean_cache"
                " (key, png, meta, model_used, created_at) VALUES (?, ?, ?, ?, ?)",
                (key, png, meta, model_used, time.time()),
            )
            self._conn.commit()
        return True

    # -------------------------------------------------------------- lifecycle

    def prune(
        self,
        max_rows: int = _DEFAULT_MAX_ROWS,
        max_bytes: int = _DEFAULT_MAX_TOTAL_BYTES,
    ) -> int:
        """Keep the newest ``max_rows`` per table, then bound clean PNG bytes.

        The byte bound is this store's documented deviation from the
        translation store's rows-only prune (clean PNGs are multi-MB blobs);
        it deletes oldest-first while the newest-first cumulative size exceeds
        ``max_bytes``. Returns the removed row count.
        """
        bounded_rows = max(0, max_rows)
        bounded_bytes = max(0, max_bytes)
        with self._lock:
            removed_segment = self._conn.execute(
                "DELETE FROM segment_cache WHERE key IN ("
                " SELECT key FROM segment_cache"
                " ORDER BY created_at DESC LIMIT -1 OFFSET ?)",
                (bounded_rows,),
            ).rowcount
            removed_clean_rows = self._conn.execute(
                "DELETE FROM clean_cache WHERE key IN ("
                " SELECT key FROM clean_cache"
                " ORDER BY created_at DESC LIMIT -1 OFFSET ?)",
                (bounded_rows,),
            ).rowcount
            removed_clean_bytes = self._conn.execute(
                "DELETE FROM clean_cache WHERE key IN ("
                " SELECT key FROM ("
                "  SELECT key, SUM(LENGTH(png)) OVER ("
                "   ORDER BY created_at DESC, rowid DESC) AS running_bytes"
                "  FROM clean_cache"
                " ) WHERE running_bytes > ?)",
                (bounded_bytes,),
            ).rowcount
            self._conn.commit()
        return int(removed_segment) + int(removed_clean_rows) + int(removed_clean_bytes)

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
            try:
                self._conn.close()
            except sqlite3.Error:
                logger.warning("stage_store.close_failed", exc_info=True)


@cache
def get_stage_store() -> StageStore:
    """Lazy process-wide store under KOMA_APP_DATA_DIR (dev: ~/.koma-studio)."""
    data_dir = os.getenv("KOMA_APP_DATA_DIR") or os.path.join(
        os.path.expanduser("~"), ".koma-studio"
    )
    store = StageStore(Path(data_dir) / "stage-store.sqlite3")
    pruned = store.prune()
    logger.info("stage_store.ready", extra={"pruned": pruned})
    return store


def close_stage_store() -> None:
    """Close the process-wide store (lifespan shutdown); no-op when unopened."""
    if get_stage_store.cache_info().currsize == 0:
        return
    get_stage_store().close()
    get_stage_store.cache_clear()
