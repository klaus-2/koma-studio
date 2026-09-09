"""Discord response formatting helpers."""

from __future__ import annotations

from typing import Iterable, Sequence

import discord

from language_utils import normalize_locale_code


MAX_MESSAGE_LENGTH = 1900


def split_message_content(text: str, max_length: int = MAX_MESSAGE_LENGTH) -> list[str]:
    """Split large messages into Discord-safe chunks."""
    normalized = text.strip()
    if not normalized:
        return ["No content to display."]
    if len(normalized) <= max_length:
        return [normalized]

    chunks: list[str] = []
    current = ""

    def push_current() -> None:
        nonlocal current
        if current:
            chunks.append(current)
            current = ""

    for paragraph in normalized.split("\n\n"):
        candidate = paragraph if not current else f"{current}\n\n{paragraph}"
        if len(candidate) <= max_length:
            current = candidate
            continue

        push_current()
        if len(paragraph) <= max_length:
            current = paragraph
            continue

        words = paragraph.split(" ")
        for word in words:
            word_candidate = word if not current else f"{current} {word}"
            if len(word_candidate) <= max_length:
                current = word_candidate
                continue
            push_current()
            if len(word) <= max_length:
                current = word
                continue

            for start in range(0, len(word), max_length):
                piece = word[start : start + max_length]
                chunks.append(piece)
            current = ""

    push_current()
    return chunks


def summarize_sources(sources: Sequence[str]) -> str:
    """Create a compact, friendly source summary."""
    unique_sources: list[str] = []
    for source in sources:
        cleaned = source.strip()
        if cleaned and cleaned not in unique_sources:
            unique_sources.append(cleaned)
    if not unique_sources:
        return "KŌMA internal knowledge base"
    preview = " • ".join(unique_sources[:2])
    if len(unique_sources) > 2:
        preview += f" +{len(unique_sources) - 2}"
    return preview


def intent_color(intent: str) -> discord.Colour:
    """Return the color for a given interaction intent."""
    if intent == "tutorial":
        return discord.Colour.from_str("#2ecc71")
    if intent == "error":
        return discord.Colour.from_str("#e74c3c")
    return discord.Colour.from_str("#9b59b6")


def intent_title(intent: str) -> str:
    """Return the embed title for a given intent."""
    if intent == "tutorial":
        return "📚 Tutorial"
    if intent == "error":
        return "🚨 KŌMA Studio | Support"
    return "🎨 KŌMA Studio | Support"


def build_embeds(
    answer: str,
    *,
    intent: str,
    sources: Sequence[str],
    latency_ms: int,
    language_code: str,
    provider_name: str | None = None,
    provider_model: str | None = None,
    failover_count: int = 0,
) -> list[discord.Embed]:
    """Create one or more embeds from an answer."""
    source_summary = summarize_sources(sources)
    chunks = split_message_content(answer)
    embeds: list[discord.Embed] = []
    for index, chunk in enumerate(chunks, start=1):
        embed = discord.Embed(
            title=intent_title(intent) if index == 1 else f"{intent_title(intent)} (part {index})",
            description=chunk,
            color=intent_color(intent),
        )
        footer_parts = [f"Source: {source_summary}", f"Language: {language_code}", f"Answered in {latency_ms}ms"]
        if provider_name and provider_model:
            footer_parts.insert(1, f"LLM: {provider_name} / {provider_model}")
        if failover_count:
            footer_parts.append(f"Failovers: {failover_count}")
        embed.set_footer(text=" • ".join(footer_parts))
        embeds.append(embed)
    return embeds


def default_help_embed(language_code: str = "en") -> discord.Embed:
    """Build the public help embed."""
    normalized = normalize_locale_code(language_code, default="en")
    if normalized == "pt-br":
        title = "🎨 KŌMA Studio | Como posso ajudar?"
        description = (
            "Posso responder dúvidas sobre o KŌMA Studio, explicar ferramentas, montar tutoriais passo a passo "
            "e ajudar a diagnosticar problemas comuns com base na documentação e na interface real do produto."
        )
        commands_label = "Comandos principais"
        examples_label = "Exemplos"
        examples = (
            "`!k Como eu uso o pipeline AIO?`\n"
            "`!k Quais formatos o dashboard aceita?`\n"
            "`/tutorial cleaner`\n"
            "`@KomaBot como exportar um ZIP?`"
        )
    else:
        title = "🎨 KŌMA Studio | How can I help?"
        description = (
            "I can answer questions about KŌMA Studio, explain real product workflows, create step-by-step tutorials, "
            "and help diagnose common issues using the app's own knowledge base."
        )
        commands_label = "Main commands"
        examples_label = "Examples"
        examples = (
            "`!k How do I use the AIO pipeline?`\n"
            "`!k Which file formats does the dashboard accept?`\n"
            "`/tutorial cleaner`\n"
            "`@KomaBot how do I export a ZIP?`"
        )
    embed = discord.Embed(
        title=title,
        description=description,
        color=discord.Colour.from_str("#9b59b6"),
    )
    embed.add_field(
        name=commands_label,
        value=(
            "`!k <question>`\n"
            "`/ask <question>`\n"
            "`/tutorial <feature>`\n"
            "`/help`"
        ),
        inline=False,
    )
    embed.add_field(
        name=examples_label,
        value=examples,
        inline=False,
    )
    return embed
