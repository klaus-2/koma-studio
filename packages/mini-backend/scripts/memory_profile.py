"""Sample /diagnostics/memory on a running mini-backend and flag growth.

    python scripts/memory_profile.py --base-url http://127.0.0.1:8765 --interval 5 --samples 12 [--deep] [--json]

Exit code 1 on CRITICAL growth — usable as a soak-test gate.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from typing import Final

import httpx
from pydantic import TypeAdapter

from services.diagnostics import RuntimeMemoryReport

_REPORT_ADAPTER: Final = TypeAdapter(RuntimeMemoryReport)
_RSS_WARN_MB: Final = 50.0
_RSS_CRITICAL_MB: Final = 100.0
_VRAM_WARN_MB: Final = 100.0
_VRAM_CRITICAL_MB: Final = 500.0


@dataclass(frozen=True, slots=True)
class Options:
    base_url: str
    interval_seconds: float
    samples: int
    deep: bool
    as_json: bool


def _parse_args(argv: list[str]) -> Options:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:8765")
    parser.add_argument("--interval", type=float, default=5.0)
    parser.add_argument("--samples", type=int, default=12)
    parser.add_argument("--deep", action="store_true", help="also count gc objects and ONNX sessions")
    parser.add_argument("--json", action="store_true")
    ns = parser.parse_args(argv)
    if ns.samples < 1 or ns.interval < 0:
        parser.error("--samples must be >= 1 and --interval >= 0")
    return Options(ns.base_url, ns.interval, ns.samples, ns.deep, ns.json)


def _fetch(client: httpx.Client, deep: bool) -> RuntimeMemoryReport:
    response = client.get("/diagnostics/memory", params={"deep": deep})
    response.raise_for_status()
    return _REPORT_ADAPTER.validate_json(response.content)


def _growth_findings(first: RuntimeMemoryReport, last: RuntimeMemoryReport) -> list[str]:
    findings: list[str] = []
    rss = last.process.rss_mb - first.process.rss_mb
    if rss > _RSS_CRITICAL_MB:
        findings.append(f"CRITICAL rss +{rss:.1f} MB")
    elif rss > _RSS_WARN_MB:
        findings.append(f"WARNING rss +{rss:.1f} MB")
    if last.process.gpu_vram_used_mb is not None and first.process.gpu_vram_used_mb is not None:
        vram = last.process.gpu_vram_used_mb - first.process.gpu_vram_used_mb
        if vram > _VRAM_CRITICAL_MB:
            findings.append(f"CRITICAL vram +{vram:.0f} MB")
        elif vram > _VRAM_WARN_MB:
            findings.append(f"WARNING vram +{vram:.0f} MB")
    for before, after in zip(first.caches, last.caches, strict=True):
        if after.entries > before.entries:
            findings.append(f"cache {after.name}: {before.entries} -> {after.entries}/{after.max_entries}")
    return findings or ["no significant growth"]


def main(argv: list[str]) -> int:
    options = _parse_args(argv)
    reports: list[RuntimeMemoryReport] = []
    with httpx.Client(base_url=options.base_url, timeout=30.0) as client:
        for index in range(options.samples):
            try:
                report = _fetch(client, options.deep)
            except httpx.HTTPError as exc:
                print(f"sample {index + 1}: request failed: {type(exc).__name__}: {exc}", file=sys.stderr)
                return 2
            reports.append(report)
            if not options.as_json:
                p = report.process
                vram = "n/a" if p.gpu_vram_used_mb is None else f"{p.gpu_vram_used_mb:.0f}MB"
                onnx = "n/a" if report.onnx_sessions is None else str(report.onnx_sessions)
                print(
                    f"[{index + 1:>3}/{options.samples}] rss={p.rss_mb:>8.1f}MB "
                    f"vram={vram:>8} "
                    f"caches={sum(c.entries for c in report.caches):>3} "
                    f"onnx={onnx}"
                )
            if index + 1 < options.samples:
                time.sleep(options.interval_seconds)

    findings = _growth_findings(reports[0], reports[-1])
    if options.as_json:
        print(
            json.dumps(
                {"samples": [r.model_dump(mode="json") for r in reports], "findings": findings},
                indent=2,
            )
        )
    else:
        print("\n".join(("--- findings ---", *findings)))
    return 1 if any(f.startswith("CRITICAL") for f in findings) else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
