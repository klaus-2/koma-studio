from __future__ import annotations

from io import BytesIO
import json
import os
import re
from typing import Any
import zipfile

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image, UnidentifiedImageError

try:
    import py7zr  # type: ignore[import-not-found]
except Exception:  # noqa: BLE001
    py7zr = None

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


def _extract_from_zip_payload(payload: bytes, source_file: str) -> tuple[list[dict[str, Any]], list[str]]:
    extracted_items: list[dict[str, Any]] = []
    warnings: list[str] = []
    try:
        with zipfile.ZipFile(BytesIO(payload), mode="r") as archive:
            entry_names = sorted(
                [
                    name
                    for name in archive.namelist()
                    if name and not name.endswith("/") and _file_extension(name) in SUPPORTED_IMAGE_EXTENSIONS
                ],
                key=lambda value: value.lower(),
            )
            for entry_name in entry_names:
                try:
                    entry_payload = archive.read(entry_name)
                    normalized = _to_png_bytes(entry_payload)
                except UnidentifiedImageError:
                    warnings.append(f"{source_file}: item skipped (invalid image): {entry_name}")
                    continue
                except Exception as exc:  # noqa: BLE001
                    warnings.append(f"{source_file}: failed to read item {entry_name}: {exc}")
                    continue
                extracted_items.append(
                    {
                        "source_file": source_file,
                        "original_name": entry_name,
                        "mime_type": "image/png",
                        "payload": normalized,
                    }
                )
    except zipfile.BadZipFile as exc:
        raise ValueError(f"invalid ZIP/CBZ file: {exc}") from exc
    return extracted_items, warnings


def _extract_from_7z_payload(payload: bytes, source_file: str) -> tuple[list[dict[str, Any]], list[str]]:
    if py7zr is None:
        raise RuntimeError("CB7 support is unavailable (missing py7zr dependency)")

    extracted_items: list[dict[str, Any]] = []
    warnings: list[str] = []
    try:
        with py7zr.SevenZipFile(BytesIO(payload), mode="r") as archive:
            entry_names = sorted(
                [
                    name
                    for name in archive.getnames()
                    if name and not name.endswith("/") and _file_extension(name) in SUPPORTED_IMAGE_EXTENSIONS
                ],
                key=lambda value: value.lower(),
            )
            if not entry_names:
                return extracted_items, warnings

            try:
                extracted_map = archive.read(targets=entry_names)
            except TypeError:
                extracted_map = archive.readall()
            for entry_name in entry_names:
                entry_file = extracted_map.get(entry_name)
                if entry_file is None:
                    warnings.append(f"{source_file}: item not found in the CB7 archive: {entry_name}")
                    continue
                try:
                    if hasattr(entry_file, "read"):
                        entry_payload = entry_file.read()
                    elif isinstance(entry_file, (bytes, bytearray)):
                        entry_payload = bytes(entry_file)
                    else:
                        raise TypeError("unsupported entry type")
                    normalized = _to_png_bytes(entry_payload)
                except UnidentifiedImageError:
                    warnings.append(f"{source_file}: item skipped (invalid image): {entry_name}")
                    continue
                except Exception as exc:  # noqa: BLE001
                    warnings.append(f"{source_file}: failed to read item {entry_name}: {exc}")
                    continue
                extracted_items.append(
                    {
                        "source_file": source_file,
                        "original_name": entry_name,
                        "mime_type": "image/png",
                        "payload": normalized,
                    }
                )
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"invalid CB7 file: {exc}") from exc
    return extracted_items, warnings


def _extract_from_pdf_payload(payload: bytes, source_file: str) -> list[dict[str, Any]]:
    if pdfium is None:
        raise RuntimeError("PDF support is unavailable (missing pypdfium2 dependency)")

    extracted_items: list[dict[str, Any]] = []
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
                extracted_items.append(
                    {
                        "source_file": source_file,
                        "original_name": f"page-{page_index + 1}.png",
                        "mime_type": "image/png",
                        "payload": buffer.getvalue(),
                    }
                )
            finally:
                if bitmap is not None and hasattr(bitmap, "close"):
                    bitmap.close()
                if hasattr(page, "close"):
                    page.close()
    finally:
        if hasattr(document, "close"):
            document.close()

    return extracted_items


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


@router.post("/ingest/images")
async def ingest_images(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No file was uploaded.")

    extracted_items: list[dict[str, Any]] = []
    warnings: list[str] = []
    for index, upload in enumerate(files):
        source_file = upload.filename or f"file-{index + 1}"
        file_ext = _file_extension(source_file)
        payload = await upload.read()
        if not payload:
            warnings.append(f"{source_file}: empty file.")
            continue

        try:
            if file_ext in SUPPORTED_IMAGE_EXTENSIONS:
                normalized = _to_png_bytes(payload)
                extracted_items.append(
                    {
                        "source_file": source_file,
                        "original_name": source_file,
                        "mime_type": "image/png",
                        "payload": normalized,
                    }
                )
                continue

            if file_ext in ZIP_ARCHIVE_EXTENSIONS:
                archive_items, archive_warnings = _extract_from_zip_payload(payload, source_file)
                extracted_items.extend(archive_items)
                warnings.extend(archive_warnings)
                continue

            if file_ext in SEVEN_Z_ARCHIVE_EXTENSIONS:
                archive_items, archive_warnings = _extract_from_7z_payload(payload, source_file)
                extracted_items.extend(archive_items)
                warnings.extend(archive_warnings)
                continue

            if file_ext == ".pdf":
                extracted_items.extend(_extract_from_pdf_payload(payload, source_file))
                continue

            if file_ext == ".psd":
                extracted_items.extend(_extract_from_psd_payload(payload, source_file))
                continue

            warnings.append(f"{source_file}: unsupported format ({file_ext or 'unknown'}).")
        except RuntimeError as exc:
            warnings.append(f"{source_file}: {exc}")
        except ValueError as exc:
            warnings.append(f"{source_file}: {exc}")
        except UnidentifiedImageError:
            warnings.append(f"{source_file}: invalid image.")
        except Exception as exc:  # noqa: BLE001
            warnings.append(f"{source_file}: failed to process file ({exc}).")

    if not extracted_items:
        detail = warnings[0] if warnings else "No valid image was found."
        raise HTTPException(status_code=400, detail=detail)

    archive_buffer = BytesIO()
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

    archive_buffer.seek(0)
    return StreamingResponse(
        archive_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=ingested-images.zip"},
    )
