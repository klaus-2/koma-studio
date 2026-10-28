from __future__ import annotations

import asyncio
from collections.abc import Callable

from io import BytesIO
import json
import os
import re
from typing import Any
import zipfile

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image, UnidentifiedImageError

from routers._boundary import read_upload_bytes

try:
    import py7zr  # type: ignore[import-not-found]
    from py7zr.exceptions import DecompressionBombError  # type: ignore[import-not-found]
    from py7zr.io import BytesIOFactory  # type: ignore[import-not-found]
except Exception:  # noqa: BLE001
    py7zr = None
    DecompressionBombError = None
    BytesIOFactory = None

try:
    import pypdfium2 as pdfium  # type: ignore[import-not-found]
except Exception:  # noqa: BLE001
    pdfium = None

try:
    from psd_tools import PSDImage  # type: ignore[import-not-found]
except Exception:  # noqa: BLE001
    PSDImage = None


router = APIRouter(tags=["ingest"])

SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
ZIP_ARCHIVE_EXTENSIONS = {".zip", ".cbz"}
SEVEN_Z_ARCHIVE_EXTENSIONS = {".cb7", ".7z"}


def _file_extension(file_name: str) -> str:
    normalized = (file_name or "").strip().lower()
    return os.path.splitext(normalized)[1]


def _safe_file_component(value: str, fallback: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", (value or "").strip()).strip("-_.")
    return cleaned[:80] if cleaned else fallback


def _to_png_bytes(payload: bytes) -> bytes:
    with Image.open(BytesIO(payload)) as image:
        if image.mode in {"RGBA", "LA"}:
            normalized = image.convert("RGBA")
        else:
            normalized = image.convert("RGB")
        buffer = BytesIO()
        normalized.save(buffer, format="PNG")
        return buffer.getvalue()


def _build_output_name(sequence: int, source_file: str, original_name: str) -> str:
    source_stem = _safe_file_component(
        os.path.splitext(os.path.basename(source_file))[0],
        f"source-{sequence}",
    )
    original_stem = _safe_file_component(
        os.path.splitext(os.path.basename(original_name))[0],
        f"page-{sequence}",
    )
    return f"{sequence:04d}-{source_stem}-{original_stem}.png"


# Zip-bomb guards: manga archives are small; anything beyond these bounds is abuse or corruption.
_MAX_UPLOAD_BYTES = 200 * 1024 * 1024
_MAX_ENTRY_BYTES = 64 * 1024 * 1024
_MAX_ENTRIES = 2000
# Decoded pages are retained for the whole request, so the sum across every upload
# is what bounds memory.
_MAX_REQUEST_OUTPUT_BYTES = 1024 * 1024 * 1024
_OUTPUT_BUDGET_EXCEEDED = "{source_file}: output exceeds the supported size, remaining items skipped"


def _select_image_entries(
    candidates: list[str],
    *,
    source_file: str,
    declared_size: Callable[[str], int | None],
    warnings: list[str],
) -> list[str]:
    """Image members in stable order, within the entry count and size caps."""
    entry_names = sorted(
        [
            name
            for name in candidates
            if name and not name.endswith("/") and _file_extension(name) in SUPPORTED_IMAGE_EXTENSIONS
        ],
        key=lambda value: value.lower(),
    )
    if len(entry_names) > _MAX_ENTRIES:
        warnings.append(
            f"{source_file}: too many archive entries ({len(entry_names)}), "
            f"processing only the first {_MAX_ENTRIES}."
        )
        entry_names = entry_names[:_MAX_ENTRIES]

    kept: list[str] = []
    for entry_name in entry_names:
        size = declared_size(entry_name)
        if size is not None and size > _MAX_ENTRY_BYTES:
            warnings.append(f"{source_file}: entry too large, skipped: {entry_name}")
            continue
        kept.append(entry_name)
    return kept


def _read_factory_payload(entry_file: Any) -> bytes:
    """Rewind a py7zr writer before reading its payload."""
    entry_file.seek(0)
    return entry_file.read()


def _decode_archive_entry(
    source_file: str,
    entry_name: str,
    read_payload: Callable[[], bytes],
    warnings: list[str],
) -> dict[str, Any] | None:
    """Decode one archive member into a PNG item, or record why it was skipped."""
    try:
        entry_payload = read_payload()
        # The declared size is advisory, and py7zr's factory limit stops only after
        # the chunk that crosses it, so the produced byte count is the real cap.
        if len(entry_payload) > _MAX_ENTRY_BYTES:
            warnings.append(f"{source_file}: entry too large, skipped: {entry_name}")
            return None
        normalized = _to_png_bytes(entry_payload)
    except UnidentifiedImageError:
        warnings.append(f"{source_file}: item skipped (invalid image): {entry_name}")
        return None
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"{source_file}: failed to read item {entry_name}: {exc}")
        return None
    return {
        "source_file": source_file,
        "original_name": entry_name,
        "mime_type": "image/png",
        "payload": normalized,
    }


def _extract_from_zip_payload(
    payload: bytes,
    source_file: str,
    *,
    budget_bytes: int = _MAX_REQUEST_OUTPUT_BYTES,
) -> tuple[list[dict[str, Any]], list[str]]:
    extracted_items: list[dict[str, Any]] = []
    warnings: list[str] = []
    try:
        with zipfile.ZipFile(BytesIO(payload), mode="r") as archive:
            entry_names = _select_image_entries(
                archive.namelist(),
                source_file=source_file,
                declared_size=lambda name: archive.getinfo(name).file_size,
                warnings=warnings,
            )
            consumed_bytes = 0
            for entry_name in entry_names:
                item = _decode_archive_entry(
                    source_file,
                    entry_name,
                    lambda name=entry_name: archive.read(name),
                    warnings,
                )
                if item is None:
                    continue
                consumed_bytes += len(item["payload"])
                if consumed_bytes > budget_bytes:
                    warnings.append(_OUTPUT_BUDGET_EXCEEDED.format(source_file=source_file))
                    break
                extracted_items.append(item)
    except zipfile.BadZipFile as exc:
        raise ValueError(f"invalid ZIP/CBZ file: {exc}") from exc
    return extracted_items, warnings


def _extract_from_7z_payload(
    payload: bytes,
    source_file: str,
    *,
    budget_bytes: int = _MAX_REQUEST_OUTPUT_BYTES,
) -> tuple[list[dict[str, Any]], list[str]]:
    if py7zr is None:
        raise RuntimeError("CB7 support is unavailable (missing py7zr dependency)")

    extracted_items: list[dict[str, Any]] = []
    warnings: list[str] = []
    try:
        with py7zr.SevenZipFile(BytesIO(payload), mode="r") as header:
            declared_sizes = {
                info.filename: info.uncompressed
                for info in header.list()
                if not info.is_directory
            }
            entry_names = _select_image_entries(
                header.getnames(),
                source_file=source_file,
                declared_size=declared_sizes.get,
                warnings=warnings,
            )
        if not entry_names:
            return extracted_items, warnings

        # The header can understate member sizes, and every extracted member is held
        # in memory at once, so the extraction is capped at what the selection allows.
        output_ceiling = min(budget_bytes, _MAX_ENTRY_BYTES * len(entry_names))
        with py7zr.SevenZipFile(BytesIO(payload), mode="r", max_extract_size=output_ceiling) as archive:
            factory = BytesIOFactory(limit=_MAX_ENTRY_BYTES)
            archive.extract(targets=entry_names, factory=factory)

            consumed_bytes = 0
            for entry_name in entry_names:
                try:
                    entry_file = factory.get(entry_name)
                except KeyError:
                    warnings.append(f"{source_file}: item not found in the CB7 archive: {entry_name}")
                    continue
                item = _decode_archive_entry(
                    source_file,
                    entry_name,
                    lambda entry_file=entry_file: _read_factory_payload(entry_file),
                    warnings,
                )
                if item is None:
                    continue
                consumed_bytes += len(item["payload"])
                if consumed_bytes > budget_bytes:
                    warnings.append(_OUTPUT_BUDGET_EXCEEDED.format(source_file=source_file))
                    break
                extracted_items.append(item)
    except DecompressionBombError as exc:
        raise ValueError(
            f"CB7 archive expands beyond the supported limit: {source_file}"
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"invalid CB7 file: {exc}") from exc
    return extracted_items, warnings


def _extract_from_pdf_payload(
    payload: bytes,
    source_file: str,
    *,
    budget_bytes: int = _MAX_REQUEST_OUTPUT_BYTES,
) -> tuple[list[dict[str, Any]], list[str]]:
    if pdfium is None:
        raise RuntimeError("PDF support is unavailable (missing pypdfium2 dependency)")

    extracted_items: list[dict[str, Any]] = []
    warnings: list[str] = []
    consumed_bytes = 0
    try:
        document = pdfium.PdfDocument(payload)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"invalid PDF file: {exc}") from exc

    try:
        for page_index in range(len(document)):
            page = document.get_page(page_index)
            bitmap = None
            try:
                bitmap = page.render(scale=2.0)
                pil_image = bitmap.to_pil()
                buffer = BytesIO()
                pil_image.convert("RGB").save(buffer, format="PNG")
                page_payload = buffer.getvalue()
            finally:
                if bitmap is not None and hasattr(bitmap, "close"):
                    bitmap.close()
                if hasattr(page, "close"):
                    page.close()
            consumed_bytes += len(page_payload)
            if consumed_bytes > budget_bytes:
                warnings.append(_OUTPUT_BUDGET_EXCEEDED.format(source_file=source_file))
                break
            extracted_items.append(
                {
                    "source_file": source_file,
                    "original_name": f"page-{page_index + 1}.png",
                    "mime_type": "image/png",
                    "payload": page_payload,
                }
            )
    finally:
        if hasattr(document, "close"):
            document.close()

    return extracted_items, warnings


def _extract_from_psd_payload(payload: bytes, source_file: str) -> list[dict[str, Any]]:
    if PSDImage is None:
        raise RuntimeError("PSD support is unavailable (missing psd-tools dependency)")

    try:
        psd_image = PSDImage.open(BytesIO(payload))
        composed = psd_image.composite()
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"invalid PSD file: {exc}") from exc

    buffer = BytesIO()
    composed.save(buffer, format="PNG")
    return [
        {
            "source_file": source_file,
            "original_name": f"{os.path.splitext(os.path.basename(source_file))[0]}.png",
            "mime_type": "image/png",
            "payload": buffer.getvalue(),
        }
    ]


async def _read_upload_items(
    payload: bytes,
    *,
    source_file: str,
    file_ext: str,
    budget_bytes: int,
) -> tuple[list[dict[str, Any]], list[str]]:
    """Turn one uploaded payload into PNG items, within the remaining request budget."""
    if file_ext in SUPPORTED_IMAGE_EXTENSIONS:
        return [
            {
                "source_file": source_file,
                "original_name": source_file,
                "mime_type": "image/png",
                "payload": _to_png_bytes(payload),
            }
        ], []
    if file_ext in ZIP_ARCHIVE_EXTENSIONS:
        return await asyncio.to_thread(
            _extract_from_zip_payload, payload, source_file, budget_bytes=budget_bytes
        )
    if file_ext in SEVEN_Z_ARCHIVE_EXTENSIONS:
        return await asyncio.to_thread(
            _extract_from_7z_payload, payload, source_file, budget_bytes=budget_bytes
        )
    if file_ext == ".pdf":
        return await asyncio.to_thread(
            _extract_from_pdf_payload, payload, source_file, budget_bytes=budget_bytes
        )
    if file_ext == ".psd":
        items = await asyncio.to_thread(_extract_from_psd_payload, payload, source_file)
        return items, []
    return [], [f"{source_file}: unsupported format ({file_ext or 'unknown'})."]


@router.post("/ingest/images")
async def ingest_images(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No file was uploaded.")

    extracted_items: list[dict[str, Any]] = []
    warnings: list[str] = []
    remaining_bytes = _MAX_REQUEST_OUTPUT_BYTES
    for index, upload in enumerate(files):
        source_file = upload.filename or f"file-{index + 1}"
        file_ext = _file_extension(source_file)
        payload = await read_upload_bytes(upload, limit_bytes=_MAX_UPLOAD_BYTES, label=source_file)
        if not payload:
            warnings.append(f"{source_file}: empty file.")
            continue
        if remaining_bytes <= 0:
            warnings.append(_OUTPUT_BUDGET_EXCEEDED.format(source_file=source_file))
            continue

        try:
            file_items, file_warnings = await _read_upload_items(
                payload,
                source_file=source_file,
                file_ext=file_ext,
                budget_bytes=remaining_bytes,
            )
        except RuntimeError as exc:
            warnings.append(f"{source_file}: {exc}")
            continue
        except ValueError as exc:
            warnings.append(f"{source_file}: {exc}")
            continue
        except UnidentifiedImageError:
            warnings.append(f"{source_file}: invalid image.")
            continue
        except Exception as exc:  # noqa: BLE001
            warnings.append(f"{source_file}: failed to process file ({exc}).")
            continue

        warnings.extend(file_warnings)
        for item in file_items:
            item_bytes = len(item["payload"])
            if item_bytes > remaining_bytes:
                warnings.append(_OUTPUT_BUDGET_EXCEEDED.format(source_file=source_file))
                remaining_bytes = 0
                break
            extracted_items.append(item)
            remaining_bytes -= item_bytes

    if not extracted_items:
        detail = warnings[0] if warnings else "No valid image was found."
        raise HTTPException(status_code=400, detail=detail)

    def _build_archive() -> BytesIO:
        buffer = BytesIO()
        _write_ingest_zip(buffer, files, extracted_items, warnings)
        buffer.seek(0)
        return buffer

    archive_buffer = await asyncio.to_thread(_build_archive)
    return StreamingResponse(
        archive_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=ingested-images.zip"},
    )


def _write_ingest_zip(
    archive_buffer: BytesIO,
    files: list[UploadFile],
    extracted_items: list[dict[str, Any]],
    warnings: list[str],
) -> None:
    manifest_items: list[dict[str, str]] = []
    with zipfile.ZipFile(archive_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        for sequence, item in enumerate(extracted_items, start=1):
            output_name = _build_output_name(
                sequence=sequence,
                source_file=str(item["source_file"]),
                original_name=str(item["original_name"]),
            )
            archive_path = f"images/{output_name}"
            archive.writestr(archive_path, item["payload"])
            manifest_items.append(
                {
                    "path": archive_path,
                    "source_file": str(item["source_file"]),
                    "original_name": str(item["original_name"]),
                    "mime_type": str(item["mime_type"]),
                }
            )

        archive.writestr(
            "manifest.json",
            json.dumps(
                {
                    "total_input_files": len(files),
                    "total_output_images": len(manifest_items),
                    "warnings": warnings[:50],
                    "items": manifest_items,
                },
                ensure_ascii=False,
                indent=2,
            ).encode("utf-8"),
        )

