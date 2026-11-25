from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass

from models.translation.base_translator import TranslationInputRegion


@dataclass(frozen=True, slots=True)
class RegionChunk:
    regions: tuple[TranslationInputRegion, ...]


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    wide_chars = sum(1 for ch in text if ord(ch) >= 0x2E80)
    ascii_like = len(text) - wide_chars
    return max(1, (wide_chars * 3 + 1) // 2 + (ascii_like + 3) // 4)


def split_regions_by_token_budget(
    regions: Sequence[TranslationInputRegion],
    *,
    context_window: int,
    max_output_tokens: int,
    system_tokens: int = 0,
    prompt_overhead_tokens: int = 0,
    safety_margin: int = 128,
    region_text_fn: Callable[[TranslationInputRegion], str] | None = None,
) -> list[RegionChunk]:
    items = tuple(regions)
    if not items:
        return []
    if len(items) == 1:
        return [RegionChunk(regions=items)]

    formatter = region_text_fn or (lambda region: region.text)
    available = max(
        0,
        context_window
        - max(0, max_output_tokens)
        - max(0, system_tokens)
        - max(0, prompt_overhead_tokens)
        - max(0, safety_margin),
    )

    chunks: list[RegionChunk] = []
    current: list[TranslationInputRegion] = []
    current_tokens = 0

    for region in items:
        item_tokens = estimate_tokens(formatter(region)) + 1
        if current and current_tokens + item_tokens > available:
            chunks.append(RegionChunk(regions=tuple(current)))
            current = [region]
            current_tokens = item_tokens
        else:
            current.append(region)
            current_tokens += item_tokens

    if current:
        chunks.append(RegionChunk(regions=tuple(current)))
    return chunks
