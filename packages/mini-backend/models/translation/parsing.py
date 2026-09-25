from __future__ import annotations

import json
import re
from typing import Any

from models.translation.base_translator import TranslationInputRegion


def _strip_markdown_code_fence(text: str) -> str:
    cleaned = (text or "").strip()
    if not cleaned.startswith("```"):
        return cleaned
    lines = cleaned.splitlines()
    if len(lines) <= 2:
        return cleaned.strip("`").strip()
    if lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def _extract_json_payload(raw_text: str) -> Any:
    cleaned = _strip_markdown_code_fence(raw_text)
    if not cleaned:
        return {}
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    for start_token, end_token in (("{", "}"), ("[", "]")):
        start = cleaned.find(start_token)
        end = cleaned.rfind(end_token)
        if start < 0 or end < 0 or end <= start:
            continue
        candidate = cleaned[start : end + 1]
        try:
            return json.loads(candidate)
        except Exception:
            continue
    return {}


def _normalize_translation_note(note: Any) -> str:
    normalized = str(note or "").strip()
    if not normalized:
        return ""
    if normalized.startswith("(") and normalized.endswith(")"):
        normalized = normalized[1:-1].strip()
    normalized = re.sub(r"^N\s*/\s*T\s*:\s*", "NT: ", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"^NT\s*:\s*", "NT: ", normalized, flags=re.IGNORECASE)
    if not normalized.lower().startswith("nt:"):
        normalized = f"NT: {normalized}"
    return normalized.strip()


def _dedupe_translation_notes(notes: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for note in notes:
        normalized = _normalize_translation_note(note)
        if not normalized:
            continue
        key = normalized.casefold()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(normalized)
    return deduped


def _extract_inline_translation_notes(text: str) -> tuple[str, list[str]]:
    cleaned = str(text or "").strip()
    if not cleaned:
        return "", []

    notes: list[str] = []

    def replace_parenthetical(match: re.Match[str]) -> str:
        notes.append(_normalize_translation_note(match.group(2)))
        return " "

    cleaned = re.sub(
        r"\(\s*(N\s*/\s*T|NT)\s*:\s*(.*?)\s*\)",
        lambda match: replace_parenthetical(match),
        cleaned,
        flags=re.IGNORECASE,
    )

    trailing_pattern = re.compile(
        r"(?:^|\s)(N\s*/\s*T|NT)\s*:\s*(.+?)(?=(?:\s+(?:N\s*/\s*T|NT)\s*:)|$)",
        re.IGNORECASE,
    )
    while True:
        match = trailing_pattern.search(cleaned)
        if not match:
            break
        notes.append(_normalize_translation_note(match.group(2)))
        cleaned = f"{cleaned[: match.start()]} {cleaned[match.end() :]}".strip()

    remaining_lines: list[str] = []
    for line in cleaned.splitlines():
        stripped = line.strip()
        if re.match(r"^(?:N\s*/\s*T|NT)\s*:", stripped, flags=re.IGNORECASE):
            notes.append(_normalize_translation_note(stripped))
            continue
        remaining_lines.append(line)

    normalized_text = re.sub(r"\s{2,}", " ", "\n".join(remaining_lines)).strip()
    return normalized_text, _dedupe_translation_notes(notes)


def _coerce_translation_notes(value: Any) -> list[str]:
    if isinstance(value, list):
        return _dedupe_translation_notes([str(item or "") for item in value])
    if isinstance(value, str):
        return _dedupe_translation_notes([value])
    return []


def _translation_payload(text: Any, notes: Any = None) -> dict[str, Any]:
    cleaned_text, inline_notes = _extract_inline_translation_notes(str(text or ""))
    return {
        "text": cleaned_text,
        "notes": _dedupe_translation_notes(
            [*_coerce_translation_notes(notes), *inline_notes]
        ),
    }


def _coalesce(mapping: dict[str, Any], keys: tuple[str, ...]) -> Any:
    """Exact equivalent of ``m.get(k0) or m.get(k1) or ... or m.get(kN)``.

    Returns the first truthy value, otherwise the *last* key's value — which may
    be None, "" or []. The ``is not None`` checks in the single-region paths
    depend on that last-value quirk (``{"nt": ""}`` is "present"), so do NOT
    simplify this to "first truthy or None".
    """
    value: Any = None
    for key in keys:
        value = mapping.get(key)
        if value:
            return value
    return value


_ITEM_TEXT_KEYS = ("text", "translated_text", "translation")
_DIRECT_TEXT_KEYS = ("text", "translated_text", "translation", "translated", "output")
_NOTES_KEYS = ("notes", "translation_notes", "note", "nt")
_NOTES_FALLBACK_KEYS = _NOTES_KEYS[1:]


def _item_notes(item: dict[str, Any]) -> Any:
    # List-item semantics: an explicit ``"notes": []`` wins over fallbacks.
    # (Differs from the single-region paths, which use a pure ``or`` chain.)
    notes = item.get("notes")
    if notes is None:
        notes = _coalesce(item, _NOTES_FALLBACK_KEYS)
    return notes


def _translation_list(parsed: dict[str, Any]) -> list[Any] | None:
    candidate: Any = parsed.get("translations")
    if not isinstance(candidate, list):
        candidate = parsed.get("items")
    return candidate if isinstance(candidate, list) else None


def _collect_id_items(items: list[Any], mapping: dict[str, dict[str, Any]]) -> None:
    for item in items:
        if not isinstance(item, dict):
            continue
        region_id = str(item.get("id") or "").strip()
        translated = _coalesce(item, _ITEM_TEXT_KEYS) or ""
        notes = _item_notes(item)
        if region_id:
            mapping[region_id] = _translation_payload(translated, notes)


def _extract_single_region_translation_payload(
    value: Any, notes: Any = None, depth: int = 0
) -> dict[str, Any]:
    if depth >= 2:
        return _translation_payload(value, notes)

    translated = str(value or "").strip()
    if not translated:
        return _translation_payload("", notes)

    cleaned = _strip_markdown_code_fence(translated)
    nested = _extract_json_payload(cleaned)
    if isinstance(nested, dict) and nested:
        items = _translation_list(nested)
        if items and isinstance(items[0], dict):
            first_item = items[0]
            return _extract_single_region_translation_payload(
                _coalesce(first_item, _ITEM_TEXT_KEYS) or "",
                _coalesce(first_item, _NOTES_KEYS),
                depth + 1,
            )
        direct_translation = _coalesce(nested, _DIRECT_TEXT_KEYS)
        nested_notes = _coalesce(nested, _NOTES_KEYS)
        if direct_translation is not None or nested_notes is not None:
            return _extract_single_region_translation_payload(
                direct_translation or "",
                nested_notes if nested_notes is not None else notes,
                depth + 1,
            )

    return _translation_payload(value, notes)


def _parse_llm_translation_map(
    raw_text: str,
    regions: list[TranslationInputRegion],
) -> dict[str, dict[str, Any]]:
    parsed = _extract_json_payload(raw_text)
    mapping: dict[str, dict[str, Any]] = {}
    single_region_id = regions[0].id if len(regions) == 1 else None

    if isinstance(parsed, dict):
        candidate_list = _translation_list(parsed)
        if candidate_list is not None:
            _collect_id_items(candidate_list, mapping)
        elif single_region_id is not None:
            direct_translation = _coalesce(parsed, _DIRECT_TEXT_KEYS)
            direct_notes = _coalesce(parsed, _NOTES_KEYS)
            if direct_translation is not None or direct_notes is not None:
                mapping[single_region_id] = _extract_single_region_translation_payload(
                    direct_translation or "", direct_notes
                )
        elif parsed and all(isinstance(v, str) for v in parsed.values()):
            for key, value in parsed.items():
                mapping[str(key)] = _translation_payload(value)
    elif isinstance(parsed, list):
        _collect_id_items(parsed, mapping)

    # unchanged tail ------------------------------------------------------
    if not mapping and isinstance(parsed, list) and len(parsed) == len(regions):
        for idx, item in enumerate(parsed):
            if idx >= len(regions):
                break
            mapping[regions[idx].id] = _translation_payload(item)

    if not mapping and len(regions) == 1:
        mapping[regions[0].id] = _extract_single_region_translation_payload(raw_text)

    return mapping


def dedupe_translation_notes_across_regions(
    mapping: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    seen: set[str] = set()
    deduped_mapping: dict[str, dict[str, Any]] = {}
    for region_id, payload in mapping.items():
        notes: list[str] = []
        for note in list(payload.get("notes") or []):
            normalized = _normalize_translation_note(note)
            key = normalized.casefold()
            if not normalized or key in seen:
                continue
            seen.add(key)
            notes.append(normalized)
        deduped_mapping[region_id] = {
            "text": str(payload.get("text") or "").strip(),
            "notes": notes,
        }
    return deduped_mapping


# --- provider wire-format → raw text ------------------------------------
# Return None where the original engine short-circuited with ``return {}``
# *before* calling _parse_llm_translation_map (OpenAI: no choices; Gemini: no
# candidates). Claude/Ollama never short-circuited, so they always return str.

def extract_openai_chat_text(response: Any) -> str | None:
    choices = response.get("choices", []) if isinstance(response, dict) else []
    if not isinstance(choices, list) or not choices:
        return None
    first = choices[0] if isinstance(choices[0], dict) else {}
    message = first.get("message", {}) if isinstance(first, dict) else {}
    content = message.get("content", "") if isinstance(message, dict) else ""
    if isinstance(content, list):
        text_parts = [
            str(item.get("text") or "") for item in content if isinstance(item, dict)
        ]
        return "\n".join(part for part in text_parts if part).strip()
    return str(content or "").strip()


def extract_gemini_text(response: Any) -> str | None:
    candidates = response.get("candidates", []) if isinstance(response, dict) else []
    if not isinstance(candidates, list) or not candidates:
        return None
    first = candidates[0] if isinstance(candidates[0], dict) else {}
    content = first.get("content", {}) if isinstance(first, dict) else {}
    parts = content.get("parts", []) if isinstance(content, dict) else []
    if not isinstance(parts, list):
        return ""
    return "\n".join(
        str(item.get("text") or "")
        for item in parts
        if isinstance(item, dict) and item.get("text")
    ).strip()


def extract_claude_text(response: Any) -> str:
    content = response.get("content", []) if isinstance(response, dict) else []
    if not isinstance(content, list):
        return ""
    text_parts = [
        str(item.get("text") or "")
        for item in content
        if isinstance(item, dict) and item.get("type") == "text"
    ]
    return "\n".join(part for part in text_parts if part).strip()


def extract_ollama_text(response: Any) -> str:
    message = response.get("message", {}) if isinstance(response, dict) else {}
    if isinstance(message, dict):
        return str(message.get("content") or response.get("response") or "").strip()
    return str(response.get("response") or "").strip()
