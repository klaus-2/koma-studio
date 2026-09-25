from __future__ import annotations

import json

from core.languages import get_language_label, normalize_language_code
from models.translation.base_translator import TranslationInputRegion


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
