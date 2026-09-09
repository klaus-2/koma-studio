from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
import os
import re
from typing import Any
from urllib import parse

import httpx

from core.languages import get_language_label, is_no_space_lang, normalize_language_code
from models.translation.base_translator import (
    BaseTranslator,
    TranslationInputRegion,
    TranslationTextResult,
)


_HUGGINGFACE_ROUTER_API_BASE = "https://router.huggingface.co/v1"

logger = logging.getLogger(__name__)


def _first_env(*names: str, default: str = "") -> str:
    for name in names:
        value = (os.getenv(name) or "").strip()
        if value:
            return value
    return default


def _extract_huggingface_model_from_legacy_api_base(api_base: str) -> str | None:
    from urllib.parse import urlparse

    parsed = urlparse(api_base)
    if (parsed.hostname or "").strip().lower() != "api-inference.huggingface.co":
        return None
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) < 4 or parts[0] != "models":
        return None
    try:
        v1_index = parts.index("v1")
    except ValueError:
        return None
    repo_parts = parts[1:v1_index]
    if not repo_parts:
        return None
    return "/".join(repo_parts)


def _normalize_openai_compatible_api_base(api_base: str) -> str:
    normalized = str(api_base or "").strip().rstrip("/")
    if _extract_huggingface_model_from_legacy_api_base(normalized):
        return _HUGGINGFACE_ROUTER_API_BASE
    return normalized


def _resolve_openai_compatible_chat_url(api_base: str) -> str:
    normalized = _normalize_openai_compatible_api_base(api_base)
    if normalized.lower().endswith("/chat/completions"):
        return normalized
    return f"{normalized}/chat/completions"


def _is_ollama_cloud_host(api_base: str) -> bool:
    hostname = (parse.urlparse(api_base).hostname or "").strip().lower()
    return hostname in {"ollama.com", "api.ollama.com"}


def _resolve_ollama_chat_url(api_base: str) -> str:
    normalized = str(api_base or "").strip().rstrip("/")
    if normalized.lower().endswith("/api/chat"):
        return normalized
    if normalized.lower().endswith("/api"):
        return f"{normalized}/chat"
    return f"{normalized}/api/chat"


def _is_loopback_host(hostname: str) -> bool:
    host = str(hostname or "").strip().lower()
    if host in {"localhost", "::1"}:
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def _is_private_or_internal_host(hostname: str) -> bool:
    host = str(hostname or "").strip().lower()
    if not host:
        return True
    if host.endswith(".local") or host.endswith(".internal"):
        return True
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return (
        ip.is_private
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def resolve_request_custom_openai_config(
    custom_llm: dict[str, Any] | None,
) -> dict[str, str]:
    payload = custom_llm or {}
    api_key = str(payload.get("api_key") or payload.get("apiKey") or "").strip()
    api_base = str(
        payload.get("api_base")
        or payload.get("apiBase")
        or payload.get("base_url")
        or payload.get("baseUrl")
        or ""
    ).strip()
    model = str(payload.get("model") or "").strip()

    if not api_base or not model:
        raise RuntimeError("Custom AI requires api_base and model.")

    parsed = parse.urlparse(api_base)
    if parsed.scheme not in {"http", "https"}:
        raise RuntimeError("Custom AI requires an http:// or https:// URL.")
    if not parsed.hostname:
        raise RuntimeError("Invalid host for Custom AI.")
    if parsed.username or parsed.password:
        raise RuntimeError(
            "Credentials embedded in the Custom AI URL are not allowed."
        )

    hostname = (parsed.hostname or "").strip().lower()
    if _is_loopback_host(hostname):
        normalized_loopback = parsed._replace(
            params="", query="", fragment="", path=(parsed.path or "").rstrip("/")
        )
        return {
            "api_key": api_key,
            "api_base": parse.urlunparse(normalized_loopback),
            "model": model,
        }

    if _is_private_or_internal_host(hostname):
        raise RuntimeError(
            "Private/internal hosts are not allowed for local Custom AI. Use loopback (localhost/127.0.0.1/::1)."
        )
    if parsed.scheme != "https":
        raise RuntimeError("Remote Custom AI requires HTTPS.")

    normalized_remote = parsed._replace(
        params="", query="", fragment="", path=(parsed.path or "").rstrip("/")
    )
    return {
        "api_key": api_key,
        "api_base": parse.urlunparse(normalized_remote),
        "model": model,
    }


def _normalize_language_code(language: str) -> str:
    return normalize_language_code(language, default="auto", allow_auto=True)


def _google_lang(language: str) -> str:
    lang = _normalize_language_code(language).lower()
    if lang in {"auto", ""}:
        return "auto"
    if lang == "pt-br":
        return "pt"
    if lang == "zh":
        return "zh-CN"
    if lang == "zh-cn":
        return "zh-CN"
    if lang == "zh-tw":
        return "zh-TW"
    return lang


def _microsoft_source_lang(language: str) -> str:
    lang = _normalize_language_code(language).lower()
    if lang in {"auto", ""}:
        return ""
    if lang == "zh":
        return "zh-Hans"
    if lang == "zh-cn":
        return "zh-Hans"
    if lang == "zh-tw":
        return "zh-Hant"
    return lang


def _microsoft_target_lang(language: str) -> str:
    lang = normalize_language_code(language, default="en", allow_auto=False).lower()
    if lang == "zh":
        return "zh-Hans"
    if lang == "zh-cn":
        return "zh-Hans"
    if lang == "zh-tw":
        return "zh-Hant"
    if lang == "pt":
        return "pt-pt"
    if lang == "pt-br":
        return "pt"
    return lang


def _yandex_source_lang(language: str) -> str:
    lang = _normalize_language_code(language).lower()
    if lang in {"auto", ""}:
        return ""
    if lang in {"zh-cn", "zh-tw"}:
        return "zh"
    return lang


def _yandex_target_lang(language: str) -> str:
    lang = normalize_language_code(language, default="en", allow_auto=False).lower()
    if lang in {"zh", "zh-cn", "zh-tw"}:
        return "zh"
    if lang == "pt-br":
        return "pt-BR"
    return lang


def _deepl_source_lang(language: str) -> str:
    lang = _normalize_language_code(language).lower()
    if lang in {"auto", ""}:
        return ""
    if lang.startswith("zh"):
        return "ZH"
    if lang == "pt-br":
        return "PT-BR"
    return lang.upper()


def _deepl_target_lang(language: str) -> str:
    lang = normalize_language_code(language, default="en", allow_auto=False).lower()
    if lang == "pt-br":
        return "PT-BR"
    if lang == "pt":
        return "PT-PT"
    if lang == "zh-cn" or lang == "zh":
        return "ZH-HANS"
    if lang == "zh-tw":
        return "ZH-HANT"
    if lang == "en":
        return "EN-US"
    return lang.upper()


async def _http_json_post(
    url: str,
    payload: dict[str, Any] | list[dict[str, str]],
    headers: dict[str, str] | None = None,
    timeout: int = 35,
    max_retries: int = 3,
) -> Any:
    body = json.dumps(payload).encode("utf-8")
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response: httpx.Response | None = None
        for attempt in range(max_retries):
            response = await client.post(url, headers=req_headers, content=body)
            if response.status_code != 429 or attempt == max_retries - 1:
                break
            retry_after = response.headers.get("retry-after")
            try:
                retry_delay = (
                    max(1.0, min(10.0, float(retry_after)))
                    if retry_after
                    else float(attempt + 1)
                )
            except (TypeError, ValueError):
                retry_delay = float(attempt + 1)
            await asyncio.sleep(retry_delay)

        assert response is not None
        response.raise_for_status()
        return response.json()


async def _http_form_post(
    url: str,
    fields: dict[str, Any],
    headers: dict[str, str] | None = None,
    timeout: int = 35,
    max_retries: int = 3,
) -> Any:
    req_headers: dict[str, str] = {}
    if headers:
        req_headers.update(headers)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response: httpx.Response | None = None
        for attempt in range(max_retries):
            response = await client.post(url, headers=req_headers, data=fields)
            if response.status_code != 429 or attempt == max_retries - 1:
                break
            retry_after = response.headers.get("retry-after")
            try:
                retry_delay = (
                    max(1.0, min(10.0, float(retry_after)))
                    if retry_after
                    else float(attempt + 1)
                )
            except (TypeError, ValueError):
                retry_delay = float(attempt + 1)
            await asyncio.sleep(retry_delay)

        assert response is not None
        response.raise_for_status()
        return response.json()


async def _http_get_json(
    url: str,
    headers: dict[str, str] | None = None,
    timeout: int = 20,
) -> Any:
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.json()


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


def _language_label(language: str, *, allow_auto: bool) -> str:
    normalized = normalize_language_code(
        language, default="auto" if allow_auto else "en", allow_auto=allow_auto
    )
    if normalized == "auto":
        return "the detected source language"
    return get_language_label(normalized)


def _notes_mode_instruction(
    target_language: str, translation_notes_enabled: bool
) -> str:
    if translation_notes_enabled:
        return (
            f"Translator notes are enabled for this request. When extra context would materially help readers of "
            f"{_language_label(target_language, allow_auto=False)}, include concise notes in the `notes` array."
        )
    return "Translator notes are disabled for this request. Always return an empty `notes` array."


def _money_notes_instruction(target_language: str) -> str:
    target_label = _language_label(target_language, allow_auto=False)
    normalized = normalize_language_code(
        target_language, default="en", allow_auto=False
    )
    if normalized == "pt-br":
        return f"If the target language is {target_label}, include an approximate BRL conversion when it materially helps comprehension."
    return (
        f"If the target language is {target_label}, include a concise reader-friendly currency conversion or value-context note "
        "when it materially helps comprehension."
    )


def _llm_system_prompt(
    source_language: str,
    target_language: str,
    translation_notes_enabled: bool,
    translation_mode: str = "default",
) -> str:
    if str(translation_mode or "").strip().lower() == "sfx":
        source_label = _language_label(source_language, allow_auto=True)
        target_label = _language_label(target_language, allow_auto=False)
        return (
            f"You are a specialist sound-effect translator for manga, manhwa, and comics adapting SFX into natural {target_label}.\n\n"
            "CRITICAL RULES:\n"
            "1. Translate only as a comic sound effect / onomatopoeia, never as normal dialogue.\n"
            "2. Preserve impact, rhythm, intensity, and intent.\n"
            "3. Prefer short, renderable, comic-style equivalents over literal phrasing.\n"
            "4. Never output translator notes. Always return an empty notes array.\n"
            "5. Return JSON with this exact shape:\n"
            '{"translations":[{"id":"<id>","text":"<translated_sfx>","notes":[]}]}'
            "\n6. Never place notes or explanations inside text.\n\n"
            f"Source language context: {source_label}.\n"
            f"Target language: {target_label}.\n"
        )

    source_label = _language_label(source_language, allow_auto=True)
    target_label = _language_label(target_language, allow_auto=False)
    return (
        f"You are a specialist translator of Asian comics (manga, manhwa, webtoons) working for a scanlation team "
        f"that publishes in {target_label}. Your job is to translate and adapt the provided text into natural, fluent "
        f"{target_label}, while preserving the original work's cultural integrity, narrative intent, and tone. The "
        f"translation must be accurate, but it must also read like genuine dialogue for readers of {target_label}.\n\n"
        "CRITICAL AND NON-NEGOTIABLE RULES:\n\n"
        "1. Preserve cultural integrity. Do not over-localize.\n"
        "- Proper names of characters, clans, families, techniques, organizations, and places must never be translated or replaced.\n"
        "- Titles, offices, and roles must be translated accurately without relocating them to the reader's country or culture.\n"
        "- City, province, district, street, and country names must remain in their original or standard transliterated form.\n"
        "- Never replace the original currency with a local one. Keep the original currency name in the translation.\n\n"
        "2. Handle OCR noise intelligently.\n"
        "- The source text may contain OCR mistakes, typos, broken spacing, or malformed punctuation.\n"
        "- Infer the intended meaning when it is reasonably recoverable, but do not invent content.\n\n"
        "3. Keep the translation natural.\n"
        f"- Match the scene's tone, formality, humor, tension, and register for readers of {target_label}.\n"
        "- Adapt idioms and slang so they sound natural in the target language, while preserving the original intent.\n"
        "- If a direct adaptation would lose meaning, keep the source term and explain it in a translator note when notes are enabled.\n"
        "- Avoid stiff pronouns or unnatural literal phrasing when the line should sound conversational.\n"
        "- Use the current page balloon context and any neighbor page context to resolve subject, references, continuity, and tone when they are provided.\n"
        "- Do not repeat the same translator note in multiple balloons of the same response unless a later balloon adds genuinely new nuance.\n"
        "- Prefer placing a translator note only on the first balloon where it is actually necessary.\n\n"
        "4. Output format.\n"
        '- Return JSON with this exact shape:\n{"translations":[{"id":"<id>","text":"<translated_text>","notes":["NT: <note 1>","NT: <note 2>"]}]}\n'
        "- Never translate JSON keys.\n"
        "- Return exactly one item for each input item.\n"
        "- Never omit an input id.\n"
        "- The `text` field must contain only the final translated text.\n"
        "- Never place translator notes inside `text`.\n\n"
        "5. Translator notes.\n"
        f"- {_notes_mode_instruction(target_language, translation_notes_enabled)}\n"
        f"- Notes must be concise, useful, reader-facing, and written entirely in {target_label}.\n"
        "- Every note must start with `NT: `.\n"
        f"- Add notes only when they are genuinely relevant to the reader's understanding of the translated content, never for editor-facing commentary.\n"
        f"- Only add notes for cultural references, honorifics, wordplay, food, customs, historical references, social context, location context, or money that an average reader of {target_label} may miss.\n"
        "- Never add notes just to explain the literal meaning of a source-language word or phrase, basic emotions, obvious sound effects, OCR uncertainty, truncation, or generic paraphrases of the line.\n"
        "- Never add notes that explain what the editor already knows instead of what the reader needs to know.\n"
        "- Do not quote the original source-language text in notes unless it is strictly necessary to identify an honorific, cultural item, or wordplay.\n"
        "- For money:\n"
        f"- {_money_notes_instruction(target_language)}\n"
        "- Otherwise, prefer a short value-context note unless a precise local conversion would be misleading.\n\n"
        "6. Safety rules for weak input.\n"
        f"- If the text is already in {target_label}, keep it as is.\n"
        "- If the text is unreadable or genuine gibberish, return it as is and leave `notes` empty unless a minimal clarifying note is truly justified.\n\n"
        f"Source language context: {source_label}.\n\n"
        "FINAL INSTRUCTION:\n"
        "Translate the provided items following every rule above."
    )


def _llm_user_prompt(
    regions: list[TranslationInputRegion],
    extra_context: str,
    translation_notes_enabled: bool,
    translation_mode: str = "default",
) -> str:
    payload = []
    for region in regions:
        item = {"id": region.id, "text": (region.text or "").strip()}
        if str(translation_mode or "").strip().lower() == "sfx":
            item["detected_render_mode"] = region.detected_render_mode
            item["structural_type"] = region.structural_type
            item["sfx_requires_redraw"] = region.sfx_requires_redraw
        payload.append(item)
    context = (extra_context or "").strip()
    notes_allowed = (
        translation_notes_enabled
        and str(translation_mode or "").strip().lower() != "sfx"
    )
    if context:
        custom_prompt_note = (
            "If the custom instructions imply translator notes, keep them only in the `notes` array and never inside `text`."
            if notes_allowed
            else "Even if the custom instructions ask for notes, keep the `notes` array empty for this request."
        )
        if str(translation_mode or "").strip().lower() == "sfx":
            return (
                f"User custom instructions / context:\n{context}\n\n"
                f"{custom_prompt_note}\n\n"
                "Translate the following items as short comic sound effects and return JSON with this exact format:\n"
                '{"translations":[{"id":"<id>","text":"<translated_sfx>","notes":[]}]}'
                f"\n\nInput:\n{json.dumps(payload, ensure_ascii=False)}"
            )
        return (
            f"User custom instructions / context:\n{context}\n\n"
            f"{custom_prompt_note}\n\n"
            "Translate the following items and return JSON with this exact format:\n"
            '{"translations":[{"id":"<id>","text":"<translated_text>","notes":["NT: <note 1>"]}]}\n\n'
            f"Input:\n{json.dumps(payload, ensure_ascii=False)}"
        )
    if str(translation_mode or "").strip().lower() == "sfx":
        return (
            "Translate the following items as short comic sound effects and return JSON with this exact format:\n"
            '{"translations":[{"id":"<id>","text":"<translated_sfx>","notes":[]}]}'
            f"\n\nInput:\n{json.dumps(payload, ensure_ascii=False)}"
        )
    return (
        "Translate the following items and return JSON with this exact format:\n"
        '{"translations":[{"id":"<id>","text":"<translated_text>","notes":["NT: <note 1>"]}]}\n\n'
        f"Input:\n{json.dumps(payload, ensure_ascii=False)}"
    )


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


def _truncate_context_lines(
    lines: list[str], max_items: int, max_chars: int
) -> list[str]:
    truncated: list[str] = []
    total_chars = 0
    for line in lines[:max_items]:
        candidate = line.strip()
        if not candidate:
            continue
        if total_chars and total_chars + 1 + len(candidate) > max_chars:
            truncated.append("... [context truncated]")
            break
        truncated.append(candidate)
        total_chars += len(candidate) + 1
    return truncated


def build_current_image_translation_context(
    regions: list[TranslationInputRegion],
    *,
    max_items: int = 12,
    max_chars: int = 1200,
) -> str:
    useful_regions = [region for region in regions if str(region.text or "").strip()]
    if len(useful_regions) < 2:
        return ""

    lines = [
        f"- id={region.id} text={str(region.text or '').strip()}"
        for region in useful_regions
    ]
    truncated_lines = _truncate_context_lines(
        lines, max_items=max_items, max_chars=max_chars
    )
    if not truncated_lines:
        return ""
    return "Current page balloon context:\n" + "\n".join(truncated_lines)


def compose_translation_extra_context(
    user_extra_context: str,
    current_image_context: str,
    neighbor_context: str = "",
) -> str:
    blocks = [
        str(user_extra_context or "").strip(),
        str(current_image_context or "").strip(),
        str(neighbor_context or "").strip(),
    ]
    return "\n\n".join(block for block in blocks if block)


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
        items = nested.get("translations")
        if not isinstance(items, list):
            items = nested.get("items")
        if isinstance(items, list) and items and isinstance(items[0], dict):
            first_item = items[0]
            return _extract_single_region_translation_payload(
                first_item.get("text")
                or first_item.get("translated_text")
                or first_item.get("translation")
                or "",
                first_item.get("notes")
                or first_item.get("translation_notes")
                or first_item.get("note")
                or first_item.get("nt"),
                depth + 1,
            )
        direct_translation = (
            nested.get("text")
            or nested.get("translated_text")
            or nested.get("translation")
            or nested.get("translated")
            or nested.get("output")
        )
        nested_notes = (
            nested.get("notes")
            or nested.get("translation_notes")
            or nested.get("note")
            or nested.get("nt")
        )
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
        candidate_list: Any = parsed.get("translations")
        if not isinstance(candidate_list, list):
            candidate_list = parsed.get("items")
        if isinstance(candidate_list, list):
            for item in candidate_list:
                if not isinstance(item, dict):
                    continue
                region_id = str(item.get("id") or "").strip()
                translated = (
                    item.get("text")
                    or item.get("translated_text")
                    or item.get("translation")
                    or ""
                )
                notes = item.get("notes")
                if notes is None:
                    notes = (
                        item.get("translation_notes")
                        or item.get("note")
                        or item.get("nt")
                    )
                if region_id:
                    mapping[region_id] = _translation_payload(translated, notes)
        elif single_region_id is not None:
            direct_translation = (
                parsed.get("text")
                or parsed.get("translated_text")
                or parsed.get("translation")
                or parsed.get("translated")
                or parsed.get("output")
            )
            direct_notes = (
                parsed.get("notes")
                or parsed.get("translation_notes")
                or parsed.get("note")
                or parsed.get("nt")
            )
            if direct_translation is not None or direct_notes is not None:
                mapping[single_region_id] = _extract_single_region_translation_payload(
                    direct_translation or "", direct_notes
                )
        elif parsed and all(isinstance(v, str) for v in parsed.values()):
            for key, value in parsed.items():
                mapping[str(key)] = _translation_payload(value)
    elif isinstance(parsed, list):
        for item in parsed:
            if not isinstance(item, dict):
                continue
            region_id = str(item.get("id") or "").strip()
            translated = (
                item.get("text")
                or item.get("translated_text")
                or item.get("translation")
                or ""
            )
            notes = item.get("notes")
            if notes is None:
                notes = (
                    item.get("translation_notes") or item.get("note") or item.get("nt")
                )
            if region_id:
                mapping[region_id] = _translation_payload(translated, notes)

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


def _preprocess_translation_text(text: str, source_language: str) -> str:
    cleaned = str(text or "").replace("\r", "").replace("\n", "")
    if is_no_space_lang(source_language):
        cleaned = cleaned.replace(" ", "")
    return cleaned.strip()


def _preprocess_translation_regions(
    regions: list[TranslationInputRegion],
    source_language: str,
) -> list[TranslationInputRegion]:
    prepared: list[TranslationInputRegion] = []
    for region in regions:
        prepared.append(
            TranslationInputRegion(
                id=region.id,
                text=_preprocess_translation_text(region.text, source_language),
                source=region.source,
                detector_model_key=region.detector_model_key,
                ocr_model_key=region.ocr_model_key,
                detected_render_mode=region.detected_render_mode,
                structural_type=region.structural_type,
                sfx_requires_redraw=region.sfx_requires_redraw,
            ),
        )
    return prepared


def _empty_translation_results(
    regions: list[TranslationInputRegion],
    translator_key: str,
) -> list[TranslationTextResult]:
    return [
        TranslationTextResult(
            id=region.id,
            source_text=(region.text or "").strip(),
            translated_text="",
            source=region.source,
            detector_model_key=region.detector_model_key,
            ocr_model_key=region.ocr_model_key,
            translator_model_key=translator_key,
        )
        for region in regions
    ]


class GoogleTranslatorEngine(BaseTranslator):
    key = "google_translate"
    name = "Google Translate"

    @staticmethod
    async def _translate_text(
        text: str, source_language: str, target_language: str
    ) -> str:
        params = {
            "client": "gtx",
            "sl": _google_lang(source_language),
            "tl": _google_lang(target_language),
            "dt": "t",
            "q": text,
        }
        query = parse.urlencode(params)
        url = f"https://translate.googleapis.com/translate_a/single?{query}"

        # The free endpoint applies rate limit (429) in bursts — retry with
        # backoff; without this, regions silently come back empty.
        payload = None
        delays = (1.0, 2.0, 4.0, 8.0)
        for attempt, delay in enumerate(delays):
            try:
                payload = await _http_get_json(url)
                break
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code != 429 or attempt == len(delays) - 1:
                    raise
                await asyncio.sleep(delay)
            except httpx.HTTPError:
                if attempt == len(delays) - 1:
                    raise
                await asyncio.sleep(delay)

        if (
            not isinstance(payload, list)
            or not payload
            or not isinstance(payload[0], list)
        ):
            return ""
        parts: list[str] = []
        for item in payload[0]:
            if isinstance(item, list) and item:
                parts.append(str(item[0]))
        return "".join(parts).strip()

    async def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        _ = translation_mode
        results: list[TranslationTextResult] = []
        for index, region in enumerate(regions):
            source_text = (region.text or "").strip()
            translated = ""
            if source_text:
                if index:
                    await asyncio.sleep(0.3)
                try:
                    translated = await self._translate_text(
                        _preprocess_translation_text(source_text, source_language),
                        source_language,
                        target_language,
                    )
                except Exception as exc:
                    logger.warning(
                        "[translation] %s: region %s failed: %s: %s",
                        self.key,
                        region.id,
                        type(exc).__name__,
                        exc,
                    )
                    translated = ""
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=source_text,
                    translated_text=translated,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                ),
            )
        return results


class MicrosoftTranslatorEngine(BaseTranslator):
    key = "microsoft_translator"
    name = "Microsoft Translator"

    def __init__(self) -> None:
        self.api_key = (os.getenv("MINI_BACKEND_MS_TRANSLATOR_KEY") or "").strip()
        self.region = (os.getenv("MINI_BACKEND_MS_TRANSLATOR_REGION") or "").strip()
        self.endpoint = (
            os.getenv("MINI_BACKEND_MS_TRANSLATOR_ENDPOINT")
            or "https://api.cognitive.microsofttranslator.com"
        ).rstrip("/")

    async def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        _ = extra_context
        _ = translation_notes_enabled
        _ = translation_mode
        if not self.api_key or not self.region:
            raise RuntimeError(
                "Microsoft Translator requires MINI_BACKEND_MS_TRANSLATOR_KEY and MINI_BACKEND_MS_TRANSLATOR_REGION"
            )

        source = _microsoft_source_lang(source_language)
        target = _microsoft_target_lang(target_language)
        if not target:
            raise RuntimeError("Invalid target language for Microsoft Translator")

        non_empty: list[tuple[int, TranslationInputRegion]] = []
        body: list[dict[str, str]] = []
        for idx, region in enumerate(regions):
            source_text = (region.text or "").strip()
            if not source_text:
                continue
            prepared_text = _preprocess_translation_text(source_text, source_language)
            if not prepared_text:
                continue
            non_empty.append((idx, region))
            body.append({"text": prepared_text})

        translated_by_idx: dict[int, str] = {}
        if body:
            params = {"api-version": "3.0", "to": target}
            if source:
                params["from"] = source
            query = parse.urlencode(params)
            url = f"{self.endpoint}/translate?{query}"
            headers = {
                "Ocp-Apim-Subscription-Key": self.api_key,
                "Ocp-Apim-Subscription-Region": self.region,
            }
            payload = await _http_json_post(
                url=url, payload=body, headers=headers, timeout=35
            )
            if isinstance(payload, list):
                for pos, item in enumerate(payload):
                    if pos >= len(non_empty):
                        break
                    text = ""
                    if isinstance(item, dict):
                        translations = item.get("translations", [])
                        if isinstance(translations, list) and translations:
                            first = translations[0]
                            if isinstance(first, dict):
                                text = str(first.get("text") or "")
                    translated_by_idx[non_empty[pos][0]] = text

        results: list[TranslationTextResult] = []
        for idx, region in enumerate(regions):
            source_text = (region.text or "").strip()
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=source_text,
                    translated_text=translated_by_idx.get(idx, ""),
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                ),
            )
        return results


class YandexTranslatorEngine(BaseTranslator):
    key = "yandex_translate"
    name = "Yandex Translate"

    def __init__(self) -> None:
        self.api_key = (os.getenv("MINI_BACKEND_YANDEX_API_KEY") or "").strip()
        self.folder_id = (os.getenv("MINI_BACKEND_YANDEX_FOLDER_ID") or "").strip()
        self.endpoint = (
            os.getenv("MINI_BACKEND_YANDEX_ENDPOINT")
            or "https://translate.api.cloud.yandex.net/translate/v2/translate"
        ).strip()

    async def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        _ = extra_context
        _ = translation_notes_enabled
        _ = translation_mode
        if not self.api_key or not self.folder_id:
            raise RuntimeError(
                "Yandex requires MINI_BACKEND_YANDEX_API_KEY and MINI_BACKEND_YANDEX_FOLDER_ID"
            )

        source = _yandex_source_lang(source_language)
        target = _yandex_target_lang(target_language)
        if not target:
            raise RuntimeError("Invalid target language for Yandex Translate")

        non_empty: list[tuple[int, TranslationInputRegion]] = []
        texts: list[str] = []
        for idx, region in enumerate(regions):
            source_text = (region.text or "").strip()
            if not source_text:
                continue
            prepared_text = _preprocess_translation_text(source_text, source_language)
            if not prepared_text:
                continue
            non_empty.append((idx, region))
            texts.append(prepared_text)

        translated_by_idx: dict[int, str] = {}
        if texts:
            payload: dict[str, Any] = {
                "texts": texts,
                "targetLanguageCode": target,
                "folderId": self.folder_id,
                "format": "PLAIN_TEXT",
            }
            if source:
                payload["sourceLanguageCode"] = source
            headers = {
                "Authorization": f"Api-Key {self.api_key}",
            }
            response = await _http_json_post(
                url=self.endpoint, payload=payload, headers=headers, timeout=35
            )
            translations = (
                response.get("translations", []) if isinstance(response, dict) else []
            )
            if isinstance(translations, list):
                for pos, item in enumerate(translations):
                    if pos >= len(non_empty):
                        break
                    text = ""
                    if isinstance(item, dict):
                        text = str(item.get("text") or "")
                    translated_by_idx[non_empty[pos][0]] = text

        results: list[TranslationTextResult] = []
        for idx, region in enumerate(regions):
            source_text = (region.text or "").strip()
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=source_text,
                    translated_text=translated_by_idx.get(idx, ""),
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                ),
            )
        return results


class DeepLTranslatorEngine(BaseTranslator):
    key = "deepl"
    name = "DeepL"

    def __init__(self) -> None:
        self.api_key = (os.getenv("MINI_BACKEND_DEEPL_API_KEY") or "").strip()
        self.endpoint = (
            os.getenv("MINI_BACKEND_DEEPL_ENDPOINT")
            or "https://api-free.deepl.com/v2/translate"
        ).strip()

    async def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        _ = extra_context
        _ = translation_notes_enabled
        _ = translation_mode
        if not self.api_key:
            raise RuntimeError("DeepL requires MINI_BACKEND_DEEPL_API_KEY")

        source = _deepl_source_lang(source_language)
        target = _deepl_target_lang(target_language)
        if not target:
            raise RuntimeError("Invalid target language for DeepL")

        non_empty: list[tuple[int, TranslationInputRegion]] = []
        texts: list[str] = []
        for idx, region in enumerate(regions):
            source_text = (region.text or "").strip()
            if not source_text:
                continue
            prepared_text = _preprocess_translation_text(source_text, source_language)
            if not prepared_text:
                continue
            non_empty.append((idx, region))
            texts.append(prepared_text)

        translated_by_idx: dict[int, str] = {}
        if texts:
            fields: dict[str, Any] = {
                "auth_key": self.api_key,
                "target_lang": target,
                "text": texts,
            }
            if source and source != "AUTO":
                fields["source_lang"] = source
            response = await _http_form_post(
                url=self.endpoint, fields=fields, timeout=35
            )
            translations = (
                response.get("translations", []) if isinstance(response, dict) else []
            )
            if isinstance(translations, list):
                for pos, item in enumerate(translations):
                    if pos >= len(non_empty):
                        break
                    text = ""
                    if isinstance(item, dict):
                        text = str(item.get("text") or "")
                    translated_by_idx[non_empty[pos][0]] = text

        results: list[TranslationTextResult] = []
        for idx, region in enumerate(regions):
            source_text = (region.text or "").strip()
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=source_text,
                    translated_text=translated_by_idx.get(idx, ""),
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                ),
            )
        return results


class OpenAIGPTTranslatorEngine(BaseTranslator):
    name = "OpenAI GPT"

    def __init__(
        self,
        model_name: str,
        key: str,
        *,
        api_key_envs: tuple[str, ...] = ("MINI_BACKEND_OPENAI_API_KEY",),
        api_base_envs: tuple[str, ...] = ("MINI_BACKEND_OPENAI_API_BASE",),
        default_api_base: str = "https://api.openai.com/v1",
    ) -> None:
        self.model_name = model_name
        self.key = key
        self.api_key = _first_env(*api_key_envs)
        self.api_base = _first_env(*api_base_envs, default=default_api_base).rstrip("/")
        self.temperature = float(
            (os.getenv("MINI_BACKEND_LLM_TEMPERATURE") or "0.2").strip()
        )

    async def _translate_batch(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str,
        translation_notes_enabled: bool,
    ) -> dict[str, dict[str, Any]]:
        if not self.api_key:
            raise RuntimeError("OpenAI requires MINI_BACKEND_OPENAI_API_KEY")

        system_prompt = _llm_system_prompt(
            source_language, target_language, translation_notes_enabled
        )
        user_prompt = _llm_user_prompt(
            regions, extra_context, translation_notes_enabled
        )
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": self.temperature,
            "response_format": {"type": "json_object"},
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}

        try:
            response = await _http_json_post(
                url=f"{self.api_base}/chat/completions",
                payload=payload,
                headers=headers,
                timeout=90,
            )
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text
            raise RuntimeError(
                f"OpenAI HTTP {exc.response.status_code}: {detail}"
            ) from exc
        except httpx.RequestError as exc:
            raise RuntimeError(f"OpenAI unavailable: {exc}") from exc

        choices = response.get("choices", []) if isinstance(response, dict) else []
        if not isinstance(choices, list) or not choices:
            return {}
        first = choices[0] if isinstance(choices[0], dict) else {}
        message = first.get("message", {}) if isinstance(first, dict) else {}
        content = message.get("content", "") if isinstance(message, dict) else ""
        if isinstance(content, list):
            text_parts = [
                str(item.get("text") or "")
                for item in content
                if isinstance(item, dict)
            ]
            raw_text = "\n".join(part for part in text_parts if part).strip()
        else:
            raw_text = str(content or "").strip()
        return _parse_llm_translation_map(raw_text, regions)

    async def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        non_empty = [region for region in regions if (region.text or "").strip()]
        if not non_empty:
            return _empty_translation_results(regions, self.key)

        prepared_regions = _preprocess_translation_regions(non_empty, source_language)
        translated_map = await self._translate_batch(
            regions=prepared_regions,
            source_language=source_language,
            target_language=target_language,
            extra_context=extra_context,
            translation_notes_enabled=translation_notes_enabled,
        )
        translated_map = dedupe_translation_notes_across_regions(translated_map)

        results: list[TranslationTextResult] = []
        for region in regions:
            source_text = (region.text or "").strip()
            payload = (
                translated_map.get(region.id, {"text": "", "notes": []})
                if source_text
                else {"text": "", "notes": []}
            )
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=source_text,
                    translated_text=str(payload.get("text") or ""),
                    translation_notes=list(payload.get("notes") or [])
                    if translation_notes_enabled and translation_mode != "sfx"
                    else [],
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                ),
            )
        return results


class RequestScopedOpenAICompatibleTranslatorEngine(BaseTranslator):
    name = "Request Scoped OpenAI-Compatible"

    def __init__(
        self,
        *,
        key: str,
        model_name: str,
        api_base: str,
        api_key: str = "",
        temperature: float = 0.2,
        timeout: int = 90,
    ) -> None:
        self.key = key
        self.model_name = model_name
        self.api_base = _normalize_openai_compatible_api_base(api_base)
        self.api_key = str(api_key or "").strip()
        self.temperature = max(0.0, min(2.0, float(temperature)))
        self.timeout = max(5, int(timeout))

    async def _translate_batch(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str,
        translation_notes_enabled: bool,
        translation_mode: str,
    ) -> dict[str, dict[str, Any]]:
        system_prompt = _llm_system_prompt(
            source_language,
            target_language,
            translation_notes_enabled,
            translation_mode,
        )
        user_prompt = _llm_user_prompt(
            regions, extra_context, translation_notes_enabled, translation_mode
        )
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": self.temperature,
            "response_format": {"type": "json_object"},
        }
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else None

        try:
            response = await _http_json_post(
                url=_resolve_openai_compatible_chat_url(self.api_base),
                payload=payload,
                headers=headers,
                timeout=self.timeout,
            )
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text
            raise RuntimeError(
                f"Custom AI HTTP {exc.response.status_code}: {detail}"
            ) from exc
        except httpx.RequestError as exc:
            raise RuntimeError(f"Custom AI unavailable: {exc}") from exc

        choices = response.get("choices", []) if isinstance(response, dict) else []
        if not isinstance(choices, list) or not choices:
            return {}
        first = choices[0] if isinstance(choices[0], dict) else {}
        message = first.get("message", {}) if isinstance(first, dict) else {}
        content = message.get("content", "") if isinstance(message, dict) else ""
        if isinstance(content, list):
            text_parts = [
                str(item.get("text") or "")
                for item in content
                if isinstance(item, dict)
            ]
            raw_text = "\n".join(part for part in text_parts if part).strip()
        else:
            raw_text = str(content or "").strip()
        return _parse_llm_translation_map(raw_text, regions)

    async def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        non_empty = [region for region in regions if (region.text or "").strip()]
        if not non_empty:
            return _empty_translation_results(regions, self.key)

        prepared_regions = _preprocess_translation_regions(non_empty, source_language)
        translated_map = await self._translate_batch(
            regions=prepared_regions,
            source_language=source_language,
            target_language=target_language,
            extra_context=extra_context,
            translation_notes_enabled=translation_notes_enabled,
            translation_mode=translation_mode,
        )
        translated_map = dedupe_translation_notes_across_regions(translated_map)

        results: list[TranslationTextResult] = []
        for region in regions:
            source_text = (region.text or "").strip()
            payload = (
                translated_map.get(region.id, {"text": "", "notes": []})
                if source_text
                else {"text": "", "notes": []}
            )
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=source_text,
                    translated_text=str(payload.get("text") or ""),
                    translation_notes=list(payload.get("notes") or [])
                    if translation_notes_enabled and translation_mode != "sfx"
                    else [],
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                ),
            )
        return results


class RequestScopedOllamaNativeTranslatorEngine(BaseTranslator):
    name = "Request Scoped Ollama Native"

    def __init__(
        self,
        *,
        key: str,
        model_name: str,
        api_base: str,
        api_key: str = "",
        temperature: float = 0.2,
        timeout: int = 90,
    ) -> None:
        self.key = key
        self.model_name = model_name
        self.api_base = str(api_base or "").strip().rstrip("/")
        self.api_key = str(api_key or "").strip()
        self.temperature = max(0.0, min(2.0, float(temperature)))
        self.timeout = max(5, int(timeout))

    async def _translate_batch(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str,
        translation_notes_enabled: bool,
        translation_mode: str,
    ) -> dict[str, dict[str, Any]]:
        system_prompt = _llm_system_prompt(
            source_language,
            target_language,
            translation_notes_enabled,
            translation_mode,
        )
        user_prompt = _llm_user_prompt(
            regions, extra_context, translation_notes_enabled, translation_mode
        )
        payload = {
            "model": self.model_name,
            "stream": False,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "options": {
                "temperature": self.temperature,
                "num_predict": 4096,
            },
        }
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else None

        try:
            response = await _http_json_post(
                url=_resolve_ollama_chat_url(self.api_base),
                payload=payload,
                headers=headers,
                timeout=self.timeout,
            )
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text
            raise RuntimeError(
                f"Custom AI Ollama HTTP {exc.response.status_code}: {detail}"
            ) from exc
        except httpx.RequestError as exc:
            raise RuntimeError(f"Custom AI Ollama unavailable: {exc}") from exc

        message = response.get("message", {}) if isinstance(response, dict) else {}
        raw_text = (
            str(message.get("content") or response.get("response") or "").strip()
            if isinstance(message, dict)
            else str(response.get("response") or "").strip()
        )
        return _parse_llm_translation_map(raw_text, regions)

    async def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        non_empty = [region for region in regions if (region.text or "").strip()]
        if not non_empty:
            return _empty_translation_results(regions, self.key)

        prepared_regions = _preprocess_translation_regions(non_empty, source_language)
        translated_map = await self._translate_batch(
            regions=prepared_regions,
            source_language=source_language,
            target_language=target_language,
            extra_context=extra_context,
            translation_notes_enabled=translation_notes_enabled,
            translation_mode=translation_mode,
        )
        translated_map = dedupe_translation_notes_across_regions(translated_map)

        results: list[TranslationTextResult] = []
        for region in regions:
            source_text = (region.text or "").strip()
            payload = (
                translated_map.get(region.id, {"text": "", "notes": []})
                if source_text
                else {"text": "", "notes": []}
            )
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=source_text,
                    translated_text=str(payload.get("text") or ""),
                    translation_notes=list(payload.get("notes") or [])
                    if translation_notes_enabled and translation_mode != "sfx"
                    else [],
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                ),
            )
        return results


class GeminiTranslatorEngine(BaseTranslator):
    name = "Google Gemini"

    def __init__(
        self,
        model_name: str,
        key: str,
        *,
        api_key_envs: tuple[str, ...] = ("MINI_BACKEND_GEMINI_API_KEY",),
        api_base_envs: tuple[str, ...] = ("MINI_BACKEND_GEMINI_API_BASE",),
        default_api_base: str = "https://generativelanguage.googleapis.com/v1beta/models",
    ) -> None:
        self.model_name = model_name
        self.key = key
        self.api_key = _first_env(*api_key_envs)
        self.api_base = _first_env(*api_base_envs, default=default_api_base).rstrip("/")
        self.temperature = float(
            (os.getenv("MINI_BACKEND_LLM_TEMPERATURE") or "0.2").strip()
        )

    async def _translate_batch(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str,
        translation_notes_enabled: bool,
        translation_mode: str,
    ) -> dict[str, dict[str, Any]]:
        if not self.api_key:
            raise RuntimeError("Gemini requires MINI_BACKEND_GEMINI_API_KEY")

        system_prompt = _llm_system_prompt(
            source_language,
            target_language,
            translation_notes_enabled,
            translation_mode,
        )
        user_prompt = _llm_user_prompt(
            regions, extra_context, translation_notes_enabled, translation_mode
        )
        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": self.temperature,
                "maxOutputTokens": 4096,
                "topP": 0.95,
                "responseMimeType": "application/json",
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_NONE",
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_NONE",
                },
            ],
        }
        url = f"{self.api_base}/{self.model_name}:generateContent?key={parse.quote(self.api_key)}"
        try:
            response = await _http_json_post(url=url, payload=payload, timeout=90)
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text
            raise RuntimeError(
                f"Gemini HTTP {exc.response.status_code}: {detail}"
            ) from exc
        except httpx.RequestError as exc:
            raise RuntimeError(f"Gemini unavailable: {exc}") from exc

        candidates = (
            response.get("candidates", []) if isinstance(response, dict) else []
        )
        if not isinstance(candidates, list) or not candidates:
            return {}
        first = candidates[0] if isinstance(candidates[0], dict) else {}
        content = first.get("content", {}) if isinstance(first, dict) else {}
        parts = content.get("parts", []) if isinstance(content, dict) else []
        raw_text = ""
        if isinstance(parts, list):
            raw_text = "\n".join(
                str(item.get("text") or "")
                for item in parts
                if isinstance(item, dict) and item.get("text")
            ).strip()
        return _parse_llm_translation_map(raw_text, regions)

    async def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        non_empty = [region for region in regions if (region.text or "").strip()]
        if not non_empty:
            return _empty_translation_results(regions, self.key)

        prepared_regions = _preprocess_translation_regions(non_empty, source_language)
        translated_map = await self._translate_batch(
            regions=prepared_regions,
            source_language=source_language,
            target_language=target_language,
            extra_context=extra_context,
            translation_notes_enabled=translation_notes_enabled,
            translation_mode=translation_mode,
        )
        translated_map = dedupe_translation_notes_across_regions(translated_map)
        results: list[TranslationTextResult] = []
        for region in regions:
            source_text = (region.text or "").strip()
            payload = (
                translated_map.get(region.id, {"text": "", "notes": []})
                if source_text
                else {"text": "", "notes": []}
            )
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=source_text,
                    translated_text=str(payload.get("text") or ""),
                    translation_notes=list(payload.get("notes") or [])
                    if translation_notes_enabled and translation_mode != "sfx"
                    else [],
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                ),
            )
        return results


class ClaudeTranslatorEngine(BaseTranslator):
    name = "Anthropic Claude"

    def __init__(
        self,
        model_name: str,
        key: str,
        *,
        api_key_envs: tuple[str, ...] = ("MINI_BACKEND_ANTHROPIC_API_KEY",),
        endpoint_envs: tuple[str, ...] = ("MINI_BACKEND_ANTHROPIC_API_URL",),
        default_endpoint: str = "https://api.anthropic.com/v1/messages",
    ) -> None:
        self.model_name = model_name
        self.key = key
        self.api_key = _first_env(*api_key_envs)
        self.endpoint = _first_env(*endpoint_envs, default=default_endpoint).strip()
        self.temperature = float(
            (os.getenv("MINI_BACKEND_LLM_TEMPERATURE") or "0.2").strip()
        )

    async def _translate_batch(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str,
        translation_notes_enabled: bool,
        translation_mode: str,
    ) -> dict[str, dict[str, Any]]:
        if not self.api_key:
            raise RuntimeError("Claude requires MINI_BACKEND_ANTHROPIC_API_KEY")

        system_prompt = _llm_system_prompt(
            source_language,
            target_language,
            translation_notes_enabled,
            translation_mode,
        )
        user_prompt = _llm_user_prompt(
            regions, extra_context, translation_notes_enabled, translation_mode
        )
        payload = {
            "model": self.model_name,
            "system": system_prompt,
            "temperature": self.temperature,
            "max_tokens": 4096,
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": user_prompt}],
                },
            ],
        }
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
        }
        try:
            response = await _http_json_post(
                url=self.endpoint,
                payload=payload,
                headers=headers,
                timeout=90,
            )
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text
            raise RuntimeError(
                f"Claude HTTP {exc.response.status_code}: {detail}"
            ) from exc
        except httpx.RequestError as exc:
            raise RuntimeError(f"Claude unavailable: {exc}") from exc

        content = response.get("content", []) if isinstance(response, dict) else []
        raw_text = ""
        if isinstance(content, list):
            text_parts = [
                str(item.get("text") or "")
                for item in content
                if isinstance(item, dict) and item.get("type") == "text"
            ]
            raw_text = "\n".join(part for part in text_parts if part).strip()
        return _parse_llm_translation_map(raw_text, regions)

    async def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        non_empty = [region for region in regions if (region.text or "").strip()]
        if not non_empty:
            return _empty_translation_results(regions, self.key)

        prepared_regions = _preprocess_translation_regions(non_empty, source_language)
        translated_map = await self._translate_batch(
            regions=prepared_regions,
            source_language=source_language,
            target_language=target_language,
            extra_context=extra_context,
            translation_notes_enabled=translation_notes_enabled,
            translation_mode=translation_mode,
        )
        translated_map = dedupe_translation_notes_across_regions(translated_map)
        results: list[TranslationTextResult] = []
        for region in regions:
            source_text = (region.text or "").strip()
            payload = (
                translated_map.get(region.id, {"text": "", "notes": []})
                if source_text
                else {"text": "", "notes": []}
            )
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=source_text,
                    translated_text=str(payload.get("text") or ""),
                    translation_notes=list(payload.get("notes") or [])
                    if translation_notes_enabled and translation_mode != "sfx"
                    else [],
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                ),
            )
        return results


class CustomTranslatorEngine(BaseTranslator):
    key = "custom"
    name = "Custom"

    def __init__(self) -> None:
        self.endpoint = (os.getenv("MINI_BACKEND_CUSTOM_TRANSLATOR_URL") or "").strip()
        self.api_key = (
            os.getenv("MINI_BACKEND_CUSTOM_TRANSLATOR_API_KEY") or ""
        ).strip()
        self.model = (os.getenv("MINI_BACKEND_CUSTOM_TRANSLATOR_MODEL") or "").strip()
        self.timeout = int(
            (os.getenv("MINI_BACKEND_CUSTOM_TRANSLATOR_TIMEOUT") or "45").strip()
        )

    async def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        if not self.endpoint:
            # Fallback local: keep text as-is, useful when there is no network/API key configured.
            return [
                TranslationTextResult(
                    id=region.id,
                    source_text=(region.text or "").strip(),
                    translated_text=(region.text or "").strip(),
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                )
                for region in regions
            ]

        texts = [(region.text or "").strip() for region in regions]
        prepared_texts = [
            _preprocess_translation_text(text, source_language) for text in texts
        ]
        headers: dict[str, str] = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        payload = {
            "source_language": source_language,
            "target_language": target_language,
            "texts": prepared_texts,
            "extra_context": extra_context,
            "translation_notes_enabled": translation_notes_enabled,
            "translation_mode": translation_mode,
        }
        if self.model:
            payload["model"] = self.model

        translated: list[dict[str, Any]] = [{"text": "", "notes": []} for _ in texts]
        try:
            response = await _http_json_post(
                url=self.endpoint,
                payload=payload,
                headers=headers,
                timeout=max(5, self.timeout),
            )
            translations = []
            if isinstance(response, dict):
                if isinstance(response.get("translations"), list):
                    translations = response["translations"]
                elif isinstance(response.get("data"), list):
                    translations = response["data"]
            if isinstance(translations, list):
                for idx, item in enumerate(translations):
                    if idx >= len(translated):
                        break
                    if isinstance(item, dict):
                        translated[idx] = _translation_payload(
                            item.get("translated_text") or item.get("text") or "",
                            item.get("translation_notes")
                            or item.get("notes")
                            or item.get("note")
                            or item.get("nt"),
                        )
                    else:
                        translated[idx] = _translation_payload(item)
        except Exception:
            translated = [{"text": text, "notes": []} for text in texts]

        results: list[TranslationTextResult] = []
        for idx, region in enumerate(regions):
            source_text = texts[idx]
            payload_item = (
                translated[idx] if idx < len(translated) else {"text": "", "notes": []}
            )
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=source_text,
                    translated_text=str(payload_item.get("text") or ""),
                    translation_notes=list(payload_item.get("notes") or [])
                    if translation_notes_enabled and translation_mode != "sfx"
                    else [],
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                ),
            )
        return results


def build_request_scoped_custom_translation_engine(
    *,
    selected_model_key: str,
    custom_llm: dict[str, Any] | None,
    llm_settings: dict[str, Any] | None = None,
) -> BaseTranslator:
    resolved = resolve_request_custom_openai_config(custom_llm)
    settings = llm_settings if isinstance(llm_settings, dict) else {}
    raw_temperature = settings.get("temperature")
    temperature = 0.2
    if raw_temperature is not None:
        try:
            temperature = float(raw_temperature)
        except (TypeError, ValueError):
            temperature = 0.2

    translator_key = str(selected_model_key or "custom").strip() or "custom"
    if _is_ollama_cloud_host(resolved["api_base"]):
        if not resolved["api_key"]:
            raise RuntimeError(
                "Ollama Cloud requires a valid Bearer token for Custom AI."
            )
        return RequestScopedOllamaNativeTranslatorEngine(
            key=translator_key,
            model_name=resolved["model"],
            api_base=resolved["api_base"],
            api_key=resolved["api_key"],
            temperature=temperature,
        )
    return RequestScopedOpenAICompatibleTranslatorEngine(
        key=translator_key,
        model_name=resolved["model"],
        api_base=resolved["api_base"],
        api_key=resolved["api_key"],
        temperature=temperature,
    )
