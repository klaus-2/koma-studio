from __future__ import annotations

from pathlib import Path
import logging

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from psd_tools import PSDImage
from psd_tools.constants import BlendMode, Compression

from schemas.export import DetectionResult, DetectionType, ExportRequest, PipelineResult, TextLayerEngine


logger = logging.getLogger(__name__)

COMPRESSION_MAP: dict[str, Compression] = {
    "rle": Compression.RLE,
    "zip": Compression.ZIP,
    "raw": Compression.RAW,
}

GROUP_ORIGINAL = "🖼️ Original"
GROUP_DETECTION = "🔍 Detection"
GROUP_CLEANED = "🧹 Cleaning"
GROUP_OCR = "📝 OCR"
GROUP_RENDER_TEXT = "✍️ Rendered Text"
GROUP_READY = "✅ Ready"

LAYER_ORIGINAL_SCAN = "scan_original"
LAYER_TEXT_REGIONS_MASK = "text_regions_mask"
LAYER_BUBBLE_MASK = "bubbles_mask"
LAYER_INPAINTED = "cleaned_image"
LAYER_INPAINT_MASK_VISUAL = "inpaint_mask_visual"
LAYER_OCR_OVERLAY = "ocr_overlay"
LAYER_TEXT_CROP_PREFIX = "text"
LAYER_TEXT_RAW_OVERLAY = "text_overlay_raw"
LAYER_TEXT_TRANSLATED_OVERLAY = "text_overlay_translated"
LAYER_TEXT_RENDERED_OVERLAY = "text_overlay_rendered"
LAYER_FINAL_CLEAN = "final_clean"


class PSDExporter:
    """Export pipeline results to a PSD structured into groups and layers."""

    def __init__(self, compression: str = "rle") -> None:
        """
        Inicializa o exportador de PSD.

        Args:
            compression: Compression type (`rle`, `zip`, `raw`).

        Raises:
            ValueError: When the given compression type is invalid.
        """

        normalized = (compression or "").strip().lower()
        if normalized not in COMPRESSION_MAP:
            raise ValueError(f"Invalid compression: {compression}")
        self._compression: Compression = COMPRESSION_MAP[normalized]
        self.last_group_count: int = 0
        self.last_layer_count: int = 0

    def export(self, result: PipelineResult, output_path: Path, options: ExportRequest) -> Path:
        """
        Export a `PipelineResult` to a PSD file.

        Args:
            result: Complete pipeline result.
            output_path: Final path of the PSD file.
            options: Export options.

        Returns:
            Path of the saved PSD file.
        """

        output_path.parent.mkdir(parents=True, exist_ok=True)

        original = result.original.convert("RGBA")
        cleaned = result.cleaned.convert("RGBA")
        mask = result.mask

        psd = PSDImage.new(mode="RGB", size=(original.width, original.height), depth=8)
        layer_count = 0
        group_count = 0

        # 1) Fundo: original scan
        original_group = psd.create_group(name=GROUP_ORIGINAL)
        original_group.visible = False
        group_count += 1
        original_layer = psd.create_pixel_layer(
            image=original,
            name=LAYER_ORIGINAL_SCAN,
            top=0,
            left=0,
            compression=self._compression,
            blend_mode=BlendMode.NORMAL,
            opacity=255,
        )
        original_layer.move_to_group(original_group)
        layer_count += 1

        # 2) Detection masks
        detection_group = psd.create_group(name=GROUP_DETECTION)
        detection_group.visible = False
        group_count += 1
        text_mask = self._render_detection_mask(
            size=(original.width, original.height),
            detections=result.detections,
            det_type=DetectionType.TEXT,
            color=(0, 120, 255, 180),
        )
        if text_mask is not None:
            text_mask_layer = psd.create_pixel_layer(
                image=text_mask.convert("RGBA"),
                name=LAYER_TEXT_REGIONS_MASK,
                top=0,
                left=0,
                compression=self._compression,
                blend_mode=BlendMode.NORMAL,
                opacity=255,
            )
            text_mask_layer.move_to_group(detection_group)
            layer_count += 1

        bubble_mask = self._render_detection_mask(
            size=(original.width, original.height),
            detections=result.detections,
            det_type=DetectionType.BUBBLE,
            color=(255, 165, 0, 180),
        )
        if bubble_mask is not None:
            bubble_mask_layer = psd.create_pixel_layer(
                image=bubble_mask.convert("RGBA"),
                name=LAYER_BUBBLE_MASK,
                top=0,
                left=0,
                compression=self._compression,
                blend_mode=BlendMode.NORMAL,
                opacity=255,
            )
            bubble_mask_layer.move_to_group(detection_group)
            layer_count += 1

        # 3) Cleaned/inpainted assets
        cleaned_group = psd.create_group(name=GROUP_CLEANED)
        cleaned_group.visible = False
        group_count += 1

        inpainted_layer = psd.create_pixel_layer(
            image=cleaned,
            name=LAYER_INPAINTED,
            top=0,
            left=0,
            compression=self._compression,
            blend_mode=BlendMode.NORMAL,
            opacity=255,
        )
        inpainted_layer.move_to_group(cleaned_group)
        layer_count += 1

        mask_visual = self._mask_to_rgba(mask=mask, color=(255, 0, 0))
        mask_visual_layer = psd.create_pixel_layer(
            image=mask_visual,
            name=LAYER_INPAINT_MASK_VISUAL,
            top=0,
            left=0,
            compression=self._compression,
            blend_mode=BlendMode.MULTIPLY,
            opacity=128,
        )
        mask_visual_layer.move_to_group(cleaned_group)
        layer_count += 1

        # 4) OCR assets
        ocr_group = psd.create_group(name=GROUP_OCR)
        ocr_group.visible = False
        group_count += 1

        if options.include_ocr_overlay and result.detections:
            overlay = self._render_ocr_overlay(base=original, detections=result.detections)
            overlay_layer = psd.create_pixel_layer(
                image=overlay.convert("RGBA"),
                name=LAYER_OCR_OVERLAY,
                top=0,
                left=0,
                compression=self._compression,
                blend_mode=BlendMode.NORMAL,
                opacity=255,
            )
            overlay_layer.move_to_group(ocr_group)
            layer_count += 1

        if options.include_individual_crops:
            text_detections = [det for det in result.detections if det.text]
            for idx, detection in enumerate(text_detections):
                crop, left, top = self._crop_region(original, detection.bbox, pad=4)
                language = (detection.language or options.language or "unknown").strip().lower() or "unknown"
                crop_layer = psd.create_pixel_layer(
                    image=crop.convert("RGBA"),
                    name=f"{LAYER_TEXT_CROP_PREFIX}_{idx:02d}_{language}",
                    top=top,
                    left=left,
                    compression=self._compression,
                    blend_mode=BlendMode.NORMAL,
                    opacity=255,
                )
                crop_layer.move_to_group(ocr_group)
                layer_count += 1

        # 5) Render text layers (optional, coming from the frontend)
        render_text_layers = result.render_text_layers or []
        render_overlays = result.render_overlays or {}
        use_photoshop_text_layers = (
            options.text_layer_engine == TextLayerEngine.PHOTOSHOP and bool(render_text_layers)
        )
        raster_render_text_layers = (
            [
                entry for entry in render_text_layers
                if isinstance(entry.get("style"), dict) and bool(entry["style"].get("gradientEnabled"))
            ]
            if use_photoshop_text_layers
            else render_text_layers
        )
        if render_text_layers or render_overlays:
            render_group = psd.create_group(name=GROUP_RENDER_TEXT)
            render_group.visible = False
            group_count += 1

        if raster_render_text_layers:
            for idx, entry in enumerate(raster_render_text_layers):
                layer_image = entry.get("image")
                if layer_image is None:
                    continue
                render_layer = psd.create_pixel_layer(
                    image=layer_image.convert("RGBA"),
                    name=str(entry.get("name", f"text_layer_{idx:03d}")).strip() or f"text_layer_{idx:03d}",
                    top=int(entry.get("top", 0)),
                    left=int(entry.get("left", 0)),
                    compression=self._compression,
                    blend_mode=BlendMode.NORMAL,
                    opacity=255,
                )
                render_layer.move_to_group(render_group)
                layer_count += 1
        elif render_overlays and not use_photoshop_text_layers:
            for key, layer_name in (
                ("raw_text", LAYER_TEXT_RAW_OVERLAY),
                ("translated_text", LAYER_TEXT_TRANSLATED_OVERLAY),
                ("rendered_text", LAYER_TEXT_RENDERED_OVERLAY),
            ):
                overlay_image = render_overlays.get(key)
                if overlay_image is None:
                    continue
                render_layer = psd.create_pixel_layer(
                    image=overlay_image.convert("RGBA"),
                    name=layer_name,
                    top=0,
                    left=0,
                    compression=self._compression,
                    blend_mode=BlendMode.NORMAL,
                    opacity=255,
                )
                render_layer.move_to_group(render_group)
                layer_count += 1

        final_ready_image = self._compose_final_ready_image(
            cleaned=cleaned,
            render_text_layers=render_text_layers,
            render_overlays=render_overlays,
        )

        # 6) Top: final layer ready for editing
        ready_group = psd.create_group(name=GROUP_READY)
        ready_group.visible = True
        group_count += 1

        final_layer = psd.create_pixel_layer(
            image=final_ready_image.convert("RGBA"),
            name=LAYER_FINAL_CLEAN,
            top=0,
            left=0,
            compression=self._compression,
            blend_mode=BlendMode.NORMAL,
            opacity=255,
        )
        final_layer.move_to_group(ready_group)
        layer_count += 1

        # UTF-8 is required for group names containing unicode/emoji.
        psd.save(str(output_path), encoding="utf-8")
        file_size = output_path.stat().st_size if output_path.exists() else 0

        self.last_group_count = group_count
        self.last_layer_count = layer_count
        logger.info(
            "PSD exported: %s (groups=%d, layers=%d, size=%d bytes)",
            output_path,
            group_count,
            layer_count,
            file_size,
        )
        return output_path

    def _compose_final_ready_image(
        self,
        cleaned: Image.Image,
        render_text_layers: list[dict[str, object]],
        render_overlays: dict[str, Image.Image],
    ) -> Image.Image:
        """
        Compose the final image (Ready/final_clean) with rendered text.

        Composition prefers individual layers (`render_text_layers`) and uses
        `render_overlays['rendered_text']` only as a compatibility fallback.
        """

        composed = cleaned.convert("RGBA").copy()

        if render_text_layers:
            for entry in render_text_layers:
                kind = str(entry.get("kind", "rendered")).strip().lower()
                if kind != "rendered":
                    continue
                layer_image = entry.get("image")
                if layer_image is None:
                    continue
                composed = self._alpha_paste_with_bounds(
                    base=composed,
                    layer=layer_image.convert("RGBA"),
                    left=int(entry.get("left", 0)),
                    top=int(entry.get("top", 0)),
                )
            return composed

        rendered_overlay = render_overlays.get("rendered_text")
        if rendered_overlay is not None:
            overlay = rendered_overlay.convert("RGBA")
            if overlay.size == composed.size:
                return Image.alpha_composite(composed, overlay)
            return self._alpha_paste_with_bounds(base=composed, layer=overlay, left=0, top=0)

        return composed

    def _alpha_paste_with_bounds(
        self,
        base: Image.Image,
        layer: Image.Image,
        left: int,
        top: int,
    ) -> Image.Image:
        """Apply an RGBA layer over an RGBA base, clipped to the image bounds."""

        if left >= base.width or top >= base.height:
            return base

        x1 = max(0, left)
        y1 = max(0, top)
        x2 = min(base.width, left + layer.width)
        y2 = min(base.height, top + layer.height)
        if x2 <= x1 or y2 <= y1:
            return base

        crop = layer.crop((x1 - left, y1 - top, x2 - left, y2 - top))
        overlay_canvas = Image.new("RGBA", base.size, (0, 0, 0, 0))
        overlay_canvas.paste(crop, (x1, y1), crop)
        return Image.alpha_composite(base, overlay_canvas)

    def _render_ocr_overlay(self, base: Image.Image, detections: list[DetectionResult]) -> Image.Image:
        """
        Render an OCR overlay with bboxes and labels onto an RGBA image.

        Args:
            base: Base image.
            detections: Detections with bbox/text.

        Returns:
            RGBA image containing the overlay drawing.
        """

        overlay = base.convert("RGBA").copy()
        draw = ImageDraw.Draw(overlay, "RGBA")
        font = ImageFont.load_default()

        for detection in detections:
            x1, y1, x2, y2 = [int(v) for v in detection.bbox]
            if detection.type == DetectionType.BUBBLE:
                color = (255, 165, 0, 180)
            else:
                color = (0, 200, 100, 180)

            draw.rectangle((x1, y1, x2, y2), fill=(color[0], color[1], color[2], color[3] // 3))
            for border in range(2):
                draw.rectangle(
                    (x1 - border, y1 - border, x2 + border, y2 + border),
                    outline=color,
                    width=1,
                )

            if detection.text:
                text = detection.text.strip()
                if len(text) > 40:
                    text = f"{text[:40]}..."

                text_x = max(0, x1)
                text_y = max(0, y1 - 14)
                text_bbox = draw.textbbox((text_x, text_y), text, font=font)
                draw.rectangle(text_bbox, fill=(0, 0, 0, 170))
                draw.text((text_x, text_y), text, fill=(255, 255, 0, 230), font=font)

        return overlay

    def _mask_to_rgba(self, mask: Image.Image, color: tuple[int, int, int]) -> Image.Image:
        """
        Convert an L mask into a colored RGBA image with alpha on active pixels.

        Args:
            mask: Grayscale mask (or convertible to L).
            color: Cor RGB aplicada nos pixels ativos.

        Returns:
            RGBA image, transparent outside the masked areas.
        """

        gray_mask = mask.convert("L")
        mask_array = np.array(gray_mask, dtype=np.uint8)
        rgba = np.zeros((gray_mask.height, gray_mask.width, 4), dtype=np.uint8)
        active = mask_array > 127

        rgba[active, 0] = color[0]
        rgba[active, 1] = color[1]
        rgba[active, 2] = color[2]
        rgba[active, 3] = 200

        return Image.fromarray(rgba, mode="RGBA")

    def _render_detection_mask(
        self,
        size: tuple[int, int],
        detections: list[DetectionResult],
        det_type: DetectionType,
        color: tuple[int, int, int, int],
    ) -> Image.Image | None:
        """
        Render a filled mask for a specific detection type.

        Args:
            size: Image size (width, height).
            detections: List of detections.
            det_type: Detection type to draw.
            color: Cor RGBA de preenchimento.

        Returns:
            RGBA image, or `None` when there is no detection of the given type.
        """

        filtered = [det for det in detections if det.type == det_type]
        if not filtered:
            return None

        canvas = Image.new("RGBA", size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas, "RGBA")
        for detection in filtered:
            draw.rectangle(detection.bbox, fill=color)
        return canvas

    def _crop_region(
        self,
        image: Image.Image,
        bbox: tuple[int, int, int, int],
        pad: int = 4,
    ) -> tuple[Image.Image, int, int]:
        """
        Crop a bbox with padding and return its position for placement in the PSD.

        Args:
            image: Base image.
            bbox: Caixa (x1, y1, x2, y2).
            pad: Padding aplicado ao redor do recorte.

        Returns:
            Tupla com (`crop_image`, `left`, `top`).
        """

        x1 = max(0, int(bbox[0]) - int(pad))
        y1 = max(0, int(bbox[1]) - int(pad))
        x2 = min(image.width, int(bbox[2]) + int(pad))
        y2 = min(image.height, int(bbox[3]) + int(pad))
        crop = image.crop((x1, y1, x2, y2)).convert("RGBA")
        return crop, x1, y1
