from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from models.detection.bubble.contour_extractor import extract_bubble_mask_in_crop


@dataclass(frozen=True, slots=True)
class BubbleShapeClassification:
    shape: str
    confidence: float
    is_dark: bool
    has_tail: bool
    solidity: float
    circularity: float
    source: str = "geometric_spectral"


def _strip_speech_tail(mask: np.ndarray) -> tuple[np.ndarray, bool]:
    """Remove thin protruding speech tails via distance-transform opening."""
    binary = (mask > 0).astype(np.uint8) * 255
    total_area = int(np.count_nonzero(binary))
    if total_area < 64:
        return binary, False

    dist = cv2.distanceTransform(binary, cv2.DIST_L2, 5)
    r_max = float(dist.max())
    if r_max < 5.0:
        return binary, False

    tail_r = max(2.0, min(14.0, 0.16 * r_max))
    core = (dist >= tail_r).astype(np.uint8) * 255
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(core, connectivity=8)
    if num_labels <= 1:
        return binary, False

    best_label = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    largest_core = (labels == best_label).astype(np.uint8) * 255
    dilate_radius = max(1, int(np.ceil(tail_r)))
    ksize = 2 * dilate_radius + 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ksize, ksize))
    reconstructed = cv2.bitwise_and(cv2.dilate(largest_core, kernel, iterations=1), binary)

    body_area = int(np.count_nonzero(reconstructed))
    if body_area < int(0.45 * total_area):
        return binary, False

    removed = cv2.bitwise_and(binary, cv2.bitwise_not(reconstructed))
    removed_area = total_area - body_area
    if removed_area < max(16, int(0.015 * total_area)):
        return binary, False

    r_num, _, r_stats, _ = cv2.connectedComponentsWithStats(removed, connectivity=8)
    localized_appendages = 0
    for idx in range(1, r_num):
        comp_area = int(r_stats[idx, cv2.CC_STAT_AREA])
        if comp_area >= max(12, int(0.008 * total_area)):
            localized_appendages += 1

    has_tail = 1 <= localized_appendages <= 2 and removed_area <= int(0.30 * total_area)
    return (reconstructed if has_tail else binary), has_tail


def _resample_contour_radial(contour: np.ndarray, num_samples: int = 128) -> np.ndarray | None:
    pts = contour.reshape(-1, 2).astype(np.float64)
    if pts.shape[0] < 8:
        return None
    closed = np.vstack([pts, pts[0:1]])
    diffs = np.diff(closed, axis=0)
    seg_lens = np.hypot(diffs[:, 0], diffs[:, 1])
    total_len = float(seg_lens.sum())
    if total_len < 1e-3:
        return None

    cum = np.concatenate([[0.0], np.cumsum(seg_lens)])
    targets = np.linspace(0.0, total_len, num_samples, endpoint=False)
    xs = np.interp(targets, cum, closed[:, 0])
    ys = np.interp(targets, cum, closed[:, 1])

    cx = float(xs.mean())
    cy = float(ys.mean())
    radii = np.hypot(xs - cx, ys - cy)
    mean_r = float(radii.mean())
    if mean_r < 1e-3:
        return None
    return radii / mean_r


def _spectral_features(radii_norm: np.ndarray) -> tuple[float, float, float, float]:
    """Return (low_band, mid_scallop_band, high_freq_band, high_to_mid_ratio)."""
    centered = radii_norm - 1.0
    n = centered.size
    mags = np.abs(np.fft.rfft(centered)) / float(max(1, n))
    low = float(mags[2:5].sum()) if mags.size > 4 else 0.0
    mid = float(mags[5:19].sum()) if mags.size > 18 else float(mags[5:].sum())
    high = float(mags[19:49].sum()) if mags.size > 19 else 0.0
    hf_ratio = high / max(mid, 1e-6)
    return low, mid, high, hf_ratio


def _defect_spike_and_lobe_stats(
    contour: np.ndarray, mean_radius: float
) -> tuple[float, float, int, int]:
    """Inspect convexity defects: return (max_rel_depth, mean_top_k_depth, sharp_vertex_count, deep_defect_count)."""
    if contour.shape[0] < 6 or mean_radius <= 1e-3:
        return 0.0, 0.0, 0, 0
    hull_indices = cv2.convexHull(contour, returnPoints=False)
    depths: list[float] = []
    if hull_indices is not None and len(hull_indices) >= 3:
        try:
            defects = cv2.convexityDefects(contour, hull_indices)
        except cv2.error:
            defects = None
        if defects is not None:
            for item in defects.reshape(-1, 4):
                depth_px = float(item[3]) / 256.0
                rel = depth_px / mean_radius
                if rel >= 0.015:
                    depths.append(rel)

    depths.sort(reverse=True)
    max_depth = depths[0] if depths else 0.0
    top_mean = float(np.mean(depths[:8])) if depths else 0.0
    deep_defects = sum(1 for d in depths if d >= 0.022)

    peri = float(cv2.arcLength(contour, True))
    approx = cv2.approxPolyDP(contour, max(1.5, 0.012 * peri), True).reshape(-1, 2).astype(np.float64)
    sharp_outward = 0
    k = approx.shape[0]
    if k >= 4:
        pts_mean = approx.mean(axis=0)
        for idx in range(k):
            prev_pt = approx[(idx - 1) % k]
            curr_pt = approx[idx]
            next_pt = approx[(idx + 1) % k]
            v1 = prev_pt - curr_pt
            v2 = next_pt - curr_pt
            n1 = float(np.linalg.norm(v1))
            n2 = float(np.linalg.norm(v2))
            if n1 < 1e-3 or n2 < 1e-3:
                continue
            cos_theta = float(np.clip(np.dot(v1, v2) / (n1 * n2), -1.0, 1.0))
            angle_deg = float(np.degrees(np.arccos(cos_theta)))
            midpoint = 0.5 * (prev_pt + next_pt)
            is_outward = np.linalg.norm(curr_pt - pts_mean) > np.linalg.norm(midpoint - pts_mean)
            if is_outward and angle_deg < 82.0:
                sharp_outward += 1

    return max_depth, top_mean, sharp_outward, deep_defects


def _bubble_bg_lab(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray | None:
    interior = mask > 0
    if not np.any(interior):
        return None
    src = rgb[..., :3]
    gray = cv2.cvtColor(src, cv2.COLOR_RGB2GRAY).astype(np.float32)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    grad = np.hypot(gx, gy)
    lab = cv2.cvtColor(src, cv2.COLOR_RGB2LAB).astype(np.float32)

    quiet_cut = float(np.percentile(grad[interior], 45))
    quiet = interior & (grad <= quiet_cut + 1e-6)
    pixels = lab[quiet] if np.count_nonzero(quiet) >= 16 else lab[interior]
    return np.median(pixels, axis=0).astype(np.float32)


def _has_thought_dots(
    crop_rgb: np.ndarray | None,
    body_mask: np.ndarray,
    *,
    context_rgb: np.ndarray | None = None,
    context_offset: tuple[int, int] = (0, 0),
    sat_med: float = 0.0,
) -> bool:
    """Detect detached small trailing circles around the main bubble contour."""
    if sat_med >= 50.0:
        return False
    work_rgb = context_rgb if context_rgb is not None and context_rgb.size > 0 else crop_rgb
    if work_rgb is None or work_rgb.size == 0:
        return False

    bh, bw = body_mask.shape
    main_area = int(np.count_nonzero(body_mask))
    if bh < 16 or bw < 16 or main_area < 64:
        return False

    ch, cw = work_rgb.shape[:2]
    placed_mask = np.zeros((ch, cw), dtype=np.uint8)
    ox, oy = int(context_offset[0]), int(context_offset[1])
    x1 = max(0, ox)
    y1 = max(0, oy)
    x2 = min(cw, ox + bw)
    y2 = min(ch, oy + bh)
    if x2 <= x1 or y2 <= y1:
        return False
    placed_mask[y1:y2, x1:x2] = body_mask[(y1 - oy) : (y2 - oy), (x1 - ox) : (x2 - ox)]

    lab = cv2.cvtColor(work_rgb[..., :3], cv2.COLOR_RGB2LAB).astype(np.float32)
    hsv = cv2.cvtColor(work_rgb[..., :3], cv2.COLOR_RGB2HSV).astype(np.float32)
    bubble_lab = _bubble_bg_lab(
        crop_rgb if crop_rgb is not None else work_rgb,
        body_mask if crop_rgb is not None else placed_mask,
    )

    k5 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    reach_px = max(58, min(90, int(round(0.55 * min(bw, bh)))))
    k_reach = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * reach_px + 1, 2 * reach_px + 1))
    near_exterior = (cv2.dilate(placed_mask, k_reach, iterations=1) > 0) & (
        cv2.dilate(placed_mask, k5, iterations=1) == 0
    )
    if int(np.count_nonzero(near_exterior)) < 32:
        return False

    ys_m, xs_m = np.nonzero(placed_mask > 0)
    mb_cx = float(xs_m.mean())
    mb_cy = float(ys_m.mean())

    ext_med = np.median(lab[near_exterior], axis=0)
    delta_e = np.linalg.norm(lab - ext_med, axis=2)
    binary_u8 = ((delta_e >= 24.0) & near_exterior).astype(np.uint8) * 255
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary_u8, connectivity=8)

    dot_angles: list[float] = []
    min_dot = max(12, int(0.0012 * main_area))
    max_dot = max(40, int(0.06 * main_area))
    for idx in range(1, num_labels):
        area = int(stats[idx, cv2.CC_STAT_AREA])
        cw_dot = int(stats[idx, cv2.CC_STAT_WIDTH])
        ch_dot = int(stats[idx, cv2.CC_STAT_HEIGHT])
        if min_dot <= area <= max_dot and min(cw_dot, ch_dot) >= 4:
            aspect = float(max(cw_dot, ch_dot)) / float(max(1, min(cw_dot, ch_dot)))
            fill_ratio = float(area) / float(max(1, cw_dot * ch_dot))
            if aspect <= 1.65 and fill_ratio >= 0.55:
                comp = labels == idx
                if float(np.median(hsv[comp, 1])) >= 55.0:
                    continue
                if bubble_lab is not None:
                    comp_lab = np.median(lab[comp], axis=0)
                    if float(np.linalg.norm(comp_lab - bubble_lab)) > 42.0:
                        continue
                dcx, dcy = float(centroids[idx][0]), float(centroids[idx][1])
                dot_angles.append(float(np.arctan2(dcy - mb_cy, dcx - mb_cx)))
    if 2 <= len(dot_angles) <= 5:
        for i in range(len(dot_angles)):
            for j in range(i + 1, len(dot_angles)):
                diff = abs(dot_angles[i] - dot_angles[j])
                diff = min(diff, 2.0 * np.pi - diff)
                if diff <= np.radians(55.0):
                    return True

    gray = cv2.cvtColor(work_rgb[..., :3], cv2.COLOR_RGB2GRAY)
    dark_strokes = ((gray < 110) & near_exterior).astype(np.uint8) * 255
    contours, hierarchy = cv2.findContours(dark_strokes, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if contours and hierarchy is not None:
        ring_angles: list[float] = []
        for idx, cnt in enumerate(contours):
            if int(hierarchy[0][idx][3]) >= 0:
                continue
            rx, ry, rw_dot, rh_dot = cv2.boundingRect(cnt)
            rect_area = rw_dot * rh_dot
            if not (min_dot <= rect_area <= max_dot and min(rw_dot, rh_dot) >= 5):
                continue
            if float(max(rw_dot, rh_dot)) / float(max(1, min(rw_dot, rh_dot))) > 1.65:
                continue
            hole_area = float(cv2.contourArea(cnt))
            if hole_area / float(max(1, rect_area)) >= 0.52 and hole_area >= min_dot:
                ring_angles.append(
                    float(np.arctan2((ry + 0.5 * rh_dot) - mb_cy, (rx + 0.5 * rw_dot) - mb_cx))
                )
        if 2 <= len(ring_angles) <= 5:
            for i in range(len(ring_angles)):
                for j in range(i + 1, len(ring_angles)):
                    diff = abs(ring_angles[i] - ring_angles[j])
                    diff = min(diff, 2.0 * np.pi - diff)
                    if diff <= np.radians(55.0):
                        return True

    return False


def _measure_dashed_outline(crop_rgb: np.ndarray | None, body_mask: np.ndarray) -> bool:
    """Detect whisper bubbles rendered with dashed or dotted outlines.

    Rejects solid-outlined bubbles and solid color fills over contrasting backgrounds
    by checking whether apparent edge gaps actually have continuous inner==outer background.
    """
    if crop_rgb is None or crop_rgb.size == 0:
        return False
    h, w = body_mask.shape
    if h < 20 or w < 20 or int(np.count_nonzero(body_mask)) < 100:
        return False

    contours, _ = cv2.findContours(body_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return False
    cnt = max(contours, key=cv2.contourArea)
    pts = cnt.reshape(-1, 2)
    if pts.shape[0] < 48:
        return False

    rgb = crop_rgb[..., :3]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gray_min3 = cv2.erode(gray, np.ones((3, 3), dtype=np.uint8), iterations=1)
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)

    m = cv2.moments(cnt)
    cx = float(m["m10"] / max(m["m00"], 1.0))
    cy = float(m["m01"] / max(m["m00"], 1.0))

    vec = pts.astype(np.float32) - np.array([cx, cy], dtype=np.float32)
    norms = np.maximum(np.hypot(vec[:, 0], vec[:, 1]), 1.0)
    unit = vec / norms[:, np.newaxis]

    in_pts = np.round(pts.astype(np.float32) - 4.0 * unit).astype(np.int32)
    out_pts = np.round(pts.astype(np.float32) + 4.0 * unit).astype(np.int32)
    ix = np.clip(in_pts[:, 0], 0, w - 1)
    iy = np.clip(in_pts[:, 1], 0, h - 1)
    ox = np.clip(out_pts[:, 0], 0, w - 1)
    oy = np.clip(out_pts[:, 1], 0, h - 1)

    bins = 72
    bin_hits = np.zeros((bins,), dtype=np.int32)
    bin_counts = np.zeros((bins,), dtype=np.int32)
    angles = (np.arctan2(pts[:, 1] - cy, pts[:, 0] - cx) + np.pi) / (2.0 * np.pi)
    bin_ids = np.clip((angles * bins).astype(np.int32), 0, bins - 1)

    for idx, bid in enumerate(bin_ids.tolist()):
        px, py = int(pts[idx, 0]), int(pts[idx, 1])
        bin_counts[bid] += 1
        has_stroke = int(gray_min3[py, px]) < 165
        step_contrast = float(np.linalg.norm(lab[iy[idx], ix[idx]] - lab[oy[idx], ox[idx]])) >= 24.0
        if has_stroke or step_contrast:
            bin_hits[bid] += 1

    valid = bin_counts > 0
    if int(np.count_nonzero(valid)) < 48:
        return False
    active = (bin_hits[valid] > np.maximum(0, bin_counts[valid] // 3)).astype(np.int8)
    coverage = float(active.mean())
    transitions = int(np.count_nonzero(np.diff(np.concatenate([active, active[:1]]))))
    return 0.16 <= coverage <= 0.80 and transitions >= 8


def _visual_panel_stats(crop_rgb: np.ndarray | None, body_mask: np.ndarray) -> tuple[bool, float, float]:
    """Return (is_dark, median_saturation, interior_color_std) using quiet background pixels."""
    if crop_rgb is None or crop_rgb.size == 0:
        return False, 0.0, 0.0
    rgb = crop_rgb[..., :3]
    interior = body_mask > 0
    if not np.any(interior):
        return False, 0.0, 0.0

    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    grad = np.hypot(gx, gy)
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)

    quiet_cut = float(np.percentile(grad[interior], 45))
    bg_band = interior & (grad <= quiet_cut + 1e-6)
    bg_pixels = lab[bg_band] if np.count_nonzero(bg_band) >= 16 else lab[interior]
    bg_sat = hsv[bg_band, 1] if np.count_nonzero(bg_band) >= 16 else hsv[interior, 1]

    is_dark = float(np.median(bg_pixels[:, 0])) < 100.0
    sat_med = float(np.median(bg_sat)) if bg_sat.size else 0.0
    color_std = float(np.linalg.norm(np.std(bg_pixels, axis=0))) if bg_pixels.shape[0] > 4 else 0.0
    return is_dark, sat_med, color_std


def classify_bubble_shape(
    mask: np.ndarray,
    crop_rgb: np.ndarray | None = None,
    *,
    context_rgb: np.ndarray | None = None,
    context_offset: tuple[int, int] = (0, 0),
) -> BubbleShapeClassification:
    """Classify a bubble region using geometric, convexity-defect, spectral, and panel features."""
    binary = (mask > 0).astype(np.uint8) * 255
    body_mask, has_tail = _strip_speech_tail(binary)

    contours, _ = cv2.findContours(body_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return BubbleShapeClassification(
            shape="speech",
            confidence=0.3,
            is_dark=False,
            has_tail=False,
            solidity=0.0,
            circularity=0.0,
        )

    cnt = max(contours, key=cv2.contourArea)
    area = float(cv2.contourArea(cnt))
    perimeter = float(cv2.arcLength(cnt, True))
    if area < 24.0 or perimeter <= 1e-3:
        return BubbleShapeClassification(
            shape="speech",
            confidence=0.3,
            is_dark=False,
            has_tail=False,
            solidity=0.0,
            circularity=0.0,
        )

    circularity = float(min(1.0, (4.0 * np.pi * area) / (perimeter * perimeter)))
    hull = cv2.convexHull(cnt)
    hull_area = float(max(cv2.contourArea(hull), 1.0))
    hull_peri = float(max(cv2.arcLength(hull, True), 1.0))
    solidity = float(area / hull_area)
    peri_hull_ratio = perimeter / hull_peri

    _, _, bw, bh = cv2.boundingRect(cnt)
    extent_aa = area / float(max(1, bw * bh))
    (_, _), (rw, rh), _ = cv2.minAreaRect(cnt)
    extent_rot = area / float(max(1.0, rw * rh))

    radii_norm = _resample_contour_radial(cnt)
    mean_radius = float(np.sqrt(area / np.pi))
    low_spec, mid_spec, high_spec, hf_ratio = (
        _spectral_features(radii_norm) if radii_norm is not None else (0.0, 0.0, 0.0, 0.0)
    )
    max_depth, top_depth, sharp_vertices, deep_defects = _defect_spike_and_lobe_stats(cnt, mean_radius)
    is_dark, sat_med, color_std = _visual_panel_stats(crop_rgb, body_mask)
    has_dots = _has_thought_dots(
        crop_rgb,
        body_mask,
        context_rgb=context_rgb,
        context_offset=context_offset,
        sat_med=sat_med,
    )
    is_dashed = _measure_dashed_outline(crop_rgb, body_mask)

    approx = cv2.approxPolyDP(cnt, 0.025 * perimeter, True)
    vertex_count = int(len(approx))

    if sat_med >= 50.0 and extent_rot >= 0.82 and solidity >= 0.86:
        return BubbleShapeClassification(
            shape="system_box",
            confidence=float(min(0.96, 0.65 + 0.3 * extent_rot)),
            is_dark=is_dark,
            has_tail=False,
            solidity=solidity,
            circularity=circularity,
        )

    if is_dashed and solidity >= 0.88:
        return BubbleShapeClassification(
            shape="whisper",
            confidence=0.80,
            is_dark=is_dark,
            has_tail=has_tail,
            solidity=solidity,
            circularity=circularity,
        )

    if (extent_aa >= 0.86 or extent_rot >= 0.87) and solidity >= 0.94 and vertex_count <= 8 and not has_tail:
        if sat_med >= 35.0:
            return BubbleShapeClassification(
                shape="system_box",
                confidence=float(min(0.96, 0.65 + 0.3 * extent_rot)),
                is_dark=is_dark,
                has_tail=False,
                solidity=solidity,
                circularity=circularity,
            )
        return BubbleShapeClassification(
            shape="narration",
            confidence=float(min(0.96, 0.65 + 0.3 * extent_aa)),
            is_dark=is_dark,
            has_tail=False,
            solidity=solidity,
            circularity=circularity,
        )

    if (
        (sharp_vertices >= 5 and max_depth >= 0.12 and solidity <= 0.84)
        or (max_depth >= 0.22 and sharp_vertices >= 3 and peri_hull_ratio >= 1.25)
    ):
        conf = min(0.96, 0.60 + 0.03 * min(sharp_vertices, 10) + 0.4 * min(max_depth, 0.45))
        return BubbleShapeClassification(
            shape="scream",
            confidence=float(conf),
            is_dark=is_dark,
            has_tail=has_tail,
            solidity=solidity,
            circularity=circularity,
        )

    if (
        peri_hull_ratio >= 1.14
        and (high_spec >= 0.035 or hf_ratio >= 0.48)
        and sharp_vertices < 6
        and max_depth < 0.20
    ):
        return BubbleShapeClassification(
            shape="trembling",
            confidence=float(min(0.92, 0.58 + 2.5 * min(high_spec, 0.12))),
            is_dark=is_dark,
            has_tail=has_tail,
            solidity=solidity,
            circularity=circularity,
        )

    if (
        has_dots
        or (
            deep_defects >= 4
            and mid_spec >= 0.055
            and top_depth >= 0.025
            and sharp_vertices <= 4
            and solidity <= 0.94
        )
        or (
            deep_defects >= 4
            and peri_hull_ratio >= 1.07
            and max_depth >= 0.04
            and sharp_vertices <= 3
            and hf_ratio < 0.45
        )
    ):
        if has_dots or (top_depth >= 0.045 and not is_dark and mid_spec >= 0.06):
            conf = 0.90 if has_dots else min(0.90, 0.60 + 2.5 * min(mid_spec, 0.12))
            return BubbleShapeClassification(
                shape="thought",
                confidence=float(conf),
                is_dark=is_dark,
                has_tail=False,
                solidity=solidity,
                circularity=circularity,
            )
        return BubbleShapeClassification(
            shape="happy",
            confidence=float(min(0.88, 0.58 + 2.0 * min(mid_spec, 0.12))),
            is_dark=is_dark,
            has_tail=has_tail,
            solidity=solidity,
            circularity=circularity,
        )

    speech_conf = 0.88 if (solidity >= 0.88 and circularity >= 0.45) else max(0.55, 0.5 + 0.35 * solidity)
    return BubbleShapeClassification(
        shape="speech",
        confidence=float(min(0.95, speech_conf)),
        is_dark=is_dark,
        has_tail=has_tail,
        solidity=solidity,
        circularity=circularity,
    )


def classify_bubble_from_crop(crop_rgb: np.ndarray) -> BubbleShapeClassification | None:
    """Convenience helper extracting the bubble mask inside ``crop_rgb`` before classifying."""
    mask = extract_bubble_mask_in_crop(crop_rgb, allow_full_crop=True)
    if mask is None:
        return None
    return classify_bubble_shape(mask, crop_rgb=crop_rgb)
