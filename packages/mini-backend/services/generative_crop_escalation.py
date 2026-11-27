from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from io import BytesIO
from typing import Protocol

import cv2
import numpy as np
from PIL import Image

from core.models_store import model_is_installed
from models.errors import GpuOutOfMemoryError
from models.image_edit.factory import get_local_image_edit_engine
from models.image_edit.registry import extract_local_image_edit_model_id
from models.image_edit.storage import local_image_edit_runtime_ready
from utils.image_codec import MaskImage, RGBImage

logger = logging.getLogger(__name__)

type BBox = tuple[int, int, int, int]


class _CropEditEngine(Protocol):
    async def edit_image_async(
        self,
        *,
        image: Image.Image,
        mode: str,
        regions: list[dict[str, object]],
        additional_instructions: str = "",
    ) -> bytes: ...


type EngineLoader = Callable[[str], _CropEditEngine]


@dataclass(frozen=True, slots=True)
class EscalationResult:
    image_rgb: RGBImage
    escalated_clusters: int
    skipped_reason: str | None = None


def _boxes_within_gap(a: BBox, b: BBox, gap: int) -> bool:
    return (
        a[0] <= b[2] + gap
        and a[2] + gap >= b[0]
        and a[1] <= b[3] + gap
        and a[3] + gap >= b[1]
    )


def extract_escalation_clusters(
    mask: MaskImage,
    *,
    merge_gap: int = 32,
    min_area: int = 196,
    max_clusters: int = 6,
) -> list[BBox]:
    """Cluster nearby masked components into bounded crop boxes for selective escalation."""
    binary = (mask >= 128).astype(np.uint8) * 255
    if not np.any(binary):
        return []

    num_labels, _, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    raw_boxes: list[BBox] = []
    for idx in range(1, num_labels):
        area = int(stats[idx, cv2.CC_STAT_AREA])
        if area < min_area:
            continue
        x = int(stats[idx, cv2.CC_STAT_LEFT])
        y = int(stats[idx, cv2.CC_STAT_TOP])
        w = int(stats[idx, cv2.CC_STAT_WIDTH])
        h = int(stats[idx, cv2.CC_STAT_HEIGHT])
        raw_boxes.append((x, y, x + w, y + h))

    if not raw_boxes:
        return []

    merged: list[BBox] = []
    for box in raw_boxes:
        cur = box
        changed = True
        while changed:
            changed = False
            next_merged: list[BBox] = []
            for existing in merged:
                if _boxes_within_gap(cur, existing, merge_gap):
                    cur = (
                        min(cur[0], existing[0]),
                        min(cur[1], existing[1]),
                        max(cur[2], existing[2]),
                        max(cur[3], existing[3]),
                    )
                    changed = True
                else:
                    next_merged.append(existing)
            merged = next_merged
        merged.append(cur)

    merged.sort(key=lambda b: (b[2] - b[0]) * (b[3] - b[1]), reverse=True)
    return merged[:max_clusters]


def score_cluster_art_complexity(
    orig_rgb: RGBImage,
    mask: MaskImage,
    bbox: BBox,
    *,
    ring_px: int = 16,
) -> float:
    """Estimate background illustration complexity `[0, 1]` around a masked cluster."""
    img_h, img_w = orig_rgb.shape[:2]
    x1 = max(0, min(img_w, int(bbox[0])))
    y1 = max(0, min(img_h, int(bbox[1])))
    x2 = max(x1, min(img_w, int(bbox[2])))
    y2 = max(y1, min(img_h, int(bbox[3])))
    if x2 - x1 < 4 or y2 - y1 < 4:
        return 0.0

    wx1 = max(0, x1 - ring_px)
    wy1 = max(0, y1 - ring_px)
    wx2 = min(img_w, x2 + ring_px)
    wy2 = min(img_h, y2 + ring_px)

    rgb_crop = orig_rgb[wy1:wy2, wx1:wx2]
    binary_crop = (mask[wy1:wy2, wx1:wx2] >= 128).astype(np.uint8) * 255
    if not np.any(binary_crop):
        return 0.0

    ksize = 2 * max(3, ring_px) + 1
    ring_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ksize, ksize))
    ring = (cv2.dilate(binary_crop, ring_kernel, iterations=1) > 0) & (binary_crop == 0)
    ring_count = int(np.count_nonzero(ring))
    if ring_count < 16:
        return 0.0

    gray_crop = cv2.cvtColor(rgb_crop, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray_crop, (3, 3), 0), 50, 150)
    edge_density = float(np.count_nonzero(edges[ring] > 0)) / float(ring_count)
    edge_score = min(1.0, edge_density / 0.14)

    lab = cv2.cvtColor(rgb_crop, cv2.COLOR_RGB2LAB).astype(np.float32)
    lab_std = np.std(lab[ring], axis=0)
    color_std = float(lab_std[0] * 0.45 + lab_std[1] * 0.90 + lab_std[2] * 0.90)
    color_score = min(1.0, color_std / 36.0)

    sobel_x = cv2.Sobel(gray_crop.astype(np.float32), cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray_crop.astype(np.float32), cv2.CV_32F, 0, 1, ksize=3)
    tex_mag = float(np.mean(np.hypot(sobel_x, sobel_y)[ring]))
    tex_score = min(1.0, tex_mag / 55.0)

    dist = cv2.distanceTransform(binary_crop, cv2.DIST_L2, 5)
    hole_factor = min(1.0, float(dist.max()) / 28.0)

    raw_score = (0.35 * edge_score + 0.35 * color_score + 0.30 * tex_score) * (
        0.45 + 0.55 * hole_factor
    )
    return float(max(0.0, min(1.0, raw_score)))


def _blend_crop_inward(
    base_crop: RGBImage,
    edited_crop: RGBImage,
    binary_mask_crop: MaskImage,
    *,
    feather_px: int = 4,
) -> RGBImage:
    support = binary_mask_crop > 0
    if not np.any(support):
        return base_crop
    dist = cv2.distanceTransform(support.astype(np.uint8), cv2.DIST_L2, 3)
    ramp = float(max(1, feather_px))
    alpha = np.clip(dist / ramp, 0.0, 1.0) * support
    alpha_3d = alpha.astype(np.float32)[:, :, np.newaxis]
    blended = (
        edited_crop.astype(np.float32) * alpha_3d
        + base_crop.astype(np.float32) * (1.0 - alpha_3d)
    )
    np.rint(blended, out=blended)
    np.clip(blended, 0.0, 255.0, out=blended)
    return blended.astype(np.uint8)


async def escalate_complex_clusters(
    *,
    orig_rgb: RGBImage,
    base_inpainted_rgb: RGBImage,
    mask: MaskImage,
    model_key: str | None,
    complexity_threshold: float = 0.65,
    engine_loader: EngineLoader | None = None,
) -> EscalationResult:
    """Selectively re-render complex illustration holes with a generative crop pass.

    Leaves smooth bubbles and unmasked background artwork 100% untouched.
    """
    requested = (model_key or "").strip()
    if not requested:
        return EscalationResult(
            image_rgb=base_inpainted_rgb,
            escalated_clusters=0,
            skipped_reason="disabled",
        )

    if engine_loader is None:
        model_id = extract_local_image_edit_model_id(requested)
        if (
            model_id is None
            or not model_is_installed(model_id)
            or not local_image_edit_runtime_ready(model_id)
        ):
            logger.warning(
                "inpainting.escalation_unavailable",
                extra={"escalation_model_key": requested},
            )
            return EscalationResult(
                image_rgb=base_inpainted_rgb,
                escalated_clusters=0,
                skipped_reason="unavailable",
            )
        engine: _CropEditEngine = get_local_image_edit_engine(requested)
    else:
        engine = engine_loader(requested)

    clusters = extract_escalation_clusters(mask)
    scored: list[tuple[float, BBox]] = [
        (score_cluster_art_complexity(orig_rgb, mask, box), box) for box in clusters
    ]
    candidates = [box for score, box in scored if score >= complexity_threshold]
    if not candidates:
        return EscalationResult(
            image_rgb=base_inpainted_rgb,
            escalated_clusters=0,
            skipped_reason="below_threshold",
        )

    img_h, img_w = orig_rgb.shape[:2]
    result = base_inpainted_rgb.copy()
    escalated_count = 0

    for x1, y1, x2, y2 in candidates:
        bw, bh = x2 - x1, y2 - y1
        pad = max(64, int(round(max(bw, bh) * 0.65)))
        cx1 = max(0, x1 - pad)
        cy1 = max(0, y1 - pad)
        cx2 = min(img_w, x2 + pad)
        cy2 = min(img_h, y2 + pad)
        crop_w, crop_h = cx2 - cx1, cy2 - cy1
        if crop_w < 16 or crop_h < 16:
            continue

        orig_crop = orig_rgb[cy1:cy2, cx1:cx2]
        cluster_mask_crop = np.zeros((crop_h, crop_w), dtype=np.uint8)
        rx1, ry1, rx2, ry2 = x1 - cx1, y1 - cy1, x2 - cx1, y2 - cy1
        cluster_mask_crop[ry1:ry2, rx1:rx2] = np.where(
            mask[y1:y2, x1:x2] >= 128, np.uint8(255), np.uint8(0)
        )
        if not np.any(cluster_mask_crop):
            continue

        try:
            edited_bytes = await engine.edit_image_async(
                image=Image.fromarray(orig_crop),
                mode="clean",
                regions=[{"bbox": [rx1, ry1, rx2, ry2]}],
                additional_instructions=(
                    "Clean only text inside the bbox; preserve surrounding artwork "
                    "and speech-bubble outlines strictly."
                ),
            )
            with Image.open(BytesIO(edited_bytes)) as edited_pil:
                edited_rgb_pil = edited_pil.convert("RGB")
                if edited_rgb_pil.size != (crop_w, crop_h):
                    edited_rgb_pil = edited_rgb_pil.resize(
                        (crop_w, crop_h), Image.Resampling.LANCZOS
                    )
                edited_crop = np.asarray(edited_rgb_pil, dtype=np.uint8)
        except GpuOutOfMemoryError:
            logger.warning(
                "inpainting.escalation_gpu_oom",
                extra={"escalation_model_key": requested, "cluster": (x1, y1, x2, y2)},
            )
            continue
        except Exception:  # noqa: BLE001
            logger.warning(
                "inpainting.escalation_cluster_failed",
                extra={"escalation_model_key": requested, "cluster": (x1, y1, x2, y2)},
                exc_info=True,
            )
            continue

        blended_crop = _blend_crop_inward(
            result[cy1:cy2, cx1:cx2],
            edited_crop,
            cluster_mask_crop,
            feather_px=4,
        )
        result[cy1:cy2, cx1:cx2] = blended_crop
        escalated_count += 1

    return EscalationResult(
        image_rgb=result,
        escalated_clusters=escalated_count,
        skipped_reason=None if escalated_count > 0 else "failed",
    )
