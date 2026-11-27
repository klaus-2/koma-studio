from __future__ import annotations

from collections.abc import Sequence

import cv2
import numpy as np

type BBox = tuple[int, int, int, int]
type MaskImage = np.ndarray


def _clip_box(box: BBox, width: int, height: int) -> BBox | None:
    x1 = max(0, min(int(box[0]), width))
    y1 = max(0, min(int(box[1]), height))
    x2 = max(0, min(int(box[2]), width))
    y2 = max(0, min(int(box[3]), height))
    if x2 <= x1 or y2 <= y1:
        return None
    return (x1, y1, x2, y2)


def _fill_mask_holes(mask: MaskImage) -> MaskImage:
    binary = (mask > 0).astype(np.uint8) * 255
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return binary
    filled = np.zeros_like(binary)
    largest = max(contours, key=cv2.contourArea)
    cv2.drawContours(filled, [largest], -1, 255, thickness=cv2.FILLED)
    return filled


def _estimate_interior_lab(
    lab: np.ndarray,
    grad_mag: np.ndarray,
    seed_mask: np.ndarray,
) -> tuple[np.ndarray, float]:
    """Estimate background LAB color inside seed region, ignoring dark/colored glyph strokes."""
    quiet_threshold = float(np.percentile(grad_mag, 60)) if grad_mag.size else 0.0
    quiet_pixels = lab[(seed_mask > 0) & (grad_mag <= quiet_threshold + 1e-6)]
    if quiet_pixels.shape[0] < 12:
        quiet_pixels = lab[seed_mask > 0]
    if quiet_pixels.shape[0] == 0:
        quiet_pixels = lab.reshape(-1, 3)

    l_vals = quiet_pixels[:, 0]
    if float(np.median(l_vals)) >= 110.0:
        bright_cut = float(np.percentile(l_vals, 55))
        pool = quiet_pixels[l_vals >= bright_cut]
    else:
        dark_cut = float(np.percentile(l_vals, 45))
        pool = quiet_pixels[l_vals <= dark_cut]
    if pool.shape[0] < 8:
        pool = quiet_pixels

    median_lab = np.median(pool, axis=0).astype(np.float32)
    mad = float(np.median(np.linalg.norm(pool - median_lab, axis=1)))
    return median_lab, mad


def _compute_lab_gradient(lab: np.ndarray, gray: np.ndarray) -> np.ndarray:
    gx = cv2.Sobel(lab, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(lab, cv2.CV_32F, 0, 1, ksize=3)
    lab_grad = np.sqrt(np.sum(gx * gx + gy * gy, axis=2))
    gray_gx = cv2.Sobel(gray.astype(np.float32), cv2.CV_32F, 1, 0, ksize=3)
    gray_gy = cv2.Sobel(gray.astype(np.float32), cv2.CV_32F, 0, 1, ksize=3)
    gray_grad = np.hypot(gray_gx, gray_gy)
    return np.maximum(lab_grad * 0.35, gray_grad * 0.25).astype(np.float32)


def _select_seed_component(
    candidate: MaskImage,
    seed_mask: np.ndarray,
    *,
    erode_bridges: bool = True,
) -> MaskImage:
    work = candidate
    if erode_bridges:
        kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
        eroded = cv2.erode(candidate, kernel, iterations=1)
        if np.any((eroded > 0) & (seed_mask > 0)):
            work = eroded

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(work, connectivity=4)
    if num_labels <= 1:
        return np.zeros_like(candidate)

    best_label = 0
    best_score = -1.0
    seed_bool = seed_mask > 0
    for label_id in range(1, num_labels):
        comp = labels == label_id
        overlap = int(np.count_nonzero(comp & seed_bool))
        area = int(stats[label_id, cv2.CC_STAT_AREA])
        if overlap == 0 or area < 16:
            continue
        score = float(overlap) + 0.05 * float(area)
        if score > best_score:
            best_score = score
            best_label = label_id

    if best_label == 0:
        return np.zeros_like(candidate)

    selected = (labels == best_label).astype(np.uint8) * 255
    if erode_bridges and work is not candidate:
        kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
        dilated = cv2.dilate(selected, kernel, iterations=1)
        selected = cv2.bitwise_and(dilated, candidate)
    return _fill_mask_holes(selected)


def _edge_closed_fallback(
    gray: np.ndarray,
    seed_mask: np.ndarray,
) -> MaskImage | None:
    """Fallback contour extraction for cross-hatched or gradient-filled speech bubbles."""
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(blurred, 50, 140)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=1)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    h, w = gray.shape
    crop_area = float(max(1, h * w))
    seed_bool = seed_mask > 0
    best_mask: MaskImage | None = None
    best_overlap = 0

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 0.12 * crop_area or area > 0.98 * crop_area:
            continue
        candidate = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(candidate, [cnt], -1, 255, thickness=cv2.FILLED)
        overlap = int(np.count_nonzero((candidate > 0) & seed_bool))
        if overlap > best_overlap:
            best_overlap = overlap
            best_mask = candidate

    return best_mask


def extract_bubble_mask_in_crop(
    crop_rgb: np.ndarray,
    *,
    seed_boxes: Sequence[BBox] = (),
    allow_full_crop: bool = True,
) -> MaskImage | None:
    """Extract a clean filled binary mask (0/255) for a bubble inside ``crop_rgb``.

    Uses CIELAB interior seed estimation, bridge-breaking morphological flood selection,
    and external contour hole-filling so interior text ink never splits the bubble.
    """
    if crop_rgb.ndim < 2:
        return None
    h, w = crop_rgb.shape[:2]
    if h < 8 or w < 8:
        return None

    rgb = crop_rgb[..., :3] if crop_rgb.ndim == 3 else cv2.cvtColor(crop_rgb, cv2.COLOR_GRAY2RGB)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    blurred_rgb = cv2.GaussianBlur(rgb, (3, 3), 0)
    lab = cv2.cvtColor(blurred_rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    if float(gray.std()) < 2.5 and float(lab.std(axis=(0, 1)).max()) < 2.5:
        return None
    grad_mag = _compute_lab_gradient(lab, gray)

    seed_mask = np.zeros((h, w), dtype=np.uint8)
    for raw_box in seed_boxes:
        clipped = _clip_box(raw_box, w, h)
        if clipped is not None:
            sx1, sy1, sx2, sy2 = clipped
            seed_mask[sy1:sy2, sx1:sx2] = 255

    if not np.any(seed_mask):
        sx1, sx2 = max(0, int(w * 0.2)), min(w, int(w * 0.8))
        sy1, sy2 = max(0, int(h * 0.2)), min(h, int(h * 0.8))
        if sx2 > sx1 and sy2 > sy1:
            seed_mask[sy1:sy2, sx1:sx2] = 255
        else:
            seed_mask[:, :] = 255

    median_lab, mad = _estimate_interior_lab(lab, grad_mag, seed_mask)
    delta_e = np.linalg.norm(lab - median_lab, axis=2)

    edges = cv2.Canny(cv2.GaussianBlur(gray, (3, 3), 0), 55, 150)
    strong_edges = cv2.bitwise_and(edges, cv2.bitwise_not(seed_mask))

    best_mask: MaskImage | None = None
    best_area = 0
    crop_area = float(h * w)
    base_thresh = max(14.0, min(32.0, 2.2 * mad + 12.0))

    for thresh in (base_thresh, min(38.0, base_thresh + 8.0)):
        candidate = ((delta_e <= thresh) & (strong_edges == 0)).astype(np.uint8) * 255
        selected = _select_seed_component(candidate, seed_mask, erode_bridges=True)
        area = int(np.count_nonzero(selected))
        if area < 0.08 * crop_area:
            continue
        if not allow_full_crop and _touches_too_many_borders(selected, area, w, h):
            continue
        best_mask = selected
        best_area = area
        break

    if best_mask is None or best_area < 0.14 * crop_area:
        fallback = _edge_closed_fallback(gray, seed_mask)
        if fallback is not None:
            fb_area = int(np.count_nonzero(fallback))
            if allow_full_crop or not _touches_too_many_borders(fallback, fb_area, w, h):
                return fallback

    return best_mask


def _touches_too_many_borders(mask: MaskImage, area: int, width: int, height: int) -> bool:
    if width <= 0 or height <= 0:
        return True
    area_ratio = float(area) / float(width * height)
    top = bool(np.any(mask[0, :] > 0))
    bottom = bool(np.any(mask[-1, :] > 0))
    left = bool(np.any(mask[:, 0] > 0))
    right = bool(np.any(mask[:, -1] > 0))
    border_count = int(top) + int(bottom) + int(left) + int(right)
    if border_count >= 3 and area_ratio > 0.72:
        return True
    return area_ratio > 0.88


def _has_enclosed_boundary(
    crop_rgb: np.ndarray,
    mask: MaskImage,
    min_ring_delta_e: float = 13.0,
    min_edge_support: float = 0.40,
) -> bool:
    """Verify the extracted region actually sits inside a contrasting wall or outline."""
    lab = cv2.cvtColor(crop_rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    gray = cv2.cvtColor(crop_rgb, cv2.COLOR_RGB2GRAY)

    k5 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    inner_core = cv2.erode(mask, k5, iterations=1)
    inner_pixels = lab[(inner_core > 0) if np.any(inner_core) else (mask > 0)]
    outer_ring = cv2.bitwise_and(cv2.dilate(mask, k5, iterations=2), cv2.bitwise_not(mask))
    outer_pixels = lab[outer_ring > 0]
    if inner_pixels.shape[0] < 16 or outer_pixels.shape[0] < 16:
        return False

    inner_med = np.median(inner_pixels, axis=0)
    outer_delta = float(np.median(np.linalg.norm(outer_pixels - inner_med, axis=1)))
    if outer_delta >= min_ring_delta_e:
        return True

    perimeter_band = cv2.bitwise_xor(cv2.dilate(mask, k3, iterations=1), cv2.erode(mask, k3, iterations=1))
    band_count = int(np.count_nonzero(perimeter_band))
    if band_count < 16:
        return False
    edges = cv2.Canny(cv2.GaussianBlur(gray, (3, 3), 0), 45, 130)
    edges_dilated = cv2.dilate(edges, k3, iterations=1)
    edge_overlap = int(np.count_nonzero((perimeter_band > 0) & (edges_dilated > 0)))
    return (float(edge_overlap) / float(band_count)) >= min_edge_support


def find_enclosed_bubble_around_text(
    rgb_image: np.ndarray,
    text_bbox: BBox,
    *,
    pad_ratio: float = 0.85,
    min_pad: int = 48,
    max_pad: int = 180,
) -> tuple[BBox, MaskImage] | None:
    """Find an enclosed speech-bubble bbox + full-crop mask around ``text_bbox``.

    Returns ``None`` for free/floating text over artwork or open gutters so free text
    is not hallucinated as being inside a bubble.
    """
    if rgb_image.ndim < 2:
        return None
    img_h, img_w = rgb_image.shape[:2]
    clipped_text = _clip_box(text_bbox, img_w, img_h)
    if clipped_text is None:
        return None

    tx1, ty1, tx2, ty2 = clipped_text
    tw = tx2 - tx1
    th = ty2 - ty1
    pad_x = max(min_pad, min(max_pad, int(round(tw * pad_ratio))))
    pad_y = max(min_pad, min(max_pad, int(round(th * pad_ratio))))

    wx1 = max(0, tx1 - pad_x)
    wy1 = max(0, ty1 - pad_y)
    wx2 = min(img_w, tx2 + pad_x)
    wy2 = min(img_h, ty2 + pad_y)
    if wx2 - wx1 < 16 or wy2 - wy1 < 16:
        return None

    crop = rgb_image[wy1:wy2, wx1:wx2]
    rel_seed = (tx1 - wx1, ty1 - wy1, tx2 - wx1, ty2 - wy1)
    mask = extract_bubble_mask_in_crop(crop, seed_boxes=(rel_seed,), allow_full_crop=False)
    if mask is None:
        return None

    ys, xs = np.nonzero(mask > 0)
    if ys.size < 64:
        return None

    text_area = max(1, tw * th)
    rx1, ry1, rx2, ry2 = rel_seed
    inside_text = int(np.count_nonzero(mask[ry1:ry2, rx1:rx2] > 0))
    if float(inside_text) / float(text_area) < 0.45:
        return None

    if not _has_enclosed_boundary(crop, mask):
        return None

    bx1 = int(xs.min())
    by1 = int(ys.min())
    bx2 = int(xs.max()) + 1
    by2 = int(ys.max()) + 1
    page_bbox = (wx1 + bx1, wy1 + by1, wx1 + bx2, wy1 + by2)
    cropped_mask = mask[by1:by2, bx1:bx2].copy()
    return page_bbox, cropped_mask
