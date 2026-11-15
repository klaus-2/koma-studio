
from __future__ import annotations

import os
import time
from pathlib import Path
import sys
import unittest
from unittest import mock

from fastapi.testclient import TestClient

os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
    from pipelines import stage_store as stage_store_module
    from pipelines import translation_store as translation_store_module
    from pipelines.batch import progress as batch_progress_module
    from pipelines.batch.progress import BatchProgressRegistry
    from pipelines.batch.progress import get_batch_progress_registry
    from pipelines.translation_store import CacheRow, TMWrite
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc

def _megabytes(count: int) -> bytes:
    return b"\x00" * (count * 1024 * 1024)

@unittest.skipIf(
    IMPORT_ERROR is not None,
    f"optional runtime dependencies missing: {IMPORT_ERROR}",
)
class CacheUsageRouteTests(unittest.TestCase):

    def setUp(self) -> None:
        self.client = TestClient(mini_app.app)

    def test_usage_reports_row_counts_and_logical_bytes(self) -> None:
        stage = stage_store_module.get_stage_store()
        for index in range(3):
            stage.put_segment(
                key=f"segment::usage-{index}",
                records=[{"page": index, "note": "x" * 100}],
                engine_key=f"engine-{index}",
            )
            time.sleep(0.03)
        stage.put_clean(
            key="clean::usage",
            png=_megabytes(2),
            model_used="model-a",
            hd_strategy="resize",
        )
        translation = translation_store_module.get_translation_store()
        translation.put_cached(
            [
                CacheRow(
                    key="cache-key-1",
                    translated_text="t" * 500,
                    notes=("n" * 50,),
                    engine_key="engine-a",
                )
            ]
        )

        response = self.client.get("/diagnostics/cache-usage")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        stage_tables = payload["stage_store"]["tables"]
        self.assertEqual(stage_tables["segment_cache"]["row_count"], 3)
        self.assertGreater(stage_tables["segment_cache"]["logical_bytes"], 0)
        self.assertEqual(stage_tables["clean_cache"]["row_count"], 1)
        self.assertEqual(
            stage_tables["clean_cache"]["logical_bytes"], 2 * 1024 * 1024
        )
        self.assertEqual(stage_tables["detect_cache"]["row_count"], 0)
        self.assertEqual(stage_tables["ocr_cache"]["row_count"], 0)
        translation_tables = payload["translation_store"]["tables"]
        self.assertEqual(translation_tables["translation_cache"]["row_count"], 1)
        self.assertEqual(
            translation_tables["translation_cache"]["logical_bytes"], 554
        )
        self.assertGreater(payload["stage_store"]["file_size_bytes"], 0)
        self.assertGreater(payload["stage_store"]["page_count"], 0)
        self.assertGreaterEqual(payload["stage_store"]["freelist_count"], 0)
        self.assertGreater(payload["translation_store"]["file_size_bytes"], 0)

def _isolate_progress_registry(test_case: unittest.TestCase) -> None:
    patcher = mock.patch.object(
        batch_progress_module, "_REGISTRY", BatchProgressRegistry()
    )
    patcher.start()
    test_case.addCleanup(patcher.stop)

@unittest.skipIf(
    IMPORT_ERROR is not None,
    f"optional runtime dependencies missing: {IMPORT_ERROR}",
)
class CachePruneRouteTests(unittest.TestCase):

    def setUp(self) -> None:
        self.client = TestClient(mini_app.app)
        _isolate_progress_registry(self)

    def _seed_stage_segment_rows(self, count: int) -> None:
        stage = stage_store_module.get_stage_store()
        for index in range(count):
            stage.put_segment(
                key=f"segment::prune-{index}",
                records=[{"page": index}],
                engine_key=f"engine-{index}",
            )
            time.sleep(0.03)

    def test_row_cap_keeps_newest_rows_and_reports_freed(self) -> None:
        self._seed_stage_segment_rows(5)

        response = self.client.post(
            "/cache/prune", json={"max_rows_per_table": 2}
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        usage = self.client.get("/diagnostics/cache-usage").json()
        self.assertEqual(
            usage["stage_store"]["tables"]["segment_cache"]["row_count"], 2
        )
        stage_report = next(
            report
            for report in payload["per_store"]
            if report["store"] == "stage"
        )
        self.assertGreaterEqual(stage_report["freed_rows"], 3)
        self.assertEqual(payload["freed_rows"], stage_report["freed_rows"])

    def test_byte_cap_window_keeps_newest_clean_pngs(self) -> None:
        stage = stage_store_module.get_stage_store()
        for index in range(3):
            stage.put_clean(
                key=f"clean::bytes-{index}",
                png=_megabytes(1),
                model_used="model-a",
                hd_strategy="resize",
            )
            time.sleep(0.03)

        response = self.client.post(
            "/cache/prune", json={"max_total_bytes": 1536 * 1024}
        )

        self.assertEqual(response.status_code, 200)
        usage = self.client.get("/diagnostics/cache-usage").json()
        self.assertEqual(usage["stage_store"]["tables"]["clean_cache"]["row_count"], 1)

    def test_freed_logical_bytes_equals_before_minus_after(self) -> None:
        self._seed_stage_segment_rows(4)
        before = self.client.get("/diagnostics/cache-usage").json()
        before_rows = before["stage_store"]["tables"]["segment_cache"]["row_count"]
        before_bytes = before["stage_store"]["tables"]["segment_cache"][
            "logical_bytes"
        ]

        response = self.client.post(
            "/cache/prune", json={"max_rows_per_table": 1}
        )

        after = self.client.get("/diagnostics/cache-usage").json()
        after_rows = after["stage_store"]["tables"]["segment_cache"]["row_count"]
        after_bytes = after["stage_store"]["tables"]["segment_cache"]["logical_bytes"]
        payload = response.json()
        stage_report = next(
            report
            for report in payload["per_store"]
            if report["store"] == "stage"
        )
        self.assertEqual(
            stage_report["freed_rows"], before_rows - after_rows
        )
        self.assertEqual(
            stage_report["freed_logical_bytes"], before_bytes - after_bytes
        )

    def test_prune_does_not_vacuum_disk_bytes(self) -> None:
        stage = stage_store_module.get_stage_store()
        for index in range(3):
            stage.put_clean(
                key=f"clean::disk-{index}",
                png=_megabytes(1),
                model_used="model-a",
                hd_strategy="resize",
            )
            time.sleep(0.03)
        file_bytes_before = self.client.get("/diagnostics/cache-usage").json()[
            "stage_store"
        ]["file_size_bytes"]

        response = self.client.post(
            "/cache/prune", json={"max_total_bytes": 1024}
        )

        self.assertEqual(response.status_code, 200)
        after = self.client.get("/diagnostics/cache-usage").json()
        self.assertEqual(after["stage_store"]["file_size_bytes"], file_bytes_before)
        self.assertNotIn("file_size_bytes_before", response.json())

@unittest.skipIf(
    IMPORT_ERROR is not None,
    f"optional runtime dependencies missing: {IMPORT_ERROR}",
)
class CacheVacuumRouteTests(unittest.TestCase):

    def setUp(self) -> None:
        self.client = TestClient(mini_app.app)
        _isolate_progress_registry(self)

    def test_vacuum_shrinks_disk_and_freelist(self) -> None:
        stage = stage_store_module.get_stage_store()
        for index in range(4):
            stage.put_clean(
                key=f"clean::vacuum-{index}",
                png=_megabytes(1),
                model_used="model-a",
                hd_strategy="resize",
            )
            time.sleep(0.03)
        self.client.post("/cache/prune", json={"max_total_bytes": 1024})
        before = self.client.get("/diagnostics/cache-usage").json()
        freelist_before = before["stage_store"]["freelist_count"]

        response = self.client.post("/cache/vacuum")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        stage_report = next(
            report
            for report in payload["per_store"]
            if report["store"] == "stage"
        )
        self.assertLessEqual(
            stage_report["file_size_bytes_after"],
            stage_report["file_size_bytes_before"],
        )
        after = self.client.get("/diagnostics/cache-usage").json()
        self.assertLessEqual(
            after["stage_store"]["freelist_count"], freelist_before
        )

@unittest.skipIf(
    IMPORT_ERROR is not None,
    f"optional runtime dependencies missing: {IMPORT_ERROR}",
)
class CacheActiveBatchGuardTests(unittest.TestCase):

    def setUp(self) -> None:
        self.client = TestClient(mini_app.app)
        _isolate_progress_registry(self)

    def test_prune_and_vacuum_409_while_batch_unfinished(self) -> None:
        registry = get_batch_progress_registry()
        registry.start("guard-batch", 2)
        try:
            prune_response = self.client.post("/cache/prune", json={})
            vacuum_response = self.client.post("/cache/vacuum")
            usage_response = self.client.get("/diagnostics/cache-usage")
        finally:
            registry.cancel("guard-batch")

        self.assertEqual(prune_response.status_code, 409)
        self.assertEqual(vacuum_response.status_code, 409)
        self.assertEqual(usage_response.status_code, 200)

        after = self.client.post("/cache/prune", json={})
        self.assertEqual(after.status_code, 200)

class BatchProgressRegistryUnfinishedTests(unittest.TestCase):

    def test_empty_registry_reports_no_unfinished(self) -> None:
        registry = BatchProgressRegistry()
        self.assertFalse(registry.has_unfinished())

    def test_running_entry_reports_unfinished_until_finished(self) -> None:
        registry = BatchProgressRegistry()
        registry.start("running-batch", 3)
        self.assertTrue(registry.has_unfinished())
        registry.finish("running-batch")
        self.assertFalse(registry.has_unfinished())

    def test_cancelled_entry_reports_finished(self) -> None:
        registry = BatchProgressRegistry()
        registry.start("cancelled-batch", 1)
        registry.cancel("cancelled-batch")
        self.assertFalse(registry.has_unfinished())

if __name__ == "__main__":
    unittest.main()
