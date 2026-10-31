"""Never-translate masking — prose-run split for local engines.

The protected terms are the glossary's ``never_translate`` sources. The text is split into steps — protected term occurrences, literal
free runs (no alnum content) and translatable runs carrying their original
pre/post whitespace — so the model only ever sees pure prose runs, never
sentinels or tokens. Reassembly restores the terms verbatim with the exact
original whitespace (parity).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
import re
from typing import Literal


@dataclass(frozen=True, slots=True)
class MaskStep:
    kind: Literal["term", "literal", "run"]
    text: str
    pre: str = ""
    post: str = ""


@dataclass(frozen=True, slots=True)
class MaskedSegment:
    steps: tuple[MaskStep, ...]
    run_texts: tuple[str, ...]


def build_term_pattern(terms: Sequence[str]) -> re.Pattern[str]:
    """Case-insensitive word-boundary alternation, longest term first."""
    escaped = sorted(
        (re.escape(term.strip()) for term in terms if term.strip()),
        key=len,
        reverse=True,
    )
    return re.compile(r"(?<!\w)(" + "|".join(escaped) + r")(?!\w)", re.IGNORECASE)


def _add_plain(
    chunk: str,
    steps: list[MaskStep],
    run_pos: dict[str, int],
    run_texts: list[str],
) -> None:
    """Register a free chunk: no alnum content becomes a literal; otherwise
    the stripped core becomes a (deduplicated) translatable run that carries
    the chunk's original pre/post whitespace."""
    core = chunk.strip()
    if not core or not any(ch.isalnum() for ch in core):
        steps.append(MaskStep(kind="literal", text=chunk))
        return
    pre = chunk[: len(chunk) - len(chunk.lstrip())]
    post = chunk[len(chunk.rstrip()) :]
    if core not in run_pos:
        run_pos[core] = len(run_texts)
        run_texts.append(core)
    steps.append(MaskStep(kind="run", text=core, pre=pre, post=post))


def plan_masked_segment(text: str, terms: Sequence[str]) -> MaskedSegment:
    """Split ``text`` around the never-translate term occurrences."""
    steps: list[MaskStep] = []
    run_texts: list[str] = []
    run_pos: dict[str, int] = {}
    if any(term.strip() for term in terms):
        pattern = build_term_pattern(terms)
        pos = 0
        for match in pattern.finditer(text):
            if match.start() > pos:
                _add_plain(text[pos : match.start()], steps, run_pos, run_texts)
            steps.append(MaskStep(kind="term", text=match.group(0)))
            pos = match.end()
        if pos < len(text):
            _add_plain(text[pos:], steps, run_pos, run_texts)
    else:
        _add_plain(text, steps, run_pos, run_texts)
    return MaskedSegment(steps=tuple(steps), run_texts=tuple(run_texts))


def reassemble_masked(
    steps: Sequence[MaskStep], run_translations: Sequence[str]
) -> str:
    """Restore literals and protected terms verbatim; runs receive their
    translations in first-occurrence order, wrapped in the original
    whitespace."""
    parts: list[str] = []
    run_index = 0
    translation_by_core: dict[str, str] = {}
    for step in steps:
        if step.kind != "run":
            parts.append(step.text)
            continue
        if step.text not in translation_by_core:
            translation_by_core[step.text] = run_translations[run_index]
            run_index += 1
        parts.append(f"{step.pre}{translation_by_core[step.text]}{step.post}")
    return "".join(parts)
