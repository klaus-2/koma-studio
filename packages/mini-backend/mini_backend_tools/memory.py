from __future__ import annotations

import argparse
import asyncio
import json
import logging
import math
import sys
from collections.abc import Sequence
from typing import Annotated, Literal

import httpx
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    ValidationError,
    field_validator,
)

from mini_backend_tools.observability import configure_logging

logger = logging.getLogger(__name__)

_MAX_REPORT_BYTES = 2 * 1024 * 1024

# Assignment alias (not PEP 695 `type X = ...`): the embedded runtime venv
# runs pydantic 2.9, which cannot resolve PEP 695 aliases for field schemas.
NonnegativeFloat = Annotated[float, Field(ge=0, allow_inf_nan=False)]


class ProcessMemory(BaseModel):
    model_config = ConfigDict(extra="allow")

    rss_mb: NonnegativeFloat
    gpu_vram_used_mb: NonnegativeFloat | None = None


class CacheMemory(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str = Field(min_length=1, max_length=256)
    entries: int = Field(ge=0)
    max_entries: int | None = Field(default=None, ge=0)


class MemoryReport(BaseModel):
    model_config = ConfigDict(extra="allow")

    process: ProcessMemory
    caches: list[CacheMemory] = Field(default_factory=list, max_length=10_000)
    onnx_sessions: int | None = Field(default=None, ge=0)

    @field_validator("caches")
    @classmethod
    def unique_cache_names(cls, caches: list[CacheMemory]) -> list[CacheMemory]:
        if len({cache.name for cache in caches}) != len(caches):
            raise ValueError("Duplicate cache names")
        return caches


class Options(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    base_url: HttpUrl = HttpUrl("http://127.0.0.1:8765")
    interval_seconds: float = Field(default=5.0, ge=0, le=86_400, allow_inf_nan=False)
    samples: int = Field(default=12, ge=1, le=1_000_000)
    deep: bool = False
    as_json: bool = False

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, url: HttpUrl) -> HttpUrl:
        if url.username or url.password or url.query or url.fragment:
            raise ValueError("Base URL must not contain credentials, query or fragment")
        return url


class Finding(BaseModel):
    model_config = ConfigDict(frozen=True)

    severity: Literal["INFO", "WARNING", "CRITICAL"]
    message: str


class MemoryProbeError(RuntimeError):
    """The diagnostic response violated the probe resource policy."""


def parse_args(argv: Sequence[str]) -> Options:
    parser = argparse.ArgumentParser(description="Sample backend memory growth.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8765")
    parser.add_argument("--interval", default="5")
    parser.add_argument("--samples", default="12")
    parser.add_argument("--deep", action="store_true")
    parser.add_argument("--json", action="store_true")

    namespace = vars(parser.parse_args(list(argv)))
    try:
        return Options.model_validate(
            {
                "base_url": namespace["base_url"],
                "interval_seconds": namespace["interval"],
                "samples": namespace["samples"],
                "deep": namespace["deep"],
                "as_json": namespace["json"],
            }
        )
    except ValidationError:
        parser.error("Invalid URL, interval or sample count")


async def fetch_report(client: httpx.AsyncClient, *, deep: bool) -> MemoryReport:
    chunks = bytearray()
    async with client.stream(
        "GET",
        "diagnostics/memory",
        params={"deep": str(deep).lower()},
        headers={"Accept": "application/json", "Accept-Encoding": "identity"},
    ) as response:
        response.raise_for_status()
        if response.headers.get("content-encoding", "identity") != "identity":
            raise MemoryProbeError("Compressed diagnostic responses are not accepted")

        async for chunk in response.aiter_raw():
            if len(chunks) + len(chunk) > _MAX_REPORT_BYTES:
                raise MemoryProbeError("Diagnostic response exceeds the byte budget")
            chunks.extend(chunk)

    return MemoryReport.model_validate_json(bytes(chunks))


def growth_findings(first: MemoryReport, last: MemoryReport) -> list[Finding]:
    findings: list[Finding] = []

    def inspect(metric: str, delta: float, warning: float, critical: float) -> None:
        if not math.isfinite(delta):
            raise MemoryProbeError("Nonfinite memory delta")
        if delta > critical:
            severity: Literal["WARNING", "CRITICAL"] = "CRITICAL"
        elif delta > warning:
            severity = "WARNING"
        else:
            return
        findings.append(
            Finding(severity=severity, message=f"{metric} +{delta:.1f} MB")
        )

    inspect("rss", last.process.rss_mb - first.process.rss_mb, 50, 100)
    first_vram = first.process.gpu_vram_used_mb
    last_vram = last.process.gpu_vram_used_mb
    if first_vram is not None and last_vram is not None:
        inspect("vram", last_vram - first_vram, 100, 500)
    elif first_vram != last_vram:
        findings.append(
            Finding(severity="WARNING", message="VRAM measurements are not comparable")
        )

    before = {cache.name: cache for cache in first.caches}
    after = {cache.name: cache for cache in last.caches}
    for name in sorted(before.keys() | after.keys()):
        previous = before.get(name)
        current = after.get(name)
        if previous is None or current is None:
            findings.append(
                Finding(severity="INFO", message=f"cache topology changed: {name}")
            )
        elif current.entries > previous.entries:
            findings.append(
                Finding(
                    severity="INFO",
                    message=(
                        f"cache {name}: {previous.entries} -> "
                        f"{current.entries}/{current.max_entries}"
                    ),
                )
            )

    return findings or [Finding(severity="INFO", message="no significant growth")]


def _write_output(value: str) -> None:
    sys.stdout.write(value)
    sys.stdout.flush()


async def sample(options: Options) -> int:
    first: MemoryReport | None = None
    last: MemoryReport | None = None
    completed = 0
    error_code: str | None = None
    findings: list[Finding] = []

    if options.as_json:
        await asyncio.to_thread(_write_output, '{"samples":[')

    try:
        async with httpx.AsyncClient(
            base_url=f"{str(options.base_url).rstrip('/')}/",
            timeout=httpx.Timeout(30.0, connect=5.0),
            limits=httpx.Limits(max_connections=1, max_keepalive_connections=1),
            follow_redirects=False,
            trust_env=False,
        ) as client:
            for index in range(options.samples):
                report = await fetch_report(client, deep=options.deep)
                first = report if first is None else first
                last = report

                if options.as_json:
                    separator = "," if completed else ""
                    await asyncio.to_thread(
                        _write_output,
                        separator + report.model_dump_json(),
                    )
                else:
                    logger.info(
                        "memory.sample",
                        extra={
                            "sample": index + 1,
                            "rss_mb": report.process.rss_mb,
                            "vram_mb": report.process.gpu_vram_used_mb,
                            "cache_entries": sum(item.entries for item in report.caches),
                            "onnx_sessions": report.onnx_sessions,
                        },
                    )
                completed += 1
                if completed < options.samples:
                    await asyncio.sleep(options.interval_seconds)

    except (httpx.HTTPError, ValidationError, MemoryProbeError) as exc:
        error_code = type(exc).__name__
        logger.error(
            "memory.probe_failed",
            extra={"sample": completed + 1, "error_type": error_code},
        )
    finally:
        if first is not None and last is not None and error_code is None:
            findings = growth_findings(first, last)
        if options.as_json:
            suffix = json.dumps(
                {
                    "findings": [finding.model_dump() for finding in findings],
                    "complete": completed == options.samples,
                    "error": error_code,
                },
                allow_nan=False,
            )
            await asyncio.to_thread(_write_output, "]," + suffix[1:] + "\n")

    if error_code is not None:
        return 2

    for finding in findings:
        logger.info(
            "memory.finding",
            extra={"severity": finding.severity, "finding": finding.message},
        )
    return int(any(finding.severity == "CRITICAL" for finding in findings))


def main(argv: Sequence[str]) -> int:
    configure_logging()
    options = parse_args(argv)
    try:
        return asyncio.run(sample(options))
    except KeyboardInterrupt:
        logger.warning("memory.interrupted")
        return 130
    except BrokenPipeError:
        return 2
