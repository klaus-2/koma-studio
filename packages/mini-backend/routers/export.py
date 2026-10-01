from __future__ import annotations

import asyncio
from io import BytesIO
import json
import logging
import tempfile
import threading
from pathlib import Path
import re
import shutil
from typing import Any
import zipfile

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError

from models.errors import ExportError, PsdExportError
from pipelines.export_pipeline import ExportPipeline
from routers.uploads import decode_upload, read_upload_limited
from schemas.export import CompressionType, ExportRequest, ExportResponse, TextLayerEngine
from utils.photoshop_text_layers import SUPPORTED_PHOTOSHOP_VERSIONS


router = APIRouter(tags=["export"])
_EXPORT_PIPELINE: ExportPipeline | None = None
_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
_ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}
_ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
_OVERLAY_CONTENT_TYPES = {"image/png", "image/webp"}
_MAX_TEXT_LAYERS = 1000
_FILENAME_SPACES_RE = re.compile(r"\s+")
_FILENAME_SAFE_RE = re.compile(r"[^0-9A-Za-z._-]+")
_EXPORT_TIMEOUT_SECONDS = 120.0
logger = logging.getLogger(__name__)


_PIPELINE_LOCK = threading.Lock()


def _get_export_pipeline() -> ExportPipeline:
    """Initialize the export pipeline on demand (double-checked, thread-safe)."""

    global _EXPORT_PIPELINE
    if _EXPORT_PIPELINE is not None:
        return _EXPORT_PIPELINE
    with _PIPELINE_LOCK:
        if _EXPORT_PIPELINE is None:
            try:
                _EXPORT_PIPELINE = ExportPipeline.build()
            except HTTPException:
                raise
            except (FileNotFoundError, RuntimeError) as exc:
                message = str(exc).strip() or "The required models are not installed for export."
                logger.warning("Failed to initialize ExportPipeline: %s", message)
                raise HTTPException(status_code=400, detail=message) from exc
            except Exception as exc:
                logger.exception("Unexpected failure while initializing ExportPipeline")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to initialize the export pipeline.",
                ) from exc
    return _EXPORT_PIPELINE


def _validate_file(content_type: str | None, filename: str | None, payload: bytes) -> None:
    """
    Validate the type and size of the input file.

    Args:
        content_type: Content-Type do upload.
        filename: Original file name.
        payload: Bytes of the uploaded file.
    """

    normalized_content_type = (content_type or "").lower().strip()
    if normalized_content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail="Unsupported format. Accepted: PNG, JPEG, WEBP",
        )

    suffix = Path(filename or "").suffix.lower()
    if suffix not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail="Unsupported format. Accepted: PNG, JPEG, WEBP",
        )

    if len(payload) > _MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File is too large. Maximum: 50MB",
        )


def _build_export_stem(filename: str | None) -> str:
    """
    Build the default base name for PSD export files.

    Args:
        filename: Input file name.

    Returns:
        Nome-base no formato `koma-studio-aio-render-<origem-normalizada>`.
    """

    raw_stem = Path(filename or "image").stem.strip()
    normalized = _FILENAME_SPACES_RE.sub("-", raw_stem)
    normalized = _FILENAME_SAFE_RE.sub("-", normalized)
    normalized = normalized.strip("-_.")
    if not normalized:
        normalized = "image"
    return f"koma-studio-aio-render-{normalized}"


def _build_export_request(
    *,
    language: str,
    include_ocr_overlay: bool,
    include_individual_crops: bool,
    include_metadata_json: bool,
    compression: str,
    text_layer_engine: str,
    dpi: int,
) -> ExportRequest:
    """
    Monta e valida `ExportRequest` a partir dos campos de formulario.

    Raises:
        HTTPException: When export fields are invalid.
    """

    try:
        return ExportRequest(
            language=language,
            include_ocr_overlay=include_ocr_overlay,
            include_individual_crops=include_individual_crops,
            include_metadata_json=include_metadata_json,
            compression=CompressionType(compression),
            text_layer_engine=TextLayerEngine(text_layer_engine),
            dpi=dpi,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


async def _read_render_overlay(
    overlay_file: UploadFile | None,
    *,
    expected_size: tuple[int, int],
    label: str,
) -> Image.Image | None:
    """
    Load the optional rendered-text overlay.

    Args:
        overlay_file: Overlay file sent in the multipart request.
        expected_size: Expected size (width, height).
        label: Overlay identifier used in error messages.

    Returns:
        RGBA overlay image, or `None` when absent.
    """

    if overlay_file is None:
        return None

    raw_payload = await overlay_file.read()
    if not raw_payload:
        return None

    normalized_content_type = (overlay_file.content_type or "").lower().strip()
    if normalized_content_type not in _OVERLAY_CONTENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported overlay format for {label}. Accepted: PNG, WEBP",
        )

    try:
        overlay = Image.open(BytesIO(raw_payload)).convert("RGBA")
    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=422, detail=f"Invalid overlay file for {label}"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Failed to read the {label} overlay"
        ) from exc

    if overlay.size != expected_size:
        raise HTTPException(
            status_code=422,
            detail=f"Overlay {label} must match the base image dimensions",
        )
    return overlay


def _parse_layer_int(item: dict[str, Any], key: str, *, label: str, default: int) -> int:
    """``int(item[key])`` with a 422 instead of an unhandled ValueError."""
    try:
        return int(item.get(key, default))
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=422, detail=f"Invalid {key} for layer '{label}'"
        ) from exc


async def _read_text_layers(
    *,
    manifest_raw: str | None,
    files: list[UploadFile] | None,
    expected_size: tuple[int, int],
) -> list[dict[str, Any]]:
    """
    Load editable text layers (manifest JSON + RGBA layer files).

    Args:
        manifest_raw: JSON describing each layer.
        files: Layer image files.
        expected_size: Expected base size (width, height).

    Returns:
        Normalized layer descriptors ready for the pipeline.
    """

    if not manifest_raw:
        return []

    try:
        manifest_payload = json.loads(manifest_raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid text_layers manifest (JSON)") from exc

    if not isinstance(manifest_payload, list):
        raise HTTPException(status_code=400, detail="The text_layers manifest must be a JSON list")
    if len(manifest_payload) > _MAX_TEXT_LAYERS:
        raise HTTPException(
            status_code=422,
            detail=f"Too many text layers. Maximum: {_MAX_TEXT_LAYERS}",
        )

    file_map: dict[str, Image.Image] = {}
    for upload in files or []:
        filename = Path(upload.filename or "").name
        if not filename:
            raise HTTPException(status_code=422, detail="Text-layer file has no name")

        payload = await read_upload_limited(
            upload, limit_bytes=_MAX_FILE_SIZE_BYTES, label=f"Text layer '{filename}'"
        )
        if not payload:
            continue

        layer_image = await decode_upload(
            payload, mode="RGBA", label=f"Text layer '{filename}'"
        )
        file_map[filename] = layer_image

    normalized_layers: list[dict[str, Any]] = []
    expected_width, expected_height = expected_size
    for idx, item in enumerate(manifest_payload):
        if not isinstance(item, dict):
            raise HTTPException(status_code=422, detail=f"Invalid layer entry #{idx + 1}")

        filename = str(item.get("fileName", "")).strip()
        if not filename:
            raise HTTPException(status_code=422, detail=f"Layer #{idx + 1} has no fileName")

        image = file_map.get(filename)
        if image is None:
            raise HTTPException(status_code=422, detail=f"File for layer '{filename}' was not found")

        label = filename
        left = _parse_layer_int(item, "left", label=label, default=0)
        top = _parse_layer_int(item, "top", label=label, default=0)
        if left < 0 or top < 0:
            raise HTTPException(status_code=422, detail=f"Invalid position for layer '{filename}'")
        if left + image.width > expected_width or top + image.height > expected_height:
            raise HTTPException(
                status_code=422,
                detail=f"Layer '{filename}' exceeds the bounds of the base image",
            )

        layer_name = str(item.get("name", Path(filename).stem)).strip() or Path(filename).stem
        layer_kind = str(item.get("kind", "rendered")).strip().lower() or "rendered"
        layer_text = str(item.get("text", "")).strip()
        layer_width = _parse_layer_int(item, "width", label=label, default=image.width)
        layer_height = _parse_layer_int(item, "height", label=label, default=image.height)
        if layer_width <= 0 or layer_height <= 0:
            raise HTTPException(status_code=422, detail=f"Invalid size for layer '{filename}'")

        raw_style = item.get("style", {})
        if raw_style is None:
            layer_style: dict[str, Any] = {}
        elif isinstance(raw_style, dict):
            layer_style = raw_style
        else:
            raise HTTPException(status_code=422, detail=f"Invalid style for layer '{filename}'")

        normalized_layers.append(
            {
                "name": layer_name,
                "kind": layer_kind,
                "left": left,
                "top": top,
                "width": layer_width,
                "height": layer_height,
                "text": layer_text,
                "style": layer_style,
                "image": image,
            }
        )

    return normalized_layers


async def _load_export_image(file: UploadFile) -> tuple[bytes, Image.Image]:
    # Reject bad content-type/extension before spending bandwidth reading the body.
    _validate_file(file.content_type, file.filename, b"")
    payload = await read_upload_limited(
        file, limit_bytes=_MAX_FILE_SIZE_BYTES, label="Image"
    )
    _validate_file(file.content_type, file.filename, payload)
    image = await decode_upload(payload, mode="RGB", label="Uploaded image")
    return payload, image


async def _collect_render_inputs(
    *,
    raw_text_overlay: UploadFile | None,
    translated_text_overlay: UploadFile | None,
    rendered_text_overlay: UploadFile | None,
    text_layers_manifest: str | None,
    text_layer_files: list[UploadFile] | None,
    expected_size: tuple[int, int],
) -> tuple[dict[str, Image.Image], list[dict[str, Any]]]:
    render_overlays: dict[str, Image.Image] = {}

    raw_overlay = await _read_render_overlay(
        raw_text_overlay, expected_size=expected_size, label="raw_text"
    )
    if raw_overlay is not None:
        render_overlays["raw_text"] = raw_overlay

    translated_overlay = await _read_render_overlay(
        translated_text_overlay, expected_size=expected_size, label="translated_text"
    )
    if translated_overlay is not None:
        render_overlays["translated_text"] = translated_overlay

    rendered_overlay = await _read_render_overlay(
        rendered_text_overlay, expected_size=expected_size, label="rendered_text"
    )
    if rendered_overlay is not None:
        render_overlays["rendered_text"] = rendered_overlay

    render_text_layers = await _read_text_layers(
        manifest_raw=text_layers_manifest,
        files=text_layer_files,
        expected_size=expected_size,
    )
    return render_overlays, render_text_layers


async def _run_export(
    background_tasks: BackgroundTasks,
    *,
    image: Image.Image,
    request: ExportRequest,
    render_overlays: dict[str, Image.Image],
    render_text_layers: list[dict[str, Any]],
) -> tuple[Path, Path | None, ExportResponse]:
    """Owns the temp directory: cleans it on any failure, delegates to a
    BackgroundTask on success."""

    temp_dir = Path(tempfile.mkdtemp(prefix="koma_export_"))
    try:
        try:
            psd_path, json_path, response = await asyncio.wait_for(
                _get_export_pipeline().run(
                    image=image,
                    options=request,
                    output_dir=temp_dir,
                    render_overlays=render_overlays,
                    render_text_layers=render_text_layers,
                ),
                timeout=_EXPORT_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            logger.warning("export timed out after %.0fs", _EXPORT_TIMEOUT_SECONDS)
            raise HTTPException(
                status_code=504,
                detail="Time limit exceeded (120s). Try resizing the image and run it again.",
            ) from exc
        except (PsdExportError, ExportError) as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001 — HTTP boundary
            logger.exception("Export pipeline failed unexpectedly")
            raise HTTPException(status_code=500, detail="Export failed") from exc
    except BaseException:
        # Any failure (including cancellation mid-run) must not leak a PSD.
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise

    background_tasks.add_task(shutil.rmtree, temp_dir, ignore_errors=True)
    return psd_path, json_path, response


@router.post("/export/psd", response_class=FileResponse)
async def export_psd(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    raw_text_overlay: UploadFile | None = File(None),
    translated_text_overlay: UploadFile | None = File(None),
    rendered_text_overlay: UploadFile | None = File(None),
    text_layers_manifest: str | None = Form(None),
    text_layer_files: list[UploadFile] | None = File(None),
    language: str = Form("ja"),
    include_ocr_overlay: bool = Form(True),
    include_individual_crops: bool = Form(True),
    compression: str = Form("rle"),
    text_layer_engine: str = Form("photoshop"),
    dpi: int = Form(300),
):
    """
    Export the uploaded image to PSD.

    Returns:
        PSD file as `image/vnd.adobe.photoshop`.
    """

    _payload, image = await _load_export_image(file)

    request = _build_export_request(
        language=language,
        include_ocr_overlay=include_ocr_overlay,
        include_individual_crops=include_individual_crops,
        include_metadata_json=False,
        compression=compression,
        text_layer_engine=text_layer_engine,
        dpi=dpi,
    )

    render_overlays, render_text_layers = await _collect_render_inputs(
        raw_text_overlay=raw_text_overlay,
        translated_text_overlay=translated_text_overlay,
        rendered_text_overlay=rendered_text_overlay,
        text_layers_manifest=text_layers_manifest,
        text_layer_files=text_layer_files,
        expected_size=(image.width, image.height),
    )

    psd_path, _json_path, response = await _run_export(
        background_tasks,
        image=image,
        request=request,
        render_overlays=render_overlays,
        render_text_layers=render_text_layers,
    )

    download_stem = _build_export_stem(file.filename)
    download_filename = f"{download_stem}.psd"
    export_payload = response.model_dump()
    export_payload["psd_filename"] = download_filename

    return FileResponse(
        path=psd_path,
        media_type="image/vnd.adobe.photoshop",
        filename=download_filename,
        background=background_tasks,
        headers={
            # Headers are latin-1: non-ASCII layer names must be escaped, not raw.
            "X-Koma-Export": json.dumps(export_payload, ensure_ascii=True, separators=(",", ":")),
        },
    )


@router.post("/export/psd-with-metadata")
async def export_psd_with_metadata(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    raw_text_overlay: UploadFile | None = File(None),
    translated_text_overlay: UploadFile | None = File(None),
    rendered_text_overlay: UploadFile | None = File(None),
    text_layers_manifest: str | None = Form(None),
    text_layer_files: list[UploadFile] | None = File(None),
    language: str = Form("ja"),
    include_ocr_overlay: bool = Form(True),
    include_individual_crops: bool = Form(True),
    compression: str = Form("rle"),
    text_layer_engine: str = Form("photoshop"),
    dpi: int = Form(300),
):
    """
    Exporta PSD + metadata JSON compactados em ZIP.

    Returns:
        FileResponse com ZIP contendo `.psd` e `.json`.
    """

    _payload, image = await _load_export_image(file)

    request = _build_export_request(
        language=language,
        include_ocr_overlay=include_ocr_overlay,
        include_individual_crops=include_individual_crops,
        include_metadata_json=True,
        compression=compression,
        text_layer_engine=text_layer_engine,
        dpi=dpi,
    )

    render_overlays, render_text_layers = await _collect_render_inputs(
        raw_text_overlay=raw_text_overlay,
        translated_text_overlay=translated_text_overlay,
        rendered_text_overlay=rendered_text_overlay,
        text_layers_manifest=text_layers_manifest,
        text_layer_files=text_layer_files,
        expected_size=(image.width, image.height),
    )

    psd_path, json_path, _response = await _run_export(
        background_tasks,
        image=image,
        request=request,
        render_overlays=render_overlays,
        render_text_layers=render_text_layers,
    )

    stem = _build_export_stem(file.filename)
    zip_filename = f"{stem}_export.zip"
    zip_path = psd_path.parent / zip_filename

    def _write_export_zip() -> None:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
            zip_file.write(psd_path, arcname=f"{stem}.psd")
            if json_path is not None:
                zip_file.write(json_path, arcname=f"{stem}.json")

    await asyncio.to_thread(_write_export_zip)

    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename=zip_filename,
        background=background_tasks,
    )


@router.get("/export/formats")
async def get_export_formats() -> dict[str, object]:
    """Return the export capabilities and limits supported by the backend."""

    return {
        "formats": ["psd"],
        "compression_options": ["rle", "zip", "raw"],
        "text_layer_engines": ["photoshop", "raster"],
        "photoshop_required_for_editable_text_layers": True,
        "photoshop_versions_tested": list(SUPPORTED_PHOTOSHOP_VERSIONS),
        "max_file_size_mb": 50,
        "accepted_input_formats": ["png", "jpeg", "webp"],
        "accepted_content_types": ["image/png", "image/jpeg", "image/webp"],
        "max_dpi": 1200,
        "compatibility": [
            "Adobe Photoshop CC 2020+",
            "Clip Studio Paint 2.x",
            "Krita 5.x",
            "GIMP 2.10+",
        ],
        "notes": {
            "layers": "The 'raster' engine produces PixelLayers. The 'photoshop' engine requires a local Adobe Photoshop install for editable text layers.",
            "color_mode": "RGB 8-bit",
        },
    }
