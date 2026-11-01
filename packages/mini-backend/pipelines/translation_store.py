"""Persistent translation store — sqlite-backed cache + translation memory.

One connection, one lock, WAL journal. The file lives under KOMA_APP_DATA_DIR
(dev fallback ``~/.koma-studio``), never under the models root, and is never
touched by the in-memory cache-clear path: surviving a restart is the whole
point of this layer. Key helpers here are pure so the stage and tests can
compose keys without touching the database.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from functools import cache
import hashlib
import json
import logging
import os
from pathlib import Path
import re
import sqlite3
import threading
import time
import unicodedata

logger = logging.getLogger(__name__)

_SCHEMA_VERSION = 1
_DEFAULT_MAX_ROWS = 200_000

# \s on str patterns already covers NBSP and other Unicode whitespace.
_WS_RUN_RE = re.compile(r"\s+")

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS translation_cache (
    key TEXT PRIMARY KEY,
    translated_text TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '[]',
    engine_key TEXT,
    created_at REAL
);
CREATE TABLE IF NOT EXISTS tm (
    nfkc_key TEXT,
    src_lang TEXT,
    tgt_lang TEXT,
    translation TEXT,
    model_key TEXT,
    hits INTEGER NOT NULL DEFAULT 0,
    updated_at REAL,
    PRIMARY KEY (nfkc_key, src_lang, tgt_lang)
);
"""


class TranslationStoreError(RuntimeError):
    """The on-disk store exists at a schema version this build cannot read."""


@dataclass(frozen=True)
class TMEntry:
    translation: str
    model_key: str


@dataclass(frozen=True)
class TMWrite:
    nfkc_key: str
    src_lang: str
    tgt_lang: str
    translation: str
    model_key: str


@dataclass(frozen=True)
class CacheRow:
    key: str
    translated_text: str
    notes: tuple[str, ...]
    engine_key: str
    created_at: float = field(default_factory=time.time)


def normalize_source_text(text: str) -> str:
    """NFC, strip, and collapse internal whitespace runs to single spaces."""
    return _WS_RUN_RE.sub(" ", unicodedata.normalize("NFC", text).strip())


def tm_key(text: str) -> str:
    """NFKC variant of the source normalization, used as the TM lookup key."""
    return _WS_RUN_RE.sub(" ", unicodedata.normalize("NFKC", text).strip())


def glossary_hash(terms: Sequence[tuple[str, str, bool]]) -> str:
    """SHA1 of the pinned ``(source, target, never_translate)`` triples.

    Input must be the clamped request glossary in request order: both the
    order and the never-translate flag are part of the hash.
    """
    payload = [
        {"source": source, "target": target, "never_translate": never}
        for source, target, never in terms
    ]
    canonical = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()


def persistent_cache_key(
    model_key: str,
    src_lang: str,
    tgt_lang: str,
    translation_mode: str,
    normalized_text: str,
    gloss_hash: str,
) -> str:
    """SHA256 of the version-pinned key tuple; page context is deliberately absent."""
    payload: list[str | int] = [
        1,
        model_key,
        src_lang.strip().lower(),
        tgt_lang.strip().lower(),
        translation_mode,
        normalized_text,
        gloss_hash,
    ]
    canonical = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _serialize_notes(notes: Sequence[str]) -> str:
    return json.dumps(list(notes), ensure_ascii=False)


def _parse_notes(raw: object) -> tuple[str, ...]:
    if not isinstance(raw, str):
        return ()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return ()
    if not isinstance(parsed, list) or not all(
        isinstance(item, str) for item in parsed
    ):
        return ()
    return tuple(parsed)


class TranslationStore:
    """sqlite persistence for translated blocks and the translation memory.

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
                raise TranslationStoreError(
                    f"translation store schema version {version} is not supported"
                )
            self._conn.executescript(_SCHEMA_SQL)
            if version == 0:
                self._conn.execute(f"PRAGMA user_version = {_SCHEMA_VERSION}")
            self._conn.commit()
        except Exception:
            self._conn.close()
            raise
        logger.info("translation_store.opened", extra={"path": str(db_path)})

    # ---------------------------------------------------------------- cache

    def get_cached(self, keys: Sequence[str]) -> dict[str, CacheRow]:
        wanted = [key for key in keys if key]
        if not wanted:
            return {}
        placeholders = ",".join("?" for _ in wanted)
        with self._lock:
            cursor = self._conn.execute(
                "SELECT key, translated_text, notes, engine_key, created_at"
                f" FROM translation_cache WHERE key IN ({placeholders})",
                wanted,
            )
            rows = cursor.fetchall()
        found: dict[str, CacheRow] = {}
        for key, translated_text, notes_raw, engine_key, created_at in rows:
            found[key] = CacheRow(
                key=key,
                translated_text=translated_text,
                notes=_parse_notes(notes_raw),
                engine_key=engine_key if isinstance(engine_key, str) else "",
                created_at=(
                    float(created_at) if isinstance(created_at, int | float) else 0.0
                ),
            )
        return found

    def put_cached(self, rows: Sequence[CacheRow]) -> int:
        payload = [
            (
                row.key,
                row.translated_text,
                _serialize_notes(row.notes),
                row.engine_key,
                row.created_at,
            )
            for row in rows
            if row.key and row.translated_text.strip()
        ]
        if not payload:
            return 0
        with self._lock:
            self._conn.executemany(
                "INSERT OR REPLACE INTO translation_cache"
                " (key, translated_text, notes, engine_key, created_at)"
                " VALUES (?, ?, ?, ?, ?)",
                payload,
            )
            self._conn.commit()
        return len(payload)

    # ------------------------------------------------------------------- tm

    def lookup_tm(
        self, keys: Sequence[tuple[str, str, str]]
    ) -> dict[tuple[str, str, str], TMEntry]:
        """Batched exact TM lookup: one query per language pair, one lock."""
        wanted = [key for key in keys if key[0]]
        if not wanted:
            return {}
        found: dict[tuple[str, str, str], TMEntry] = {}
        pairs = sorted({(src, tgt) for _, src, tgt in wanted})
        with self._lock:
            for src_lang, tgt_lang in pairs:
                nfkc_keys = [
                    key
                    for key, src, tgt in wanted
                    if src == src_lang and tgt == tgt_lang
                ]
                placeholders = ",".join("?" for _ in nfkc_keys)
                cursor = self._conn.execute(
                    "SELECT nfkc_key, translation, model_key FROM tm"
                    " WHERE src_lang = ? AND tgt_lang = ?"
                    f" AND nfkc_key IN ({placeholders})",
                    [src_lang, tgt_lang, *nfkc_keys],
                )
                for nfkc_key, translation, model_key in cursor.fetchall():
                    if not isinstance(translation, str) or not translation:
                        continue
                    found[(nfkc_key, src_lang, tgt_lang)] = TMEntry(
                        translation=translation,
                        model_key=model_key if isinstance(model_key, str) else "",
                    )
        return found

    def put_tm(self, rows: Sequence[TMWrite]) -> None:
        """Upsert a batch of TM translations: one executemany, one commit."""
        payload = [
            (
                row.nfkc_key,
                row.src_lang,
                row.tgt_lang,
                row.translation,
                row.model_key,
                time.time(),
            )
            for row in rows
            if row.nfkc_key and row.translation
        ]
        if not payload:
            return
        with self._lock:
            self._conn.executemany(
                "INSERT INTO tm"
                " (nfkc_key, src_lang, tgt_lang, translation, model_key, hits, updated_at)"
                " VALUES (?, ?, ?, ?, ?, 0, ?)"
                " ON CONFLICT (nfkc_key, src_lang, tgt_lang) DO UPDATE SET"
                " translation = excluded.translation,"
                " model_key = excluded.model_key,"
                " updated_at = excluded.updated_at",
                payload,
            )
            self._conn.commit()

    def bump_tm_hits(self, keys: Sequence[tuple[str, str, str]]) -> None:
        if not keys:
            return
        with self._lock:
            self._conn.executemany(
                "UPDATE tm SET hits = hits + 1"
                " WHERE nfkc_key = ? AND src_lang = ? AND tgt_lang = ?",
                list(keys),
            )
            self._conn.commit()

    # ------------------------------------------------------------- lifecycle

    def prune(self, max_rows: int = _DEFAULT_MAX_ROWS) -> int:
        """Keep the newest ``max_rows`` rows per table; return removed count."""
        bounded = max(0, max_rows)
        with self._lock:
            removed_cache = self._conn.execute(
                "DELETE FROM translation_cache WHERE key IN ("
                " SELECT key FROM translation_cache"
                " ORDER BY created_at DESC LIMIT -1 OFFSET ?)",
                (bounded,),
            ).rowcount
            removed_tm = self._conn.execute(
                "DELETE FROM tm WHERE rowid IN ("
                " SELECT rowid FROM tm"
                " ORDER BY updated_at DESC LIMIT -1 OFFSET ?)",
                (bounded,),
            ).rowcount
            self._conn.commit()
        return int(removed_cache) + int(removed_tm)

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
            try:
                self._conn.close()
            except sqlite3.Error:
                logger.warning("translation_store.close_failed", exc_info=True)


@cache
def get_translation_store() -> TranslationStore:
    """Lazy process-wide store under KOMA_APP_DATA_DIR (dev: ~/.koma-studio)."""
    data_dir = os.getenv("KOMA_APP_DATA_DIR") or os.path.join(
        os.path.expanduser("~"), ".koma-studio"
    )
    store = TranslationStore(Path(data_dir) / "translation-store.sqlite3")
    pruned = store.prune()
    logger.info("translation_store.ready", extra={"pruned": pruned})
    return store


def close_translation_store() -> None:
    """Close the process-wide store (lifespan shutdown); no-op when unopened."""
    if get_translation_store.cache_info().currsize == 0:
        return
    get_translation_store().close()
    get_translation_store.cache_clear()
