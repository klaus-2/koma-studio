"""Container codec for the stage store's v2 payload rows.

``encode_payload``: ``b"KZ1" + zlib(utf-8 text, 6)`` — sqlite keeps the
bytes as BLOB in the TEXT-affinity columns, so the storage class itself is
the format bit. ``decode_payload`` is the total inverse: ``str`` passes
through (legacy v1 rows), ``bytes`` unwraps, any failure returns ``None``
(a cache miss, never an exception; a pre-v2 build therefore treats v2 rows
as misses). Decompression is bounded: payloads expanding past
``_MAX_DECOMPRESSED_BYTES`` are misses, never a full in-RAM expansion.
"""

from __future__ import annotations

from typing import Final
import zlib

_MAGIC: Final[bytes] = b"KZ1"  # versioned container: magic + zlib(blob)
_MAX_DECOMPRESSED_BYTES: Final = 32 << 20


def encode_payload(text: str) -> bytes:
    """Wrap canonical JSON text in the versioned container (magic + zlib)."""
    return _MAGIC + zlib.compress(text.encode("utf-8"), 6)


def decode_payload(raw: object) -> str | None:
    """Decode one stored payload cell; ``None`` means cache miss (never raises)."""
    if isinstance(raw, str):
        return raw
    if not isinstance(raw, bytes):
        return None
    if not raw.startswith(_MAGIC):
        return None
    try:
        decompressor = zlib.decompressobj()
        text = decompressor.decompress(
            raw[len(_MAGIC) :], _MAX_DECOMPRESSED_BYTES + 1
        ).decode("utf-8")
    except (zlib.error, OSError, UnicodeDecodeError):
        return None
    # decompressobj returns partial output for truncated streams instead of
    # raising; the tail/length checks enforce the size bound.
    if (
        not decompressor.eof
        or decompressor.unconsumed_tail
        or len(text) > _MAX_DECOMPRESSED_BYTES
    ):
        return None
    return text
