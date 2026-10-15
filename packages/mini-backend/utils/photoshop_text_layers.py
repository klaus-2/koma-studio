from __future__ import annotations

import importlib
import json
import logging
import os
import re
import shutil
import sys
import tempfile
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import Final, Literal, cast

from filelock import FileLock, Timeout
from pydantic import BaseModel, ConfigDict, Field, field_validator

logger = logging.getLogger(__name__)

SUPPORTED_PHOTOSHOP_VERSIONS: Final = (
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
SUPPORTED_PHOTOSHOP_VERSIONS_LABEL: Final = ", ".join(SUPPORTED_PHOTOSHOP_VERSIONS)
RENDER_TEXT_GROUP_NAME: Final = "✍️ Rendered Text"

_HEX_COLOR = re.compile(r"#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})")
_RGB_COLOR = re.compile(
    r"rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)"
)
_RGBA_COLOR = re.compile(
    r"rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})"
    r"\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*\)"
)


class PhotoshopTextLayerError(RuntimeError):
    """Photoshop text-layer transaction failed."""


class PhotoshopDependencyError(PhotoshopTextLayerError):
    """Required local automation dependencies are unavailable."""


class PhotoshopUnavailableError(PhotoshopTextLayerError):
    """The local Photoshop instance cannot complete the operation."""


class PhotoshopBusyError(PhotoshopTextLayerError):
    """Another writer owns the document transaction."""


def _parse_rgb_color(value: str) -> tuple[int, int, int] | None:
    normalized = value.strip()
    hexadecimal = _HEX_COLOR.fullmatch(normalized)
    if hexadecimal is not None:
        raw = hexadecimal.group(1)
        if len(raw) == 3:
            raw = "".join(character * 2 for character in raw)
        return int(raw[:2], 16), int(raw[2:4], 16), int(raw[4:], 16)

    match = _RGB_COLOR.fullmatch(normalized)
    rgba = _RGBA_COLOR.fullmatch(normalized)
    if match is None and rgba is not None:
        if float(rgba.group(4)) != 1.0:
            return None
        match = rgba
    if match is None:
        return None

    red, green, blue = (int(match.group(index)) for index in (1, 2, 3))
    if max(red, green, blue) > 255:
        return None
    return red, green, blue


class TextLayerStyle(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="ignore",
        populate_by_name=True,
        allow_inf_nan=False,
    )

    font_family: str = Field(default="", alias="fontFamily", max_length=512)
    font_size: float = Field(default=24, alias="fontSize", gt=0, le=4096)
    computed_font_size: float | None = Field(
        default=None,
        alias="computedFontSize",
        gt=0,
        le=4096,
    )
    computed_line_height: float = Field(
        default=0,
        alias="computedLineHeight",
        ge=0,
        le=100_000,
    )
    computed_text_height: float = Field(
        default=0,
        alias="computedTextHeight",
        ge=0,
        le=300_000,
    )
    line_spacing: float = Field(default=1, alias="lineSpacing", ge=0, le=100)
    alignment: Literal["left", "center", "right"] = "left"
    bold: bool = False
    italic: bool = False
    underline: bool = False
    color: str = "#111111"
    outline_color: str = Field(default="#ffffff", alias="outlineColor")
    outline_width: float = Field(default=0, alias="outlineWidth", ge=0, le=250)
    draw_top_offset: float = Field(default=0, alias="drawTopOffset", ge=0, le=300_000)
    wrapped_text: str = Field(default="", alias="wrappedText", max_length=100_000)
    gradient_enabled: bool = Field(default=False, alias="gradientEnabled")
    point_anchor_x: float | None = Field(
        default=None,
        alias="pointAnchorX",
        ge=-300_000,
        le=300_000,
    )
    point_anchor_baseline_offset: float | None = Field(
        default=None,
        alias="pointAnchorBaselineOffset",
        ge=-300_000,
        le=300_000,
    )

    @field_validator("alignment", mode="before")
    @classmethod
    def normalize_alignment(cls, value: object) -> object:
        if isinstance(value, str):
            normalized = value.strip().lower()
            return {"middle": "center", "end": "right"}.get(normalized, normalized)
        return value

    @field_validator("color", "outline_color")
    @classmethod
    def validate_color(cls, value: str) -> str:
        rgb = _parse_rgb_color(value)
        if rgb is None:
            raise ValueError("Expected an opaque RGB color")
        return "#{:02x}{:02x}{:02x}".format(*rgb)

    @property
    def effective_font_size(self) -> float:
        return max(6.0, self.computed_font_size or self.font_size)


class TextLayerEntry(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore", allow_inf_nan=False)

    name: str = Field(default="text_layer", max_length=512)
    text: str = Field(default="", max_length=100_000)
    left: float = Field(default=0, ge=-300_000, le=300_000)
    top: float = Field(default=0, ge=-300_000, le=300_000)
    width: float = Field(default=1, ge=1, le=300_000)
    height: float = Field(default=1, ge=1, le=300_000)
    style: TextLayerStyle = Field(default_factory=TextLayerStyle)

    @property
    def resolved_text(self) -> str:
        return (
            (self.style.wrapped_text or self.text)
            .replace("\r\n", "\n")
            .replace("\r", "\n")
            .strip()
        )

    @property
    def is_editable(self) -> bool:
        return bool(self.resolved_text) and not self.style.gradient_enabled


class _ScriptResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    created: int = Field(ge=0)
    cosmetic_failures: int = Field(ge=0)


def _invoke(target: object, *arguments: object) -> object:
    if not callable(target):
        raise PhotoshopDependencyError("Automation member is not callable")
    function = cast(Callable[..., object], target)
    return function(*arguments)


def _member(target: object, name: str) -> object:
    value: object = getattr(target, name)
    return value


_SCRIPT: Final = r"""
(function () {
    var input = __INPUT__;
    var previousUnits = app.preferences.rulerUnits;
    var previousTypeUnits = app.preferences.typeUnits;
    var previousDialogs = app.displayDialogs;
    var document = null;
    var failures = 0;
    var created = 0;
    var fontCache = {};

    function optional(operation) {
        try {
            operation();
            return true;
        } catch (error) {
            failures += 1;
            return false;
        }
    }

    function normalize(value) {
        return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    function color(hex) {
        var result = new SolidColor();
        result.rgb.red = parseInt(hex.substr(1, 2), 16);
        result.rgb.green = parseInt(hex.substr(3, 2), 16);
        result.rgb.blue = parseInt(hex.substr(5, 2), 16);
        return result;
    }

    function resolveFont(style) {
        var family = style.font_family.split(",")[0]
            .replace(/^\s+|\s+$/g, "").replace(/^['"]|['"]$/g, "");
        if (!family) {
            return null;
        }
        var key = family.toLowerCase() + ":" + style.bold + ":" + style.italic;
        if (fontCache.hasOwnProperty(key)) {
            return fontCache[key];
        }
        var wanted = normalize(family);
        var best = null;
        var bestScore = -100000;
        for (var index = 0; index < app.fonts.length; index += 1) {
            var font = app.fonts[index];
            var normalizedFamily = normalize(font.family);
            var normalizedName = normalize(font.name);
            if (normalizedFamily !== wanted &&
                    normalizedName !== wanted &&
                    normalizedName.indexOf(wanted) !== 0) {
                continue;
            }
            var fontStyle = String(font.style).toLowerCase();
            var bold = /bold|black|heavy|semibold|demi/.test(fontStyle);
            var italic = /italic|oblique/.test(fontStyle);
            var score = normalizedFamily === wanted ? 100 : 50;
            score += bold === style.bold ? 20 : -20;
            score += italic === style.italic ? 20 : -20;
            if (score > bestScore) {
                bestScore = score;
                best = {
                    name: font.postScriptName,
                    bold: bold,
                    italic: italic
                };
            }
        }
        fontCache[key] = best;
        return best;
    }

    function stroke(layer, hex, size) {
        document.activeLayer = layer;
        var descriptor = new ActionDescriptor();
        var reference = new ActionReference();
        reference.putProperty(charIDToTypeID("Prpr"), charIDToTypeID("Lefx"));
        reference.putEnumerated(
            charIDToTypeID("Lyr "),
            charIDToTypeID("Ordn"),
            charIDToTypeID("Trgt")
        );
        descriptor.putReference(charIDToTypeID("null"), reference);

        var effects = new ActionDescriptor();
        var outline = new ActionDescriptor();
        outline.putBoolean(charIDToTypeID("enab"), true);
        outline.putEnumerated(
            charIDToTypeID("Styl"),
            charIDToTypeID("FStl"),
            charIDToTypeID("CtrF")
        );
        outline.putEnumerated(
            charIDToTypeID("PntT"),
            charIDToTypeID("FrFl"),
            charIDToTypeID("SClr")
        );
        outline.putEnumerated(
            charIDToTypeID("Md  "),
            charIDToTypeID("BlnM"),
            charIDToTypeID("Nrml")
        );
        outline.putUnitDouble(
            charIDToTypeID("Opct"), charIDToTypeID("#Prc"), 100
        );
        outline.putUnitDouble(
            charIDToTypeID("Sz  "), charIDToTypeID("#Pxl"), size
        );

        var rgb = color(hex).rgb;
        var components = new ActionDescriptor();
        components.putDouble(charIDToTypeID("Rd  "), rgb.red);
        components.putDouble(charIDToTypeID("Grn "), rgb.green);
        components.putDouble(charIDToTypeID("Bl  "), rgb.blue);
        outline.putObject(
            charIDToTypeID("Clr "),
            charIDToTypeID("RGBC"),
            components
        );
        effects.putObject(
            charIDToTypeID("FrFX"),
            charIDToTypeID("FrFX"),
            outline
        );
        descriptor.putObject(
            charIDToTypeID("T   "),
            charIDToTypeID("Lefx"),
            effects
        );
        executeAction(charIDToTypeID("setd"), descriptor, DialogModes.NO);
    }

    try {
        app.preferences.rulerUnits = Units.PIXELS;
        app.preferences.typeUnits = TypeUnits.POINTS;
        app.displayDialogs = DialogModes.NO;
        document = app.open(new File(input.path));

        var group = document.layerSets.add();
        group.name = input.group;
        group.visible = false;
        var pointsPerPixel = 72 / document.resolution;

        for (var index = 0; index < input.entries.length; index += 1) {
            var entry = input.entries[index];
            var style = entry.style;
            var layer = group.artLayers.add();
            layer.kind = LayerKind.TEXT;
            layer.name = entry.name || "text_layer";
            var text = layer.textItem;
            var size = Math.max(6, style.computed_font_size || style.font_size);
            var boxHeight = style.computed_text_height > 0
                ? Math.min(entry.height, style.computed_text_height)
                : entry.height - style.draw_top_offset;

            var paragraph = optional(function () {
                text.kind = TextType.PARAGRAPHTEXT;
                text.position = [
                    entry.left + style.outline_width,
                    entry.top + style.draw_top_offset
                ];
                text.width = Math.max(1, entry.width - style.outline_width * 2);
                text.height = Math.max(1, boxHeight);
            });
            if (!paragraph) {
                text.kind = TextType.POINTTEXT;
                var anchor = style.point_anchor_x;
                if (anchor === null) {
                    anchor = style.alignment === "center" ? entry.width / 2
                        : style.alignment === "right"
                            ? Math.max(0, entry.width - style.outline_width)
                            : style.outline_width;
                }
                var baseline = style.point_anchor_baseline_offset;
                text.position = [
                    entry.left + anchor,
                    entry.top + (baseline === null ? size : baseline)
                ];
            }

            text.contents = entry.resolved_text.replace(/\n/g, "\r");
            text.size = size * pointsPerPixel;
            var resolved = resolveFont(style);
            var fontApplied = resolved !== null && optional(function () {
                text.font = resolved.name;
            });

            optional(function () {
                text.justification = style.alignment === "center"
                    ? Justification.CENTER
                    : style.alignment === "right"
                        ? Justification.RIGHT
                        : Justification.LEFT;
            });
            optional(function () {
                text.fauxBold = style.bold && !(fontApplied && resolved.bold);
                text.fauxItalic = style.italic && !(fontApplied && resolved.italic);
            });
            optional(function () {
                text.underline = style.underline
                    ? UnderlineType.UNDERLINELEFT
                    : UnderlineType.UNDERLINEOFF;
            });
            optional(function () {
                text.color = color(style.color);
            });

            var leading = style.computed_line_height ||
                (style.line_spacing > 0 ? size * style.line_spacing : 0);
            if (leading > 0) {
                optional(function () {
                    text.useAutoLeading = false;
                    text.leading = Math.max(1, leading) * pointsPerPixel;
                });
            }
            if (style.outline_width > 0) {
                optional(function () {
                    stroke(layer, style.outline_color, style.outline_width);
                });
            }
            created += 1;
        }

        var options = new PhotoshopSaveOptions();
        options.layers = true;
        document.saveAs(new File(input.path), options, true);
        return '{"created":' + created +
            ',"cosmetic_failures":' + failures + '}';
    } finally {
        try {
            if (document !== null) {
                document.close(SaveOptions.DONOTSAVECHANGES);
            }
        } finally {
            app.preferences.rulerUnits = previousUnits;
            app.preferences.typeUnits = previousTypeUnits;
            app.displayDialogs = previousDialogs;
        }
    }
}());
"""


class PhotoshopTextLayerWriter:
    __slots__ = ()

    def _run_script(self, script: str) -> _ScriptResult:
        if sys.platform != "win32":
            raise PhotoshopUnavailableError("Photoshop COM automation requires Windows")

        try:
            com = importlib.import_module("comtypes")
            api = importlib.import_module("photoshop.api")
        except ImportError as exc:
            raise PhotoshopDependencyError(
                "Install the Photoshop optional dependency in the worker environment"
            ) from exc

        initialized = False
        try:
            _invoke(_member(com, "CoInitialize"))
            initialized = True
            application = _invoke(_member(api, "Application"))
            response = _invoke(_member(application, "doJavaScript"), script)
            if not isinstance(response, str):
                raise PhotoshopUnavailableError("Photoshop returned an invalid result")
            return _ScriptResult.model_validate_json(response)
        except PhotoshopTextLayerError:
            raise
        except Exception as exc:
            # COM is an untyped external system; this is its exception boundary.
            raise PhotoshopUnavailableError("Photoshop document transaction failed") from exc
        finally:
            if initialized:
                _invoke(_member(com, "CoUninitialize"))

    def apply_text_layers(
        self,
        psd_path: Path,
        layers: Sequence[Mapping[str, object]],
    ) -> int:
        """Blocking transaction; execute in a dedicated thread, never on an event loop."""
        if len(layers) > 10_000:
            raise ValueError("Text-layer count exceeds the document budget")
        if psd_path.is_symlink():
            raise PhotoshopTextLayerError("Symbolic-link PSD targets are not accepted")

        target = psd_path.resolve(strict=True)
        if target.suffix.lower() != ".psd" or not target.is_file():
            raise PhotoshopTextLayerError("Target must be an existing PSD file")

        entries = [TextLayerEntry.model_validate(layer) for layer in layers]
        editable = [entry for entry in entries if entry.is_editable]
        if not editable:
            return 0
        if sum(len(entry.resolved_text) for entry in editable) > 2_000_000:
            raise ValueError("Document text exceeds the transaction budget")

        lock = FileLock(
            target.with_name(f".{target.name}.text-layers.lock"),
            timeout=0,
            mode=0o600,
        )
        try:
            with lock:
                return self._apply_locked(target, editable)
        except Timeout as exc:
            raise PhotoshopBusyError("Another writer owns this PSD") from exc

    def _apply_locked(
        self,
        target: Path,
        entries: Sequence[TextLayerEntry],
    ) -> int:
        descriptor, name = tempfile.mkstemp(
            prefix=f".{target.stem}-",
            suffix=".psd",
            dir=target.parent,
        )
        os.close(descriptor)
        temporary = Path(name)
        try:
            shutil.copyfile(target, temporary)
            temporary.chmod(0o600)

            payload: dict[str, object] = {
                "path": str(temporary),
                "group": RENDER_TEXT_GROUP_NAME,
                "entries": [
                    {
                        # snake_case dump: the JSX script reads font_family,
                        # computed_font_size etc. (no by_alias here).
                        **entry.model_dump(mode="json"),
                        "resolved_text": entry.resolved_text,
                    }
                    for entry in entries
                ],
            }
            script = _SCRIPT.replace(
                "__INPUT__",
                json.dumps(payload, ensure_ascii=True, allow_nan=False),
                1,
            )
            result = self._run_script(script)
            if result.created != len(entries):
                raise PhotoshopTextLayerError("Photoshop created an incomplete layer set")

            with temporary.open("rb") as handle:
                os.fsync(handle.fileno())
            os.replace(temporary, target)
            logger.info(
                "photoshop.text_layers_applied",
                extra={
                    "created": result.created,
                    "cosmetic_failures": result.cosmetic_failures,
                },
            )
            return result.created
        finally:
            temporary.unlink(missing_ok=True)
