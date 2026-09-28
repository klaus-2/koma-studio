from __future__ import annotations

import logging
import re
import sys
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Final, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


logger = logging.getLogger(__name__)

if sys.platform == "win32":
    from _ctypes import COMError
else:  # keeps the module importable (and type-checkable) on dev machines

    class COMError(OSError): ...  # noqa: E701


_COM_STEP_ERRORS: Final = (COMError, AttributeError, TypeError, ValueError)


@contextmanager
def _com_step(description: str, **context: object) -> Iterator[None]:
    """Run one optional Photoshop property write; log and continue on COM failure.

    Only for cosmetic steps (font, leading, stroke…). Structural steps — opening
    the document, creating the layer, saving — must NOT use this and must raise.
    """
    try:
        yield
    except _COM_STEP_ERRORS:
        logger.debug(
            "photoshop.step_failed", extra={"step": description, **context}, exc_info=True
        )


class TextLayerStyle(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore", populate_by_name=True)

    font_family: str = Field(default="", alias="fontFamily")
    font_size: float = Field(default=24.0, alias="fontSize")
    computed_font_size: float | None = Field(default=None, alias="computedFontSize")
    computed_line_height: float = Field(default=0.0, alias="computedLineHeight", ge=0)
    computed_text_height: float = Field(default=0.0, alias="computedTextHeight", ge=0)
    line_spacing: float = Field(default=1.0, alias="lineSpacing")
    alignment: Literal["left", "center", "right"] = "left"
    bold: bool = False
    italic: bool = False
    underline: bool = False
    color: str = "#111111"
    outline_color: str = Field(default="#ffffff", alias="outlineColor")
    outline_width: float = Field(default=0.0, alias="outlineWidth", ge=0)
    draw_top_offset: float = Field(default=0.0, alias="drawTopOffset", ge=0)
    wrapped_text: str = Field(default="", alias="wrappedText")
    gradient_enabled: bool = Field(default=False, alias="gradientEnabled")
    point_anchor_x: float | None = Field(default=None, alias="pointAnchorX")
    point_anchor_baseline_offset: float | None = Field(
        default=None, alias="pointAnchorBaselineOffset"
    )

    @field_validator("alignment", mode="before")
    @classmethod
    def _normalize_alignment(cls, value: object) -> object:
        raw = str(value or "left").strip().lower()
        mapped = {"middle": "center", "end": "right"}.get(raw, raw)
        return mapped if mapped in {"left", "center", "right"} else "left"

    @field_validator(
        "font_size", "computed_font_size", "computed_line_height",
        "computed_text_height", "line_spacing", "outline_width",
        "draw_top_offset", "point_anchor_x", "point_anchor_baseline_offset",
        mode="before",
    )
    @classmethod
    def _coerce_float(cls, value: object) -> object:
        if value is None or isinstance(value, (int, float)):
            return value
        try:
            return float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None

    @property
    def effective_font_size(self) -> float:
        return max(6.0, self.computed_font_size or self.font_size)


class TextLayerEntry(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore")

    name: str = "text_layer"
    text: str = ""
    left: float = 0.0
    top: float = 0.0
    width: float = Field(default=1.0, ge=1.0)
    height: float = Field(default=1.0, ge=1.0)
    style: TextLayerStyle = Field(default_factory=TextLayerStyle)

    @field_validator("left", "top", "width", "height", mode="before")
    @classmethod
    def _coerce_coords(cls, value: object) -> object:
        if value is None or isinstance(value, (int, float)):
            return value
        try:
            return float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None

    @property
    def resolved_text(self) -> str:
        return (self.style.wrapped_text or self.text).replace("\r\n", "\n").strip()

    @property
    def is_editable(self) -> bool:
        return bool(self.resolved_text) and not self.style.gradient_enabled

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

        entries: list[TextLayerEntry] = []
        for layer in layers:
            try:
                entry = TextLayerEntry.model_validate(layer)
            except ValidationError:
                logger.debug(
                    "photoshop.entry_ignored", extra={"name": layer.get("name")}, exc_info=True
                )
                continue
            if entry.is_editable:
                entries.append(entry)
        if not entries:
            return 0

        created_count = 0
        try:
            with self._Session(str(psd_path), action="open", auto_close=False) as app:
                document = app.active_document
                render_group = self._find_or_create_group(document, RENDER_TEXT_GROUP_NAME)
                render_group.visible = False

                for entry in entries:
                    if self._create_text_layer(app, render_group, entry):
                        created_count += 1

                save_options = self._ps.PhotoshopSaveOptions()
                save_options.layers = True
                document.saveAs(str(psd_path), save_options, True)
                document.close(self._ps.SaveOptions.DoNotSaveChanges)
        except COMError as exc:
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
        except _COM_STEP_ERRORS:
            logger.debug("Could not iterate layerSets; creating a new group", exc_info=True)

        group = document.layerSets.add()
        group.name = name
        return group

    def _create_text_layer(self, session: Any, render_group: Any, entry: TextLayerEntry) -> bool:
        """Create and configure a single text layer."""

        style = entry.style
        text = entry.resolved_text
        if not text:
            return False

        font_size = style.effective_font_size
        left = entry.left
        top = entry.top
        width = entry.width
        height = entry.height
        box_left, box_top, box_width, box_height = self._build_paragraph_box(
            style=style,
            left=left,
            top=top,
            width=width,
            height=height,
        )

        text_layer = render_group.artLayers.add()
        text_layer.kind = self._ps.LayerKind.TextLayer
        text_layer.name = entry.name.strip() or "text_layer"
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

        outline_color = self._parse_rgb_color(style.outline_color)
        outline_width = style.outline_width
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
            style.alignment,
        )
        return True

    def _set_text_size(self, text_item: Any, font_size: float) -> None:
        """Set the font size on the text item."""

        with _com_step("font_size", size=font_size):
            text_item.size = font_size

    def _build_paragraph_box(
        self,
        *,
        style: TextLayerStyle,
        left: float,
        top: float,
        width: float,
        height: float,
    ) -> tuple[float, float, float, float]:
        """Compute the ParagraphText box aligned with the canvas preview."""

        outline_width = style.outline_width
        draw_top_offset = style.draw_top_offset
        computed_text_height = style.computed_text_height

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
        except _COM_STEP_ERRORS:
            logger.debug("Failed to configure ParagraphText; falling back to PointText", exc_info=True)
            return False

    def _set_point_text_origin(
        self,
        text_item: Any,
        *,
        style: TextLayerStyle,
        left: float,
        top: float,
        width: float,
        font_size: float,
    ) -> None:
        """Position the text layer as PointText with the same offsets as the preview."""

        try:
            text_item.kind = self._ps.TextType.PointText
        except _COM_STEP_ERRORS:
            logger.debug("Could not set PointText; keeping the default type", exc_info=True)

        anchor_x = (
            style.point_anchor_x
            if style.point_anchor_x is not None
            else self._resolve_default_anchor_x(style, width)
        )
        baseline_offset = (
            style.point_anchor_baseline_offset
            if style.point_anchor_baseline_offset is not None
            else font_size
        )
        with _com_step("point_text_position"):
            text_item.position = [left + anchor_x, top + baseline_offset]

    def _resolve_default_anchor_x(self, style: TextLayerStyle, width: float) -> float:
        """Returns the default horizontal anchor for left/center/right alignment."""

        if style.alignment == "center":
            return width / 2.0
        if style.alignment == "right":
            return max(0.0, width - style.outline_width)
        return style.outline_width

    def _set_optional_font_family(self, session: Any, text_item: Any, style: TextLayerStyle) -> tuple[bool, bool]:
        """Apply the font family when available on the local host."""

        family_raw = style.font_family.strip()
        if not family_raw:
            return False, False

        family = family_raw.split(",")[0].strip().strip("'\"")
        if not family:
            return False, False

        use_bold = style.bold
        use_italic = style.italic
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
        for candidate in font_candidates:
            if not candidate:
                continue
            with _com_step("font_family", requested=family, candidate=candidate):
                text_item.font = candidate
                logger.debug(
                    "Fonte aplicada no PSD: solicitada='%s' aplicada='%s'", family, candidate
                )
                return resolved_bold, resolved_italic

        logger.debug("Font '%s' is not available in the local Photoshop", family, exc_info=True)
        return False, False

    def _set_optional_justification(self, text_item: Any, style: TextLayerStyle) -> None:
        """Apply the horizontal text alignment (left/center/right)."""

        alignment = style.alignment
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
            with _com_step("justification", value=name):
                text_item.justification = value
                return

    def _set_optional_leading(self, text_item: Any, style: TextLayerStyle, *, font_size: float) -> None:
        """Applies line spacing based on the render style."""

        computed_line_height = style.computed_line_height
        if computed_line_height > 0:
            with _com_step("auto_leading_off"):
                text_item.useAutoLeading = False
            with _com_step("leading_computed", value=computed_line_height):
                text_item.leading = max(1.0, computed_line_height)
                return

        line_spacing = style.line_spacing
        if line_spacing <= 0:
            return

        with _com_step("leading_scaled", value=font_size * line_spacing):
            text_item.leading = max(1.0, font_size * line_spacing)

    def _set_optional_style_flags(
        self,
        *,
        text_item: Any,
        style: TextLayerStyle,
        resolved_font_bold: bool,
        resolved_font_italic: bool,
    ) -> None:
        """Apply style flags (bold/italic/underline) when supported."""

        apply_faux_bold = style.bold and not resolved_font_bold
        apply_faux_italic = style.italic and not resolved_font_italic

        with _com_step("faux_bold", value=apply_faux_bold):
            text_item.fauxBold = apply_faux_bold

        with _com_step("faux_italic", value=apply_faux_italic):
            text_item.fauxItalic = apply_faux_italic

        underline = style.underline
        underline_enum = getattr(self._ps, "UnderlineType", None)
        if underline_enum is not None:
            underline_value = (
                getattr(underline_enum, "UnderlineLeft", None)
                if underline
                else getattr(underline_enum, "UnderlineOff", None)
            )
            if underline_value is not None:
                with _com_step("underline_enum"):
                    text_item.underline = underline_value
                return

        if underline:
            with _com_step("underline_boolean"):
                text_item.underline = True

    def _set_optional_color(self, text_item: Any, style: TextLayerStyle) -> None:
        """Apply the main text fill color."""

        parsed = self._parse_rgb_color(style.color)
        if parsed is None:
            return

        red, green, blue = parsed
        with _com_step("text_color", color=style.color):
            color = self._ps.SolidColor()
            color.rgb.red = red
            color.rgb.green = green
            color.rgb.blue = blue
            text_item.color = color

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
            except _COM_STEP_ERRORS:
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
            except _COM_STEP_ERRORS:
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
        with _com_step("activate_layer_for_stroke"):
            session.active_document.activeLayer = text_layer

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
        with _com_step("stroke_effect", size_px=stroke_size):
            session.app.doJavaScript(script)

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
