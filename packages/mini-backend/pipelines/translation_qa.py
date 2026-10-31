"""Translation QA — pure detectors, deterministic echo collapse.

Findings are NOTES for the editor ("NT: " prefix per the parsing
convention), never rewrites and never failures — the only rewrite is the
deterministic echo collapse, adopted solely when the candidate re-passes the
same detectors that accused the original. SFX mode skips the heuristic
detectors (2/4/5) and, with them, the echo repair (its acceptance re-checks
detector 4); the empty/residue detectors stay mode-independent.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
import re
import unicodedata

from core.config import GlossaryTerm

_WS_RUN_RE = re.compile(r"\s+")
_WORD_RE = re.compile(r"[^\W\d_]+", re.UNICODE)
_NON_SPACE_RE = re.compile(r"\S+")
# CJK kana/Han and Hangul runs of 2+ characters (untranslated source residue).
_CJK_HANGUL_RUN_RE = re.compile(
    "[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]{2,}"
)

_CJK_SCRIPT_TAGS = frozenset({"CJK", "HIRAGANA", "KATAKANA", "HANGUL"})

NOTE_ECHO_REPAIRED = "NT: Eco do modelo reparado (colapso de duplicatas)"

# EN contractions — a source repeating "I'm ... I'm" tokenizes below the
# repetition cut, hiding its own repetition behind an honest-looking target.
# Closed table (straight and typographic apostrophes); the four specific
# forms precede the generic n't for their semantic expansion shape.
_EN_CONTRACTIONS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bwon['’]t\b", re.IGNORECASE), "will not"),
    (re.compile(r"\bcan['’]t\b", re.IGNORECASE), "can not"),
    (re.compile(r"\bain['’]t\b", re.IGNORECASE), "is not"),
    (re.compile(r"\bshan['’]t\b", re.IGNORECASE), "shall not"),
    (re.compile(r"n['’]t\b", re.IGNORECASE), " not"),
    (re.compile(r"\blet['’]s\b", re.IGNORECASE), "let us"),
    (re.compile(r"\b(i|you|we|they)['’]re\b", re.IGNORECASE), r"\1 are"),
    (re.compile(r"\b(he|she|it|that|this|what|who|there|here)['’]s\b", re.IGNORECASE), r"\1 is"),
    (re.compile(r"\b(i|you|we|they|he|she|it|that|this|what|who|there|here)['’]ve\b", re.IGNORECASE), r"\1 have"),
    (re.compile(r"\b(i|you|we|they|he|she|it|that|this|what|who|there|here)['’]ll\b", re.IGNORECASE), r"\1 will"),
    (re.compile(r"\b(i|you|we|they|he|she|it|that|this|what|who|there|here)['’]d\b", re.IGNORECASE), r"\1 would"),
    (re.compile(r"\bi['’]m\b", re.IGNORECASE), "i am"),
)

# Function words (EN + PT-BR, stored WITHOUT diacritics) whose repetition in
# the target is honest grammar — "Não, não estou...", "por que ... sabem
# que". Lexical verbs and 'sim' ("Sim, sim." is the echo signature) stay out.
_FUNCTION_WORDS = frozenset(
    {
        # EN
        "a", "an", "the", "and", "or", "but", "if", "of", "to", "in", "on",
        "at", "by", "for", "with", "from", "as", "is", "are", "was", "were",
        "be", "been", "being", "am", "do", "does", "did", "have", "has",
        "had", "will", "would", "can", "could", "shall", "should", "may",
        "might", "must", "not", "no", "it", "its", "this", "that", "these",
        "those", "i", "you", "we", "they", "he", "she", "him", "her", "them",
        "his", "her", "their", "our", "your", "my", "me", "us", "who",
        "what", "which", "there", "here", "when", "then", "than", "so",
        "very", "just", "now",
        # PT-BR (unaccented)
        "o", "a", "os", "as", "um", "uma", "uns", "umas", "de", "do", "da",
        "dos", "das", "em", "no", "na", "nos", "nas", "ao", "aos", "pelo",
        "pela", "que", "nao", "se", "e", "ou", "mas", "para", "por", "com",
        "sem", "sobre", "entre", "como", "quando", "onde", "quem", "qual",
        "ele", "ela", "eles", "elas", "voce", "voces", "eu", "nos", "meu",
        "minha", "seu", "sua", "nosso", "nossa", "este", "esta", "esse",
        "essa", "isso", "isto", "aquilo", "ja", "tambem", "mais", "menos",
        "muito", "muita", "pouco", "pouca", "bem", "mal", "aqui", "ali",
        "la", "hoje", "ainda", "tudo", "toda", "todo", "cada",
    }
)


@dataclass(frozen=True)
class QAOutcome:
    text: str
    flags: frozenset[str]
    notes: tuple[str, ...]
    repaired: bool


def scripts_de(text: str) -> frozenset[str]:
    """Script tags (first word of the Unicode name) of the text's letters."""
    tags: set[str] = set()
    for ch in text:
        if ch.isalpha():
            tags.add(unicodedata.name(ch).split()[0])
    return frozenset(tags)


def _fold_for_identity(text: str) -> str:
    """Comparable identity form: NFKC, casefold, collapsed whitespace."""
    return _WS_RUN_RE.sub(" ", unicodedata.normalize("NFKC", text).casefold()).strip()


def _expand_en_contractions(text: str) -> str:
    for pattern, replacement in _EN_CONTRACTIONS:
        text = pattern.sub(replacement, text)
    return text


def _strip_accents(word: str) -> str:
    return "".join(
        ch
        for ch in unicodedata.normalize("NFKD", word)
        if not unicodedata.combining(ch)
    )


def _repeated_words(text: str, min_length: int) -> set[str]:
    counts = Counter(w.casefold() for w in _WORD_RE.findall(text))
    return {w for w, n in counts.items() if n >= 2 and len(w) >= min_length}


def repeated_word_echo(source: str, target: str) -> str | None:
    """A content word (>= 3 letters) repeated >= 2x in the target while the
    source repeats nothing — the model-echo signature on short UI strings.

    Exemptions: the source's own repetition is checked with EN contractions
    expanded; a repetition made only of EN/PT function words is honest
    grammar; and the degenerate all-echo target (the repeated word is the
    only >= 3-letter word) is still reported so the collapse can cure it.
    """
    if not target or source == target:
        return None
    if _repeated_words(_expand_en_contractions(source), 2):
        return None
    repeated = _repeated_words(target, 3)
    content = {w for w in repeated if _strip_accents(w) not in _FUNCTION_WORDS}
    if content:
        return min(content)
    forms = Counter(
        _strip_accents(w.casefold())
        for w in _WORD_RE.findall(target)
        if len(w) >= 3
    )
    if len(forms) == 1 and next(iter(forms.values())) >= 2:
        return next(iter(forms))
    return None


def foreign_residue(target: str, target_language: str) -> str | None:
    """CJK/Hangul run (>= 2 chars) surviving in a non-CJK/Hangul target."""
    prefix = target_language.strip().lower().split("-")[0]
    if prefix in {"ja", "zh", "ko"}:
        return None
    match = _CJK_HANGUL_RUN_RE.search(target)
    return match.group(0) if match else None


def _length_ratio_bounds(
    source: str, target: str
) -> tuple[float, float] | None:
    """Pair-aware bounds: CJK->latin is generous, latin->latin is tight;
    any other script pair is not judged."""
    source_scripts = scripts_de(source)
    target_scripts = scripts_de(target)
    if "LATIN" not in target_scripts:
        return None
    if source_scripts & _CJK_SCRIPT_TAGS:
        return (0.25, 5.0)
    if source_scripts and source_scripts <= {"LATIN"}:
        return (0.58, 3.2)
    return None


def length_ratio_flag(source: str, target: str) -> float | None:
    """Ratio outside the pair bounds, or None (includes the len >= 8 gate)."""
    if len(source) < 8:
        return None
    bounds = _length_ratio_bounds(source, target)
    if bounds is None:
        return None
    ratio = len(target) / len(source)
    minimum, maximum = bounds
    if minimum <= ratio <= maximum:
        return None
    return ratio


def _identical_to_source(source: str, target: str) -> bool:
    """The target is the source re-encoded in another script (fullwidth vs
    ASCII) — text-wise the same string, so nothing was translated. Plain
    same-script copies are NOT this detector's scope: the script sets are
    equal there and the TM write policy compares text directly instead."""
    if not source or not target:
        return False
    if not any(ch.isalpha() for ch in source):
        return False
    if scripts_de(source) == scripts_de(target):
        return False
    return _fold_for_identity(source) == _fold_for_identity(target)


def glossary_missing(
    source: str, target: str, terms: Sequence[GlossaryTerm]
) -> list[str]:
    """Mandatory-term post-check, notes only: a glossary term whose source
    occurs in the source (case-insensitive, word-bounded) but whose expected
    target is absent from the output. Never-translate terms are excluded —
    their presence is proven by masking parity, not by the output text."""
    notes: list[str] = []
    for term in terms:
        if term.never_translate or not term.source or not term.target:
            continue
        source_pattern = re.compile(
            rf"(?<!\w){re.escape(term.source)}(?!\w)", re.IGNORECASE
        )
        target_pattern = re.compile(
            rf"(?<!\w){re.escape(term.target)}(?!\w)", re.IGNORECASE
        )
        if source_pattern.search(source) and not target_pattern.search(target):
            notes.append(
                f"NT: Glossário: termo '{term.source}' ausente"
                f" (esperado '{term.target}')"
            )
    return notes


# --------------------------------------------------------------------- echo


def _keep_xx(tokens: list[str]) -> list[int] | None:
    """R1 — exact X+X: even count, first half == second half in casefold."""
    n = len(tokens)
    if n == 0 or n % 2:
        return None
    half = n // 2
    if all(
        tokens[i].casefold() == tokens[i + half].casefold() for i in range(half)
    ):
        return list(range(half))
    return None


def _keep_collapsed(tokens: list[str]) -> list[int] | None:
    """R2 — one pass collapsing adjacent casefold-equal alpha-only tokens."""
    keep: list[int] = []
    for i, tok in enumerate(tokens):
        if (
            keep
            and any(c.isalpha() for c in tok)
            and tokens[keep[-1]].casefold() == tok.casefold()
        ):
            continue
        keep.append(i)
    return keep if len(keep) < len(tokens) else None


def _render(target: str, spans: Sequence[tuple[int, int]], keep: list[int]) -> str:
    """Rebuild the target keeping `keep` tokens with their ORIGINAL leading
    separators and the target's own lead/trail whitespace."""
    parts = [target[: spans[0][0]], target[spans[keep[0]][0] : spans[keep[0]][1]]]
    for k in keep[1:]:
        parts.append(target[spans[k - 1][1] : spans[k][0]])
        parts.append(target[spans[k][0] : spans[k][1]])
    parts.append(target[spans[-1][1] :])
    return "".join(parts)


def repair_echo(source: str, target: str, target_language: str) -> str | None:
    """Echo-free candidate for (source, target), or None when no repair is
    trustworthy. R1 then R2; the candidate must be non-empty, differ from the
    source, and re-run clean on the empty/residue/repetition detectors."""
    if repeated_word_echo(source, target) is None:
        return None
    spans = [m.span() for m in _NON_SPACE_RE.finditer(target)]
    if not spans:
        return None
    tokens = [target[start:end] for start, end in spans]
    for keep in (_keep_xx(tokens), _keep_collapsed(tokens)):
        if keep is None:
            continue
        candidate = _render(target, spans, keep)
        if not candidate.strip() or candidate == source:
            continue
        if repeated_word_echo(source, candidate) is not None:
            continue
        if foreign_residue(candidate, target_language) is not None:
            continue
        return candidate
    return None


# ------------------------------------------------------------------- public


def run_translation_qa(
    source: str,
    target: str,
    *,
    target_language: str,
    translation_mode: str,
) -> QAOutcome:
    """Detectors + deterministic echo collapse for one (source, target) pair.

    The source side of every check is script-derived (not language-code
    derived), so an ``auto`` source language works unchanged."""
    sfx = translation_mode.strip().lower() == "sfx"
    flags: set[str] = set()
    notes: list[str] = []
    repaired = False
    text = target

    if not sfx and repeated_word_echo(source, text) is not None:
        candidate = repair_echo(source, text, target_language)
        if candidate is not None:
            text = candidate
            repaired = True
            notes.append(NOTE_ECHO_REPAIRED)

    if not text.strip() and source.strip():
        flags.add("empty")
        notes.append("NT: Tradução vazia para uma fala de origem não vazia.")

    if not sfx and _identical_to_source(source, text):
        flags.add("identical")
        notes.append("NT: Saída igual à origem trocando apenas a escrita (nada foi traduzido).")

    residue = foreign_residue(text, target_language)
    if residue is not None:
        flags.add("foreign_residue")
        notes.append(f"NT: Resíduo do idioma de origem na tradução: '{residue}'.")

    if not sfx:
        echo = None if repaired else repeated_word_echo(source, text)
        if echo is not None:
            flags.add("repeated_word")
            notes.append(f"NT: Possível eco do modelo: '{echo}' repetido.")
        ratio = length_ratio_flag(source, text)
        if ratio is not None:
            flags.add("length_ratio")
            notes.append(f"NT: Comprimento suspeito ({ratio:.2f}x o original).")

    return QAOutcome(
        text=text,
        flags=frozenset(flags),
        notes=tuple(notes),
        repaired=repaired,
    )
