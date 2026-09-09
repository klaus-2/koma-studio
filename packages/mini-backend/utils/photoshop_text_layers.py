from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any


logger = logging.getLogger(__name__)

SUPPORTED_PHOTOSHOP_VERSIONS: tuple[str, ...] = (
    "2025",
    "2024",
    "2023",
    "2022",
    "2021",
    "2020",
    "cc2019",
    "cc2018",
    "cc2017",
)
SUPPORTED_PHOTOSHOP_VERSIONS_LABEL = ", ".join(SUPPORTED_PHOTOSHOP_VERSIONS)
RENDER_TEXT_GROUP_NAME = "✍️ Rendered Text"

_HEX_COLOR = re.compile(r"^#?(?P<raw>[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
_RGB_COLOR = re.compile(r"^rgb\((?P<r>\d{1,3})\s*,\s*(?P<g>\d{1,3})\s*,\s*(?P<b>\d{1,3})\)$")
_RGBA_COLOR = re.compile(
    r"^rgba\((?P<r>\d{1,3})\s*,\s*(?P<g>\d{1,3})\s*,\s*(?P<b>\d{1,3})\s*,\s*(?P<a>[\d.]+)\)$"
)
_FONT_TOKEN_SANITIZER = re.compile(r"[^a-z0-9]+")


class PhotoshopTextLayerError(RuntimeError):
    """Base error for writing type layers through Adobe Photoshop."""


class PhotoshopDependencyError(PhotoshopTextLayerError):
    """Raised when the `photoshop` module is not available."""


class PhotoshopUnavailableError(PhotoshopTextLayerError):
    """Raised when Adobe Photoshop is not reachable on the local host."""


class PhotoshopTextLayerWriter:
    """Applies editable text layers to a PSD using a local Adobe Photoshop install."""

    def __init__(self) -> None:
        """
        Inicializa integracao com Photoshop.

        Raises:
            PhotoshopDependencyError: When `photoshop-python-api` is not installed.
        """

        try:
            from photoshop import Session  # type: ignore[import-not-found]
            from photoshop import api as ps  # type: ignore[import-not-found]
        except ModuleNotFoundError as exc:
            raise PhotoshopDependencyError(
                "Dependencia ausente para text layers editaveis: instale 'photoshop-python-api'."
            ) from exc

        self._Session = Session
        self._ps = ps
        self._font_cache: dict[str, tuple[str | None, bool, bool]] = {}

    def apply_text_layers(
        self,
        psd_path: Path,
        layers: list[dict[str, Any]],
    ) -> int:
        """
        Open a PSD and create editable TypeLayers in the `✍️ Rendered Text` group.

        Args:
            psd_path: Path to the base PSD file.
            layers: List of normalized entries with `name`, `text`, `style`, `left`, `top`.

        Returns:
            Number of text layers created.

        Raises:
            PhotoshopUnavailableError: When Photoshop is not installed/available.
        """

        if not psd_path.exists():
            raise PhotoshopUnavailableError(f"Base PSD not found: {psd_path}")

        editable_layers = [
            layer
            for layer in layers
            if str(layer.get("text", "")).strip()
            and not (
                isinstance(layer.get("style"), dict)
                and bool(layer["style"].get("gradientEnabled"))
            )
        ]
        if not editable_layers:
            return 0

        created_count = 0
        try:
            with self._Session(str(psd_path), action="open", auto_close=False) as app:
                document = app.active_document
                render_group = self._find_or_create_group(document, RENDER_TEXT_GROUP_NAME)
                render_group.visible = False

                for entry in editable_layers:
                    if self._create_text_layer(app, render_group, entry):
                        created_count += 1

                save_options = self._ps.PhotoshopSaveOptions()
                save_options.layers = True
                document.saveAs(str(psd_path), save_options, True)
                document.close(self._ps.SaveOptions.DoNotSaveChanges)
        except Exception as exc:
            raise PhotoshopUnavailableError(
                "PSD export with editable text layers requires Adobe Photoshop installed on the same machine. "
                f"Versoes testadas: {SUPPORTED_PHOTOSHOP_VERSIONS_LABEL}."
            ) from exc

        logger.info("TypeLayers aplicadas via Photoshop: %d", created_count)
        return created_count

    def _find_or_create_group(self, document: Any, name: str) -> Any:
        """Find a group by name or create a new `LayerSet` in the document."""

        try:
            for group in document.layerSets:
                if str(getattr(group, "name", "")).strip() == name:
                    return group
        except Exception:
            logger.debug("Could not iterate layerSets; creating a new group", exc_info=True)

        group = document.layerSets.add()
        group.name = name
        return group

    def _create_text_layer(self, session: Any, render_group: Any, entry: dict[str, Any]) -> bool:
        """Create and configure a single text layer."""

        style = entry.get("style") if isinstance(entry.get("style"), dict) else {}
        text = self._resolve_layer_text(entry, style)
        if not text:
            return False

        font_size = max(6.0, self._as_float(style.get("computedFontSize", style.get("fontSize", 24.0)), 24.0))
        left = self._as_float(entry.get("left", 0), 0.0)
        top = self._as_float(entry.get("top", 0), 0.0)
        width = max(1.0, self._as_float(entry.get("width", 1.0), 1.0))
        height = max(1.0, self._as_float(entry.get("height", 1.0), 1.0))
        box_left, box_top, box_width, box_height = self._build_paragraph_box(
            style=style,
            left=left,
            top=top,
            width=width,
            height=height,
        )

        text_layer = render_group.artLayers.add()
        text_layer.kind = self._ps.LayerKind.TextLayer
        text_layer.name = str(entry.get("name", "text_layer")).strip() or "text_layer"
        text_item = text_layer.textItem
        paragraph_ok = self._set_paragraph_text_box(
            text_item=text_item,
            left=box_left,
            top=box_top,
            width=box_width,
            height=box_height,
        )
        if not paragraph_ok:
            self._set_point_text_origin(
                text_item=text_item,
                style=style,
                left=left,
                top=top,
                width=width,
                font_size=font_size,
            )

        text_item.contents = text
        self._set_text_size(text_item, font_size)

        resolved_font_bold, resolved_font_italic = self._set_optional_font_family(session, text_item, style)
        self._set_optional_justification(text_item, style)
        self._set_optional_leading(text_item, style, font_size=font_size)
        self._set_optional_style_flags(
            text_item=text_item,
            style=style,
            resolved_font_bold=resolved_font_bold,
            resolved_font_italic=resolved_font_italic,
        )
        self._set_optional_color(text_item, style)

        outline_color = self._parse_rgb_color(str(style.get("outlineColor", "#ffffff")))
        outline_width = max(0.0, self._as_float(style.get("outlineWidth", 0.0), 0.0))
        if outline_color is not None and outline_width > 0:
            self._apply_stroke_effect(
                session=session,
                text_layer=text_layer,
                color=outline_color,
                size_px=max(0.5, outline_width),
            )
        logger.debug(
            "Text layer '%s' criada: font=%.2f, box=(%.2f,%.2f,%.2f,%.2f), alignment=%s",
            text_layer.name,
            font_size,
            box_left,
            box_top,
            box_width,
            box_height,
            str(style.get("alignment", "left")).strip().lower(),
        )
        return True

    def _resolve_layer_text(self, entry: dict[str, Any], style: dict[str, Any]) -> str:
        """Resolve the layer initial text, preferring the wrap computed in the preview."""

        wrapped_text = str(style.get("wrappedText", "")).replace("\r\n", "\n").strip()
        if wrapped_text:
            return wrapped_text
        return str(entry.get("text", "")).replace("\r\n", "\n").strip()

    def _set_text_size(self, text_item: Any, font_size: float) -> None:
        """Set the font size on the text item."""

        try:
            text_item.size = font_size
        except Exception:
            logger.debug("Failed to apply font size (%.2f)", font_size, exc_info=True)

    def _build_paragraph_box(
        self,
        *,
        style: dict[str, Any],
        left: float,
        top: float,
        width: float,
        height: float,
    ) -> tuple[float, float, float, float]:
        """Compute the ParagraphText box aligned with the canvas preview."""

        outline_width = max(0.0, self._as_float(style.get("outlineWidth", 0.0), 0.0))
        draw_top_offset = max(0.0, self._as_float(style.get("drawTopOffset", 0.0), 0.0))
        computed_text_height = max(0.0, self._as_float(style.get("computedTextHeight", 0.0), 0.0))

        paragraph_left = left + outline_width
        paragraph_top = top + draw_top_offset
        paragraph_width = max(1.0, width - (outline_width * 2.0))
        if computed_text_height > 0:
            paragraph_height = max(1.0, min(height, computed_text_height))
        else:
            paragraph_height = max(1.0, height - draw_top_offset)
        return paragraph_left, paragraph_top, paragraph_width, paragraph_height

    def _set_paragraph_text_box(
        self,
        *,
        text_item: Any,
        left: float,
        top: float,
        width: float,
        height: float,
    ) -> bool:
        """Configure the text item as ParagraphText with a bounding box."""

        try:
            text_item.kind = self._ps.TextType.ParagraphText
            text_item.position = [left, top]
            text_item.width = width
            text_item.height = height
            return True
        except Exception:
            logger.debug("Failed to configure ParagraphText; falling back to PointText", exc_info=True)
            return False

    def _set_point_text_origin(
        self,
        text_item: Any,
        *,
        style: dict[str, Any],
        left: float,
        top: float,
        width: float,
        font_size: float,
    ) -> None:
        """Position the text layer as PointText with the same offsets as the preview."""

        try:
            text_item.kind = self._ps.TextType.PointText
        except Exception:
            logger.debug("Could not set PointText; keeping the default type", exc_info=True)

        anchor_x = self._as_float(style.get("pointAnchorX", self._resolve_default_anchor_x(style, width)), 0.0)
        baseline_offset = self._as_float(style.get("pointAnchorBaselineOffset", font_size), font_size)
        try:
            text_item.position = [left + anchor_x, top + baseline_offset]
        except Exception:
            logger.debug("Failed to position PointText", exc_info=True)

    def _resolve_default_anchor_x(self, style: dict[str, Any], width: float) -> float:
        """Returns the default horizontal anchor for left/center/right alignment."""

        alignment = self._resolve_alignment(style)
        outline_width = max(0.0, self._as_float(style.get("outlineWidth", 0.0), 0.0))
        if alignment == "center":
            return width / 2.0
        if alignment == "right":
            return max(0.0, width - outline_width)
        return outline_width

    def _set_optional_font_family(self, session: Any, text_item: Any, style: dict[str, Any]) -> tuple[bool, bool]:
        """Apply the font family when available on the local host."""

        family_raw = str(style.get("fontFamily", "")).strip()
        if not family_raw:
            return False, False

        family = family_raw.split(",")[0].strip().strip("'\"")
        if not family:
            return False, False

        use_bold = bool(style.get("bold", False))
        use_italic = bool(style.get("italic", False))
        (
            resolved_postscript,
            resolved_font_name,
            resolved_bold,
            resolved_italic,
        ) = self._resolve_font_variant(
            session,
            family=family,
            bold=use_bold,
            italic=use_italic,
        )

        font_candidates = [resolved_postscript, resolved_font_name, family]
        try:
            for candidate in font_candidates:
                if not candidate:
                    continue
                try:
                    text_item.font = candidate
                    logger.debug("Fonte aplicada no PSD: solicitada='%s' aplicada='%s'", family, candidate)
                    return resolved_bold, resolved_italic
                except Exception:
                    continue
        except Exception:
            pass

        logger.debug("Font '%s' is not available in the local Photoshop", family, exc_info=True)
        return False, False

    def _set_optional_justification(self, text_item: Any, style: dict[str, Any]) -> None:
        """Apply the horizontal text alignment (left/center/right)."""

        alignment = self._resolve_alignment(style)
        justification_enum = getattr(self._ps, "Justification", None)
        if justification_enum is None:
            return

        enum_candidates = {
            "left": ("Left", "LEFT"),
            "center": ("Center", "CENTER"),
            "right": ("Right", "RIGHT"),
        }
        candidates = enum_candidates.get(alignment, enum_candidates["left"])
        for name in candidates:
            value = getattr(justification_enum, name, None)
            if value is None:
                continue
            try:
                text_item.justification = value
                return
            except Exception:
                logger.debug("Failed to apply justification '%s'", name, exc_info=True)

    def _set_optional_leading(self, text_item: Any, style: dict[str, Any], *, font_size: float) -> None:
        """Applies line spacing based on the render style."""

        computed_line_height = self._as_float(style.get("computedLineHeight", 0), 0.0)
        if computed_line_height > 0:
            try:
                text_item.useAutoLeading = False
            except Exception:
                logger.debug("Could not disable AutoLeading", exc_info=True)
            try:
                text_item.leading = max(1.0, computed_line_height)
                return
            except Exception:
                logger.debug("Failed to apply computedLineHeight to text_item", exc_info=True)

        try:
            line_spacing = float(style.get("lineSpacing", 1.0))
        except (TypeError, ValueError):
            return

        if line_spacing <= 0:
            return

        try:
            text_item.leading = max(1.0, font_size * line_spacing)
        except Exception:
            logger.debug("Failed to apply leading to text_item", exc_info=True)

    def _set_optional_style_flags(
        self,
        *,
        text_item: Any,
        style: dict[str, Any],
        resolved_font_bold: bool,
        resolved_font_italic: bool,
    ) -> None:
        """Apply style flags (bold/italic/underline) when supported."""

        requested_bold = bool(style.get("bold", False))
        requested_italic = bool(style.get("italic", False))

        apply_faux_bold = requested_bold and not resolved_font_bold
        apply_faux_italic = requested_italic and not resolved_font_italic

        try:
            text_item.fauxBold = apply_faux_bold
        except Exception:
            logger.debug("Failed to apply fauxBold", exc_info=True)

        try:
            text_item.fauxItalic = apply_faux_italic
        except Exception:
            logger.debug("Failed to apply fauxItalic", exc_info=True)

        underline = bool(style.get("underline", False))
        underline_enum = getattr(self._ps, "UnderlineType", None)
        if underline_enum is not None:
            try:
                underline_value = (
                    getattr(underline_enum, "UnderlineLeft", None)
                    if underline
                    else getattr(underline_enum, "UnderlineOff", None)
                )
                if underline_value is not None:
                    text_item.underline = underline_value
                    return
            except Exception:
                logger.debug("Failed to apply UnderlineType", exc_info=True)

        if underline:
            try:
                text_item.underline = True
            except Exception:
                logger.debug("Failed to apply the boolean underline flag", exc_info=True)

    def _set_optional_color(self, text_item: Any, style: dict[str, Any]) -> None:
        """Apply the main text fill color."""

        parsed = self._parse_rgb_color(str(style.get("color", "#111111")))
        if parsed is None:
            return

        red, green, blue = parsed
        try:
            color = self._ps.SolidColor()
            color.rgb.red = red
            color.rgb.green = green
            color.rgb.blue = blue
            text_item.color = color
        except Exception:
            logger.debug("Failed to apply color to text_item", exc_info=True)

    def _resolve_font_variant(
        self,
        session: Any,
        *,
        family: str,
        bold: bool,
        italic: bool,
    ) -> tuple[str | None, str | None, bool, bool]:
        """Resolve the font variant (postscript + name) closest to the style."""

        cache_key = f"{family.lower()}::{int(bold)}::{int(italic)}"
        if cache_key in self._font_cache:
            cached_postscript, cached_bold, cached_italic = self._font_cache[cache_key]
            return cached_postscript, None, cached_bold, cached_italic

        fonts = getattr(session.app, "fonts", None)
        if fonts is None:
            self._font_cache[cache_key] = (None, False, False)
            return None, None, False, False

        style_suffix = " Bold Italic" if bold and italic else (" Bold" if bold else (" Italic" if italic else ""))
        family_candidates = [
            family,
            f"{family}{style_suffix}",
            f"{family} Regular" if not bold and not italic else family,
        ]
        resolved_from_name = self._resolve_font_by_name(fonts, family_candidates)
        if resolved_from_name is not None:
            postscript = str(getattr(resolved_from_name, "postScriptName", "") or "").strip() or None
            font_name = str(getattr(resolved_from_name, "name", "") or "").strip() or None
            font_style = str(getattr(resolved_from_name, "style", "") or "").strip().lower()
            has_bold = any(token in font_style for token in ("bold", "black", "heavy", "semi"))
            has_italic = any(token in font_style for token in ("italic", "oblique"))
            self._font_cache[cache_key] = (postscript, has_bold, has_italic)
            return postscript, font_name, has_bold, has_italic

        family_lower = family.lower()
        family_norm = self._normalize_font_token(family)
        best_postscript: str | None = None
        best_font_name: str | None = None
        best_has_bold = False
        best_has_italic = False
        best_score = -1

        for font in fonts:
            try:
                postscript = str(getattr(font, "postScriptName", "") or "").strip()
                font_name = str(getattr(font, "name", "") or "").strip()
                font_family = str(getattr(font, "family", "") or "").strip()
                font_style = str(getattr(font, "style", "") or "").strip()
            except Exception:
                continue

            if not postscript:
                continue

            font_name_lower = font_name.lower()
            font_family_lower = font_family.lower()
            font_name_norm = self._normalize_font_token(font_name)
            font_family_norm = self._normalize_font_token(font_family)
            font_style_lower = font_style.lower()
            family_match = (
                font_family_lower == family_lower
                or font_name_lower == family_lower
                or font_family_norm == family_norm
                or font_name_norm == family_norm
                or family_lower in font_name_lower
                or family_lower in postscript.lower()
                or (family_norm and family_norm in font_name_norm)
                or (family_norm and family_norm in font_family_norm)
            )
            if not family_match:
                continue

            has_bold = any(token in font_style_lower for token in ("bold", "black", "heavy", "semi"))
            has_italic = any(token in font_style_lower for token in ("italic", "oblique"))

            score = 0
            if font_family_lower == family_lower:
                score += 230
            elif font_name_lower == family_lower:
                score += 220
            elif font_family_norm == family_norm and family_norm:
                score += 200
            elif font_name_norm == family_norm and family_norm:
                score += 190
            elif family_lower in font_name_lower:
                score += 150
            elif family_lower in font_family_lower:
                score += 140
            else:
                score += 110

            score += 20 if has_bold == bold else -10
            score += 20 if has_italic == italic else -10

            if not bold and not italic and any(token in font_style_lower for token in ("regular", "roman", "book")):
                score += 8

            if score > best_score:
                best_score = score
                best_postscript = postscript
                best_font_name = font_name
                best_has_bold = has_bold
                best_has_italic = has_italic

        resolved = (best_postscript, best_has_bold, best_has_italic)
        self._font_cache[cache_key] = resolved
        return best_postscript, best_font_name, best_has_bold, best_has_italic

    def _resolve_font_by_name(self, fonts: Any, candidates: list[str]) -> Any | None:
        """Try to resolve a font by exact name using `TextFonts.getByName`."""

        for raw_candidate in candidates:
            candidate = str(raw_candidate or "").strip()
            if not candidate:
                continue
            try:
                return fonts.getByName(candidate)
            except Exception:
                continue
        return None

    def _apply_stroke_effect(
        self,
        *,
        session: Any,
        text_layer: Any,
        color: tuple[int, int, int],
        size_px: float,
    ) -> None:
        """Apply `Layer Effects > Stroke` to reproduce the preview outline."""

        red, green, blue = color
        stroke_size = max(0.5, float(size_px))
        try:
            session.active_document.activeLayer = text_layer
        except Exception:
            logger.debug("Could not activate the text layer for stroke", exc_info=True)

        script = f"""
(function() {{
  var desc = new ActionDescriptor();
  var ref = new ActionReference();
  ref.putProperty(charIDToTypeID('Prpr'), charIDToTypeID('Lefx'));
  ref.putEnumerated(charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));
  desc.putReference(charIDToTypeID('null'), ref);

  var layerFxDesc = new ActionDescriptor();
  var strokeDesc = new ActionDescriptor();
  strokeDesc.putBoolean(charIDToTypeID('enab'), true);
  strokeDesc.putEnumerated(charIDToTypeID('Styl'), charIDToTypeID('FStl'), charIDToTypeID('CtrF'));
  strokeDesc.putEnumerated(charIDToTypeID('PntT'), charIDToTypeID('FrFl'), charIDToTypeID('SClr'));
  strokeDesc.putEnumerated(charIDToTypeID('Md  '), charIDToTypeID('BlnM'), charIDToTypeID('Nrml'));
  strokeDesc.putUnitDouble(charIDToTypeID('Opct'), charIDToTypeID('#Prc'), 100.0);
  strokeDesc.putUnitDouble(charIDToTypeID('Sz  '), charIDToTypeID('#Pxl'), {stroke_size:.4f});

  var rgbDesc = new ActionDescriptor();
  rgbDesc.putDouble(charIDToTypeID('Rd  '), {red});
  rgbDesc.putDouble(charIDToTypeID('Grn '), {green});
  rgbDesc.putDouble(charIDToTypeID('Bl  '), {blue});
  strokeDesc.putObject(charIDToTypeID('Clr '), charIDToTypeID('RGBC'), rgbDesc);

  layerFxDesc.putObject(charIDToTypeID('FrFX'), charIDToTypeID('FrFX'), strokeDesc);
  desc.putObject(charIDToTypeID('T   '), charIDToTypeID('Lefx'), layerFxDesc);
  executeAction(charIDToTypeID('setd'), desc, DialogModes.NO);
}})();
"""
        try:
            session.app.doJavaScript(script)
        except Exception:
            logger.debug("Failed to apply stroke via ActionDescriptor/JS", exc_info=True)

    def _as_float(self, value: Any, default: float) -> float:
        """Convert a value to float with a safe fallback."""

        try:
            return float(value)
        except (TypeError, ValueError):
            return float(default)

    def _resolve_alignment(self, style: dict[str, Any]) -> str:
        """Normalize the style alignment to left/center/right."""

        raw = str(style.get("alignment", "left")).strip().lower()
        if raw in {"center", "middle"}:
            return "center"
        if raw in {"right", "end"}:
            return "right"
        return "left"

    def _normalize_font_token(self, value: str) -> str:
        """Normalize a string for robust font comparison."""

        return _FONT_TOKEN_SANITIZER.sub("", value.strip().lower())

    def _parse_rgb_color(self, raw_color: str) -> tuple[int, int, int] | None:
        """Converts a CSS color (`#RRGGBB`, `#RGB`, `rgb(r,g,b)`) to RGB."""

        normalized = raw_color.strip()
        if not normalized:
            return None

        hex_match = _HEX_COLOR.match(normalized)
        if hex_match:
            value = hex_match.group("raw")
            if len(value) == 3:
                value = "".join(ch * 2 for ch in value)
            return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))

        rgb_match = _RGB_COLOR.match(normalized)
        if rgb_match:
            red = max(0, min(255, int(rgb_match.group("r"))))
            green = max(0, min(255, int(rgb_match.group("g"))))
            blue = max(0, min(255, int(rgb_match.group("b"))))
            return (red, green, blue)

        rgba_match = _RGBA_COLOR.match(normalized)
        if rgba_match:
            red = max(0, min(255, int(rgba_match.group("r"))))
            green = max(0, min(255, int(rgba_match.group("g"))))
            blue = max(0, min(255, int(rgba_match.group("b"))))
            return (red, green, blue)

        return None
