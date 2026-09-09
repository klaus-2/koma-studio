from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
from pathlib import Path

from schemas.export import PipelineResult


logger = logging.getLogger(__name__)


def export_metadata(result: PipelineResult, psd_path: Path, output_path: Path) -> Path:
    """
    Exporta metadados da geracao PSD em JSON UTF-8.

    Args:
        result: Complete pipeline result.
        psd_path: Path of the generated PSD.
        output_path: Path of the output JSON.

    Returns:
        Path of the created JSON file.
    """

    output_path.parent.mkdir(parents=True, exist_ok=True)

    detections_payload = []
    texts_only: list[str] = []
    for index, detection in enumerate(result.detections):
        if detection.text:
            texts_only.append(detection.text)
        detections_payload.append(
            {
                "index": index,
                "type": detection.type.value,
                "bbox": [int(v) for v in detection.bbox],
                "confidence": float(detection.confidence),
                "language": detection.language,
                "text": detection.text,
            }
        )

    psd_groups = ["✅ Ready", "📝 OCR", "🧹 Cleaning", "🔍 Detection", "🖼️ Original"]
    if result.render_text_layers or result.render_overlays:
        psd_groups.insert(1, "✍️ Rendered Text")

    data = {
        "koma_lab_version": "1.0.0",
        "image_size": [int(result.original.width), int(result.original.height)],
        "source_dpi": int(result.source_dpi),
        "color_mode": "RGB",
        "models_used": result.model_info,
        "total_detections": len(result.detections),
        "detections": detections_payload,
        "texts_only": texts_only,
        "psd_filename": psd_path.name,
        "psd_groups": psd_groups,
        "export_timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }

    with output_path.open("w", encoding="utf-8") as metadata_file:
        json.dump(data, metadata_file, ensure_ascii=False, indent=2)

    logger.info(
        "Metadata exported: %s (detections=%d, texts=%d)",
        output_path,
        len(result.detections),
        len(texts_only),
    )
    return output_path
