"""ZIP packaging for cleaned outputs, spooled to disk beyond a memory threshold."""

from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
import json
import tempfile
from typing import IO
import zipfile

from pipelines.batch.orchestrator import CleanedImage

# PNGs are already held in memory by the batch; spooling the archive keeps the
# peak from doubling on large batches.
_SPOOL_MAX_BYTES = 32 * 1024 * 1024
_CHUNK_BYTES = 64 * 1024
REPORT_FILENAME = "batch_report.json"


def build_batch_archive(
    cleaned: Sequence[CleanedImage],
    report_payload: Mapping[str, object],
) -> IO[bytes]:
    """Return a readable, rewound file object owned by the caller (must close)."""
    spool = tempfile.SpooledTemporaryFile(max_size=_SPOOL_MAX_BYTES)
    with zipfile.ZipFile(spool, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        for item in cleaned:
            archive.writestr(item.output_file, item.png)
        archive.writestr(
            REPORT_FILENAME, json.dumps(report_payload, ensure_ascii=False, indent=2)
        )
    spool.seek(0)
    return spool


def iter_file_chunks(handle: IO[bytes], chunk_size: int = _CHUNK_BYTES) -> Iterator[bytes]:
    while chunk := handle.read(chunk_size):
        yield chunk
