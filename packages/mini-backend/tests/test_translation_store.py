from __future__ import annotations

import sqlite3
import tempfile
from pathlib import Path
import sys
import unittest


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from pipelines.translation_store import (
    CacheRow,
    TranslationStore,
    TranslationStoreError,
    glossary_hash,
    normalize_source_text,
    persistent_cache_key,
    tm_key,
)


def _row(key: str, text: str, *, notes: tuple[str, ...] = (), engine: str = "eng") -> CacheRow:
    return CacheRow(key=key, translated_text=text, notes=notes, engine_key=engine)


class TranslationStoreTests(unittest.TestCase):
    def test_round_trip_get_put(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = TranslationStore(Path(tmp) / "store.sqlite3")
            try:
                written = store.put_cached(
                    [
                        _row("k1", "Olá mundo", notes=("NT: nota",), engine="nllb-200-600m-int8"),
                        _row("k2", "Tudo bem"),
                    ]
                )
                self.assertEqual(written, 2)
                found = store.get_cached(["k1", "k2", "missing"])
                self.assertEqual(found["k1"].translated_text, "Olá mundo")
                self.assertEqual(found["k1"].notes, ("NT: nota",))
                self.assertEqual(found["k1"].engine_key, "nllb-200-600m-int8")
                self.assertEqual(found["k2"].translated_text, "Tudo bem")
                self.assertEqual(found["k2"].notes, ())
                self.assertNotIn("missing", found)
            finally:
                store.close()

    def test_empty_results_are_not_persisted(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = TranslationStore(Path(tmp) / "store.sqlite3")
            try:
                self.assertEqual(store.put_cached([_row("k1", "   ")]), 0)
                self.assertEqual(store.get_cached(["k1"]), {})
            finally:
                store.close()

    def test_persistence_across_reopen(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "store.sqlite3"
            first = TranslationStore(db_path)
            try:
                first.put_cached([_row("k1", "persistido", notes=("NT: fica",))])
            finally:
                first.close()
            second = TranslationStore(db_path)
            try:
                found = second.get_cached(["k1"])
                self.assertEqual(found["k1"].translated_text, "persistido")
                self.assertEqual(found["k1"].notes, ("NT: fica",))
            finally:
                second.close()

    def test_wal_mode_and_schema_version(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "store.sqlite3"
            store = TranslationStore(db_path)
            store.close()
            raw = sqlite3.connect(str(db_path))
            try:
                mode = raw.execute("PRAGMA journal_mode").fetchone()
                version = raw.execute("PRAGMA user_version").fetchone()
                self.assertIsNotNone(mode)
                self.assertIsNotNone(version)
                self.assertEqual(str(mode[0]).lower(), "wal")
                self.assertEqual(int(version[0]), 1)
            finally:
                raw.close()

    def test_unknown_schema_version_raises(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "store.sqlite3"
            store = TranslationStore(db_path)
            store.close()
            raw = sqlite3.connect(str(db_path))
            try:
                raw.execute("PRAGMA user_version = 7")
                raw.commit()
            finally:
                raw.close()
            with self.assertRaises(TranslationStoreError):
                TranslationStore(db_path)

    def test_prune_keeps_newest_rows(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = TranslationStore(Path(tmp) / "store.sqlite3")
            try:
                rows = [
                    CacheRow(
                        key=f"k{index}",
                        translated_text=f"texto {index}",
                        notes=(),
                        engine_key="eng",
                        created_at=float(index),
                    )
                    for index in range(5)
                ]
                store.put_cached(rows)
                removed = store.prune(max_rows=3)
                self.assertEqual(removed, 2)
                found = store.get_cached([f"k{index}" for index in range(5)])
                self.assertEqual(sorted(found), ["k2", "k3", "k4"])
            finally:
                store.close()

    def test_tm_round_trip_and_upsert(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = TranslationStore(Path(tmp) / "store.sqlite3")
            try:
                self.assertIsNone(store.lookup_tm("chave", "ja", "pt-br"))
                store.put_tm("chave", "ja", "pt-br", "chave traduzida", "nllb-200-600m-int8")
                entry = store.lookup_tm("chave", "ja", "pt-br")
                self.assertIsNotNone(entry)
                self.assertEqual(entry.translation, "chave traduzida")
                self.assertEqual(entry.model_key, "nllb-200-600m-int8")
                store.put_tm("chave", "ja", "pt-br", "nova tradução", "m2m100_1_2b_ct2")
                entry = store.lookup_tm("chave", "ja", "pt-br")
                self.assertIsNotNone(entry)
                self.assertEqual(entry.translation, "nova tradução")
                self.assertEqual(entry.model_key, "m2m100_1_2b_ct2")
            finally:
                store.close()

    def test_bump_tm_hits_exact_increments(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "store.sqlite3"
            store = TranslationStore(db_path)
            try:
                store.put_tm("a", "ja", "pt-br", "um", "eng")
                store.put_tm("b", "ja", "pt-br", "dois", "eng")
                store.bump_tm_hits([("a", "ja", "pt-br"), ("a", "ja", "pt-br")])
                store.bump_tm_hits([("a", "ja", "pt-br")])
                store.bump_tm_hits([])
                raw = sqlite3.connect(str(db_path))
                try:
                    hits = dict(
                        (key, count)
                        for key, count in raw.execute(
                            "SELECT nfkc_key, hits FROM tm"
                        ).fetchall()
                    )
                finally:
                    raw.close()
                self.assertEqual(hits, {"a": 3, "b": 0})
            finally:
                store.close()


class StoreKeyHelperTests(unittest.TestCase):
    def test_normalize_source_text_nfc_and_whitespace(self) -> None:
        self.assertEqual(normalize_source_text("  foo \n bar\tbaz "), "foo bar baz")
        self.assertEqual(normalize_source_text("a\u00a0\u00a0b"), "a b")
        self.assertEqual(normalize_source_text("e\u0301"), "é")
        self.assertEqual(normalize_source_text("   "), "")

    def test_tm_key_folds_fullwidth_characters(self) -> None:
        self.assertEqual(tm_key("Ｈｅｌｌｏ"), "Hello")
        self.assertEqual(tm_key("ｶﾞ"), "ガ")
        self.assertEqual(tm_key(" x  y "), "x y")

    def test_glossary_hash_is_order_and_flag_sensitive(self) -> None:
        first = glossary_hash([("Kaito", "Kaito", False), ("Nao", "Nao", True)])
        reordered = glossary_hash([("Nao", "Nao", True), ("Kaito", "Kaito", False)])
        flagged = glossary_hash([("Kaito", "Kaito", True), ("Nao", "Nao", True)])
        self.assertEqual(first, glossary_hash([("Kaito", "Kaito", False), ("Nao", "Nao", True)]))
        self.assertNotEqual(first, reordered)
        self.assertNotEqual(first, flagged)
        self.assertEqual(glossary_hash([]), glossary_hash([]))
        self.assertNotEqual(glossary_hash([]), "")

    def test_persistent_cache_key_shape_and_inputs(self) -> None:
        base = persistent_cache_key("m", "JA", "pt-br ", "default", "texto", "gh")
        self.assertEqual(len(base), 64)
        self.assertEqual(
            base, persistent_cache_key("m", "ja", "pt-br", "default", "texto", "gh")
        )
        self.assertNotEqual(
            base, persistent_cache_key("m2", "ja", "pt-br", "default", "texto", "gh")
        )
        self.assertNotEqual(
            base, persistent_cache_key("m", "ja", "pt-br", "sfx", "texto", "gh")
        )
        self.assertNotEqual(
            base, persistent_cache_key("m", "ja", "pt-br", "default", "texto ", "gh")
        )
        self.assertNotEqual(
            base, persistent_cache_key("m", "ja", "pt-br", "default", "texto", "gh2")
        )


if __name__ == "__main__":
    unittest.main()
