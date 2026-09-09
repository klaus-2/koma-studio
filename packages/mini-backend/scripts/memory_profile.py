"""
Memory leak analysis and profiling for mini-backend.

Usage:
    python scripts/memory_profile.py          # Run full analysis
    python scripts/memory_profile.py --quick  # Quick snapshot only
    python scripts/memory_profile.py --gc     # GC object graph analysis only
"""

from __future__ import annotations

import gc
import os
import sys
import time
import tracemalloc
from collections import Counter
from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# 1. Snapshot helpers
# ---------------------------------------------------------------------------


@dataclass
class MemorySnapshot:
    """Point-in-time memory usage snapshot."""

    timestamp: float = 0.0
    rss_mb: float = 0.0
    vms_mb: float = 0.0
    tracemalloc_current_mb: float = 0.0
    tracemalloc_peak_mb: float = 0.0
    gc_object_count: int = 0
    gc_generation_counts: list[int] = field(default_factory=list)
    top_allocations: list[tuple[str, int, float]] = field(default_factory=list)
    onnx_session_count: int = 0
    torch_tensors_tracked: int = 0
    gpu_vram_used_mb: float | None = None
    gpu_vram_total_mb: float | None = None


def _get_process_memory_mb() -> tuple[float, float]:
    """Return (RSS_MB, VMS_MB) using platform-appropriate method."""
    # Try psutil first (most accurate)
    try:
        import psutil

        proc = psutil.Process(os.getpid())
        mem = proc.memory_info()
        return mem.rss / (1024 * 1024), mem.vms / (1024 * 1024)
    except ImportError:
        pass

    # Fallback: read /proc on Linux
    if os.path.exists(f"/proc/{os.getpid()}/status"):
        try:
            with open(f"/proc/{os.getpid()}/status") as f:
                lines = f.readlines()
            rss = vms = 0.0
            for line in lines:
                if line.startswith("VmRSS:"):
                    rss = float(line.split()[1]) / 1024
                elif line.startswith("VmSize:"):
                    vms = float(line.split()[1]) / 1024
            return rss, vms
        except Exception:
            pass

    # Fallback: Windows wmic
    if os.name == "nt":
        try:
            import subprocess

            result = subprocess.run(
                [
                    "wmic",
                    "process",
                    "where",
                    f"ProcessId={os.getpid()}",
                    "get",
                    "WorkingSetSize,VirtualSize",
                    "/format:csv",
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )
            for line in result.stdout.strip().split("\n"):
                if str(os.getpid()) in line:
                    parts = line.split(",")
                    if len(parts) >= 3:
                        vms = float(parts[1]) / (1024 * 1024)
                        rss = float(parts[2]) / (1024 * 1024)
                        return rss, vms
        except Exception:
            pass

    return 0.0, 0.0


def _get_gc_stats() -> tuple[int, list[int]]:
    """Return (total_objects, [gen0, gen1, gen2] counts)."""
    counts = gc.get_count()
    total = sum(counts)
    return total, list(counts)


def _get_onnx_session_count() -> int:
    """Count live ONNX InferenceSession objects in gc."""
    try:
        import onnxruntime as ort

        sessions = [
            obj for obj in gc.get_objects() if isinstance(obj, ort.InferenceSession)
        ]
        return len(sessions)
    except Exception:
        return 0


def _get_torch_tensor_count() -> int:
    """Count tracked PyTorch tensors."""
    try:
        import torch

        return len(gc.get_objects())  # Approximation; real count needs objgraph
    except Exception:
        return 0


def _get_gpu_vram_info() -> tuple[float | None, float | None]:
    """Return (used_mb, total_mb) for GPU VRAM."""
    try:
        import torch

        if torch.cuda.is_available():
            used = torch.cuda.memory_allocated(0) / (1024 * 1024)
            total = torch.cuda.get_device_properties(0).total_memory / (1024 * 1024)
            return round(used, 1), round(total, 1)
    except Exception:
        pass
    return None, None


def _get_top_tracemalloc_allocations(
    snapshot: tracemalloc.Snapshot, limit: int = 25
) -> list[tuple[str, int, float]]:
    """Return top allocations as [(file:line, count, size_mb)]."""
    stats = snapshot.statistics("lineno")
    results: list[tuple[str, int, float]] = []
    for stat in stats[:limit]:
        size_mb = stat.size / (1024 * 1024)
        key = (
            f"{stat.traceback.format()[-1].strip()}" if stat.traceback else "<unknown>"
        )
        results.append((key, stat.count, round(size_mb, 2)))
    return results


def _get_top_allocations_by_file(
    snapshot: tracemalloc.Snapshot, limit: int = 20
) -> list[tuple[str, int, float]]:
    """Return top allocations grouped by file."""
    stats = snapshot.statistics("filename")
    results: list[tuple[str, int, float]] = []
    for stat in stats[:limit]:
        size_mb = stat.size / (1024 * 1024)
        results.append(
            (
                stat.traceback[0].filename if stat.traceback else "<unknown>",
                stat.count,
                round(size_mb, 2),
            )
        )
    return results


def take_snapshot() -> MemorySnapshot:
    """Take a comprehensive memory snapshot."""
    rss, vms = _get_process_memory_mb()
    gc_total, gc_gens = _get_gc_stats()
    gpu_used, gpu_total = _get_gpu_vram_info()
    onnx_count = _get_onnx_session_count()

    snapshot = MemorySnapshot(
        timestamp=time.time(),
        rss_mb=round(rss, 1),
        vms_mb=round(vms, 1),
        gc_object_count=gc_total,
        gc_generation_counts=gc_gens,
        onnx_session_count=onnx_count,
        gpu_vram_used_mb=gpu_used,
        gpu_vram_total_mb=gpu_total,
    )

    if tracemalloc.is_tracing():
        snap = tracemalloc.take_snapshot()
        snapshot.tracemalloc_current_mb = round(
            tracemalloc.get_traced_memory()[0] / (1024 * 1024), 2
        )
        snapshot.tracemalloc_peak_mb = round(
            tracemalloc.get_traced_memory()[1] / (1024 * 1024), 2
        )
        snapshot.top_allocations = _get_top_allocations_by_file(snap)

    return snapshot


# ---------------------------------------------------------------------------
# 2. GC object graph analysis
# ---------------------------------------------------------------------------


def analyze_gc_objects() -> dict[str, Any]:
    """Analyze gc.get_objects() for potential leaks."""
    gc.collect()
    objects = gc.get_objects()
    type_counts: Counter = Counter()
    type_sizes: dict[str, int] = {}

    for obj in objects:
        try:
            type_name = type(obj).__name__
            type_counts[type_name] += 1
            if type_name not in type_sizes:
                type_sizes[type_name] = 0
            type_sizes[type_name] += sys.getsizeof(obj)
        except Exception:
            pass

    # Top by count
    top_by_count = type_counts.most_common(30)
    # Top by size
    top_by_size = sorted(type_sizes.items(), key=lambda x: x[1], reverse=True)[:30]
    top_by_size_mb = [
        (name, round(size / (1024 * 1024), 2)) for name, size in top_by_size
    ]

    # Check for known leak suspects
    suspects: dict[str, int] = {}
    suspect_types = [
        "InferenceSession",
        "Tensor",
        "ndarray",
        "Image",
        "bytes",
        "bytearray",
        "list",
        "dict",
    ]
    for suspect_type in suspect_types:
        count = type_counts.get(suspect_type, 0)
        if count > 0:
            suspects[suspect_type] = count

    return {
        "total_objects": len(objects),
        "gc_counts": list(gc.get_count()),
        "gc_thresholds": list(gc.get_threshold()),
        "top_by_count": top_by_count,
        "top_by_size_mb": top_by_size_mb,
        "suspects": suspects,
    }


# ---------------------------------------------------------------------------
# 3. Model cache inspection
# ---------------------------------------------------------------------------


def inspect_model_caches() -> dict[str, Any]:
    """Inspect all model factory caches for size and potential leaks."""
    caches: dict[str, Any] = {}

    # Detection cache
    try:
        from models.detection.factory import _DETECTOR_CACHE, clear_detector_cache

        caches["detector"] = {
            "size": len(_DETECTOR_CACHE),
            "keys": list(_DETECTOR_CACHE.keys())[:10],  # First 10 keys
            "clear_fn": "clear_detector_cache",
        }
    except Exception as e:
        caches["detector"] = {"error": str(e)}

    # OCR cache
    try:
        from models.ocr.factory import _OCR_CACHE, clear_ocr_cache

        caches["ocr"] = {
            "size": len(_OCR_CACHE),
            "keys": list(_OCR_CACHE.keys())[:10],
            "clear_fn": "clear_ocr_cache",
        }
    except Exception as e:
        caches["ocr"] = {"error": str(e)}

    # Inpainting cache
    try:
        from models.inpainting.factory import _INPAINTER_CACHE, clear_inpainter_cache

        caches["inpainting"] = {
            "size": len(_INPAINTER_CACHE),
            "keys": list(_INPAINTER_CACHE.keys())[:10],
            "clear_fn": "clear_inpainter_cache",
        }
    except Exception as e:
        caches["inpainting"] = {"error": str(e)}

    # Segmentation cache
    try:
        from models.segmentation.factory import _SEGMENTER_CACHE, clear_segmenter_cache

        caches["segmentation"] = {
            "size": len(_SEGMENTER_CACHE),
            "keys": list(_SEGMENTER_CACHE.keys())[:10],
            "clear_fn": "clear_segmenter_cache",
        }
    except Exception as e:
        caches["segmentation"] = {"error": str(e)}

    # Font style detector
    try:
        from routers.pipeline import _FONT_STYLE_DETECTOR

        caches["font_style_detector"] = {
            "exists": _FONT_STYLE_DETECTOR is not None,
            "note": "Global singleton, never released",
        }
    except Exception as e:
        caches["font_style_detector"] = {"error": str(e)}

    # CacheManager
    try:
        from routers.ocr import CACHE_MANAGER

        caches["ocr_cache_manager"] = {
            "ocr_entries": len(CACHE_MANAGER._ocr_cache),
            "translation_entries": len(CACHE_MANAGER._translation_cache),
            "ttl_seconds": CACHE_MANAGER.ttl_seconds,
            "max_entries": CACHE_MANAGER.max_entries,
        }
    except Exception as e:
        caches["ocr_cache_manager"] = {"error": str(e)}

    return caches


# ---------------------------------------------------------------------------
# 4. Leak detection heuristics
# ---------------------------------------------------------------------------


def detect_leak_patterns(snapshots: list[MemorySnapshot]) -> list[str]:
    """Compare snapshots to detect growing memory patterns."""
    if len(snapshots) < 2:
        return ["Need at least 2 snapshots to detect patterns"]

    warnings: list[str] = []
    first = snapshots[0]
    last = snapshots[-1]

    # RSS growth
    rss_growth = last.rss_mb - first.rss_mb
    if rss_growth > 100:
        warnings.append(
            f"CRITICAL: RSS grew {rss_growth:.1f} MB ({first.rss_mb} -> {last.rss_mb})"
        )
    elif rss_growth > 50:
        warnings.append(
            f"WARNING: RSS grew {rss_growth:.1f} MB ({first.rss_mb} -> {last.rss_mb})"
        )

    # tracemalloc growth
    if tracemalloc.is_tracing():
        tm_growth = last.tracemalloc_current_mb - first.tracemalloc_current_mb
        if tm_growth > 50:
            warnings.append(
                f"CRITICAL: tracemalloc tracked memory grew {tm_growth:.1f} MB"
            )
        elif tm_growth > 20:
            warnings.append(
                f"WARNING: tracemalloc tracked memory grew {tm_growth:.1f} MB"
            )

    # GC object growth
    gc_growth = last.gc_object_count - first.gc_object_count
    if gc_growth > 100000:
        warnings.append(
            f"CRITICAL: GC objects grew by {gc_growth:,} ({first.gc_object_count:,} -> {last.gc_object_count:,})"
        )
    elif gc_growth > 50000:
        warnings.append(f"WARNING: GC objects grew by {gc_growth:,}")

    # GPU VRAM growth
    if last.gpu_vram_used_mb is not None and first.gpu_vram_used_mb is not None:
        vram_growth = last.gpu_vram_used_mb - first.gpu_vram_used_mb
        if vram_growth > 500:
            warnings.append(f"CRITICAL: GPU VRAM grew {vram_growth:.0f} MB")
        elif vram_growth > 100:
            warnings.append(f"WARNING: GPU VRAM grew {vram_growth:.0f} MB")

    if not warnings:
        warnings.append("No significant leak patterns detected in this run.")

    return warnings


# ---------------------------------------------------------------------------
# 5. Main analysis runner
# ---------------------------------------------------------------------------


def run_full_analysis(quick: bool = False) -> dict[str, Any]:
    """Run complete memory analysis."""
    results: dict[str, Any] = {}

    print("=" * 70)
    print("  MINI-BACKEND MEMORY LEAK ANALYSIS")
    print("=" * 70)

    # Start tracemalloc
    if not tracemalloc.is_tracing():
        tracemalloc.start(25)  # 25 frames deep
        print("\n[+] tracemalloc started (25 frames)")

    # Baseline snapshot
    print("\n[1/5] Taking baseline snapshot...")
    baseline = take_snapshot()
    results["baseline"] = {
        "rss_mb": baseline.rss_mb,
        "vms_mb": baseline.vms_mb,
        "tracemalloc_current_mb": baseline.tracemalloc_current_mb,
        "tracemalloc_peak_mb": baseline.tracemalloc_peak_mb,
        "gc_objects": baseline.gc_object_count,
        "gc_generations": baseline.gc_generation_counts,
        "onnx_sessions": baseline.onnx_session_count,
        "gpu_vram_used_mb": baseline.gpu_vram_used_mb,
        "gpu_vram_total_mb": baseline.gpu_vram_total_mb,
    }
    print(f"    RSS: {baseline.rss_mb} MB | VMS: {baseline.vms_mb} MB")
    print(f"    GC objects: {baseline.gc_object_count:,}")
    print(f"    ONNX sessions: {baseline.onnx_session_count}")
    if baseline.gpu_vram_used_mb is not None:
        print(
            f"    GPU VRAM: {baseline.gpu_vram_used_mb} / {baseline.gpu_vram_total_mb} MB"
        )

    # Model cache inspection
    print("\n[2/5] Inspecting model caches...")
    caches = inspect_model_caches()
    results["model_caches"] = caches
    for name, info in caches.items():
        if "size" in info:
            print(f"    {name}: {info['size']} entries")
        elif "exists" in info:
            print(f"    {name}: {'present' if info['exists'] else 'not loaded'}")
        elif "error" in info:
            print(f"    {name}: not available ({info['error']})")

    if not quick:
        # GC object analysis
        print("\n[3/5] Analyzing GC object graph...")
        gc_analysis = analyze_gc_objects()
        results["gc_analysis"] = {
            "total_objects": gc_analysis["total_objects"],
            "gc_counts": gc_analysis["gc_counts"],
            "gc_thresholds": gc_analysis["gc_thresholds"],
            "top_by_count": gc_analysis["top_by_count"][:15],
            "top_by_size_mb": gc_analysis["top_by_size_mb"][:15],
            "suspects": gc_analysis["suspects"],
        }
        print(f"    Total objects: {gc_analysis['total_objects']:,}")
        print(f"    GC counts: {gc_analysis['gc_counts']}")
        print(f"    Top suspects:")
        for type_name, count in gc_analysis["suspects"].items():
            print(f"      {type_name}: {count:,}")

        # Top tracemalloc allocations
        print("\n[4/5] Top tracemalloc allocations (by file)...")
        if baseline.top_allocations:
            results["top_allocations_by_file"] = baseline.top_allocations
            for filepath, count, size_mb in baseline.top_allocations[:15]:
                filename = filepath.split("\\")[-1].split("/")[-1]
                print(f"    {size_mb:>8.2f} MB  {count:>8,}  {filename}")
        else:
            print("    (no tracemalloc data available)")

    # Known leak patterns report
    print("\n[5/5] Known leak pattern report...")
    known_issues = [
        {
            "severity": "HIGH",
            "pattern": "Unbounded model caches",
            "description": "_DETECTOR_CACHE, _OCR_CACHE, _INPAINTER_CACHE are plain dicts with no eviction. "
            "Each unique (model_key, provider, confidence, nms, language) combo creates a new entry "
            "that holds an ONNX InferenceSession with GPU memory. Never evicted automatically.",
            "files": [
                "models/detection/factory.py:62",
                "models/ocr/factory.py:216",
                "models/inpainting/factory.py:56",
            ],
            "fix": "Add LRU eviction (functools.lru_cache or OrderedDict with maxsize) or TTL-based cleanup.",
        },
        {
            "severity": "HIGH",
            "pattern": "GPU memory not released from ONNX sessions",
            "description": "release_gpu_memory() calls torch.cuda.empty_cache() but ONNX InferenceSessions "
            "hold their own CUDA allocations. Cached sessions keep VRAM until explicitly cleared.",
            "files": ["core/device.py:593-612"],
            "fix": "Call release_onnx_gpu_memory() after batch operations. Consider session pooling with explicit release.",
        },
        {
            "severity": "MEDIUM",
            "pattern": "Global font style detector singleton",
            "description": "_FONT_STYLE_DETECTOR in routers/pipeline.py is a module-level global that is "
            "created once and never released, holding an ONNX session permanently.",
            "files": ["routers/pipeline.py:542-552"],
            "fix": "Add cleanup function or use weak references.",
        },
        {
            "severity": "MEDIUM",
            "pattern": "Batch image bytes held in memory",
            "description": "In pipeline batch processing, all task.image_bytes are loaded into memory "
            "at once and held during concurrent processing. For large batches this can "
            "consume significant RAM.",
            "files": ["routers/pipeline.py:864-870"],
            "fix": "Stream images from disk instead of holding all bytes in memory.",
        },
        {
            "severity": "LOW",
            "pattern": "No memory monitoring endpoint",
            "description": "No /memory/stats or similar endpoint exists to check memory usage at runtime.",
            "files": ["app.py"],
            "fix": "Add a /memory/stats endpoint returning RSS, GC stats, cache sizes, and GPU VRAM.",
        },
        {
            "severity": "LOW",
            "pattern": "lru_cache on get_device_info() never cleared on profile change",
            "description": "get_device_info() uses @lru_cache(maxsize=1). reset_device_runtime_cache() "
            "clears it, but profile changes during runtime may return stale data.",
            "files": ["core/device.py:432"],
            "fix": "Ensure reset_device_runtime_cache() is called on every profile change (already done in warmup).",
        },
    ]
    results["known_issues"] = known_issues
    for issue in known_issues:
        print(f"    [{issue['severity']}] {issue['pattern']}")
        print(f"           {issue['description'][:120]}...")
        print(f"           Fix: {issue['fix']}")

    print("\n" + "=" * 70)
    print("  ANALYSIS COMPLETE")
    print("=" * 70)

    return results


# ---------------------------------------------------------------------------
# 6. CLI entry point
# ---------------------------------------------------------------------------


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Mini-backend memory leak analysis")
    parser.add_argument(
        "--quick", action="store_true", help="Quick snapshot only (skip GC analysis)"
    )
    parser.add_argument(
        "--gc", action="store_true", help="GC object graph analysis only"
    )
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    parser.add_argument(
        "--watch",
        type=int,
        default=0,
        help="Watch mode: take snapshots every N seconds",
    )
    parser.add_argument(
        "--watch-count", type=int, default=10, help="Number of snapshots in watch mode"
    )
    args = parser.parse_args()

    # Change to mini-backend directory so imports work
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(script_dir)
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    if args.gc:
        gc_analysis = analyze_gc_objects()
        if args.json:
            import json

            print(json.dumps(gc_analysis, indent=2, default=str))
        else:
            print(f"Total GC objects: {gc_analysis['total_objects']:,}")
            print(f"GC counts: {gc_analysis['gc_counts']}")
            print(f"Top suspects: {gc_analysis['suspects']}")
        return

    if args.watch and args.watch > 0:
        print(f"Watch mode: taking {args.watch_count} snapshots every {args.watch}s")
        snapshots: list[MemorySnapshot] = []
        for i in range(args.watch_count):
            snap = take_snapshot()
            snapshots.append(snap)
            print(
                f"  [{i + 1}/{args.watch_count}] RSS={snap.rss_mb} MB | "
                f"GC={snap.gc_object_count:,} | "
                f"ONNX={snap.onnx_session_count} | "
                f"GPU={snap.gpu_vram_used_mb or 'N/A'} MB"
            )
            if i < args.watch_count - 1:
                time.sleep(args.watch)

        print("\n--- Leak Detection ---")
        warnings = detect_leak_patterns(snapshots)
        for w in warnings:
            print(f"  {w}")
        return

    results = run_full_analysis(quick=args.quick)

    if args.json:
        import json

        # Clean up for JSON serialization
        def clean(obj):
            if isinstance(obj, dict):
                return {k: clean(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [clean(v) for v in obj]
            if isinstance(obj, float):
                return obj
            return str(obj)

        print(json.dumps(clean(results), indent=2))


if __name__ == "__main__":
    main()
