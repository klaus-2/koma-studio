"""Public chat and support flows for the KŌMA Discord bot."""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from time import monotonic
import re

import discord
from discord import app_commands
from discord.ext import commands

from config import Settings
from language_utils import normalize_locale_code
from rag_engine import RAGEngine
from utils.formatter import build_embeds, default_help_embed
from utils.logger import get_logger


@dataclass(slots=True)
class RateLimitResult:
    """Result for a rate limit check."""

    allowed: bool
    retry_after_seconds: int = 0


class SlidingWindowRateLimiter:
    """Simple per-user sliding window limiter."""

    def __init__(self, *, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._timestamps: dict[int, deque[float]] = defaultdict(deque)

    def check(self, user_id: int) -> RateLimitResult:
        """Check and update the current usage bucket."""
        now = monotonic()
        bucket = self._timestamps[user_id]
        while bucket and now - bucket[0] > self.window_seconds:
            bucket.popleft()
        if len(bucket) >= self.max_requests:
            retry_after = max(1, int(self.window_seconds - (now - bucket[0])))
            return RateLimitResult(allowed=False, retry_after_seconds=retry_after)
        bucket.append(now)
        return RateLimitResult(allowed=True)


class ChatHandler:
    """Handle user-facing Discord interactions."""

    def __init__(self, bot: commands.Bot, settings: Settings, rag_engine: RAGEngine) -> None:
        self.bot = bot
        self.settings = settings
        self.rag_engine = rag_engine
        self.logger = get_logger(__name__)
        self.rate_limiter = SlidingWindowRateLimiter(
            max_requests=self.settings.rate_limit_requests,
            window_seconds=self.settings.rate_limit_window_seconds,
        )

    async def handle_prefix_question(self, ctx: commands.Context[commands.Bot], question: str) -> None:
        """Handle `!k <question>` style interactions."""
        if not await self._ensure_channel_allowed(ctx.channel, respond_to=ctx):
            return
        cleaned_question = question.strip()
        if not cleaned_question:
            await ctx.send(embed=default_help_embed())
            return

        rate_limit = self.rate_limiter.check(ctx.author.id)
        if not rate_limit.allowed:
            await ctx.send(
                f"⏳ You've hit the temporary question limit. Try again in {rate_limit.retry_after_seconds}s.",
            )
            return

        destination = await self._ensure_thread_for_context(ctx)
        await self._answer_in_destination(
            destination=destination,
            user_id=ctx.author.id,
            question=cleaned_question,
            intent=self._infer_intent(cleaned_question),
            preferred_locale=None,
        )

    async def handle_slash_ask(self, interaction: discord.Interaction, question: str) -> None:
        """Handle `/ask` slash command."""
        if not await self._ensure_channel_allowed(interaction.channel, respond_to=interaction):
            return
        rate_limit = self.rate_limiter.check(interaction.user.id)
        if not rate_limit.allowed:
            await interaction.response.send_message(
                f"⏳ You've hit the temporary question limit. Try again in {rate_limit.retry_after_seconds}s.",
                ephemeral=True,
            )
            return

        destination, deferred = await self._ensure_thread_for_interaction(interaction)
        await self._answer_in_destination(
            destination=destination,
            user_id=interaction.user.id,
            question=question.strip(),
            intent=self._infer_intent(question),
            interaction=interaction,
            deferred=deferred,
            preferred_locale=str(interaction.locale),
        )

    async def handle_slash_help(self, interaction: discord.Interaction) -> None:
        """Handle `/help` slash command."""
        await interaction.response.send_message(
            embed=default_help_embed(normalize_locale_code(str(interaction.locale), default="en")),
            ephemeral=True,
        )

    async def handle_slash_tutorial(self, interaction: discord.Interaction, feature: str) -> None:
        """Handle `/tutorial <feature>` slash command."""
        if not await self._ensure_channel_allowed(interaction.channel, respond_to=interaction):
            return
        rate_limit = self.rate_limiter.check(interaction.user.id)
        if not rate_limit.allowed:
            await interaction.response.send_message(
                f"⏳ You've hit the temporary question limit. Try again in {rate_limit.retry_after_seconds}s.",
                ephemeral=True,
            )
            return

        destination, deferred = await self._ensure_thread_for_interaction(interaction)
        tutorial_prompt = f"Create a step-by-step tutorial about: {feature.strip()}"
        await self._answer_in_destination(
            destination=destination,
            user_id=interaction.user.id,
            question=tutorial_prompt,
            intent="tutorial",
            interaction=interaction,
            deferred=deferred,
            preferred_locale=str(interaction.locale),
        )

    async def handle_direct_mention(self, message: discord.Message) -> bool:
        """Handle `@KomaBot ...` messages."""
        if message.author.bot or self.bot.user is None:
            return False

        if self.bot.user not in message.mentions:
            return False

        if not await self._ensure_channel_allowed(message.channel, respond_to=message):
            return True

        question = re.sub(rf"<@!?{self.bot.user.id}>", "", message.content).strip()
        if not question:
            await message.channel.send(embed=default_help_embed("en"))
            return True

        rate_limit = self.rate_limiter.check(message.author.id)
        if not rate_limit.allowed:
            await message.channel.send(
                f"⏳ You've hit the temporary question limit. Try again in {rate_limit.retry_after_seconds}s.",
            )
            return True

        destination = await self._ensure_thread_for_message(message)
        await self._answer_in_destination(
            destination=destination,
            user_id=message.author.id,
            question=question,
            intent=self._infer_intent(question),
            preferred_locale=None,
        )
        return True

    async def _answer_in_destination(
        self,
        *,
        destination: discord.abc.Messageable,
        user_id: int,
        question: str,
        intent: str,
        interaction: discord.Interaction | None = None,
        deferred: bool = False,
        preferred_locale: str | None = None,
    ) -> None:
        """Run the RAG engine and deliver the embeds."""
        self.logger.info("Received interaction", extra={"intent": intent, "question_length": len(question)})
        async with destination.typing():
            result = await self.rag_engine.answer_question(
                user_id=user_id,
                question=question,
                intent=intent,
                preferred_locale=preferred_locale,
            )

        embeds = build_embeds(
            result.answer,
            intent=intent if not result.timed_out else "error",
            sources=result.sources,
            latency_ms=result.latency_ms,
            language_code=result.language_code,
            provider_name=result.provider_name,
            provider_model=result.provider_model,
            failover_count=result.failover_count,
        )
        if interaction is not None and deferred:
            await interaction.followup.send(embed=embeds[0])
            for embed in embeds[1:]:
                await interaction.followup.send(embed=embed)
            return

        await destination.send(embed=embeds[0])
        for embed in embeds[1:]:
            await destination.send(embed=embed)

    async def _ensure_channel_allowed(
        self,
        channel: discord.abc.Messageable | None,
        *,
        respond_to: commands.Context[commands.Bot] | discord.Interaction | discord.Message,
    ) -> bool:
        """Check whether the current channel is allowed."""
        if channel is None or not self.settings.allowed_channel_ids:
            return True

        channel_id = getattr(channel, "id", None)
        parent_id = getattr(channel, "parent_id", None)
        allowed_ids = set(self.settings.allowed_channel_ids)
        if channel_id in allowed_ids or parent_id in allowed_ids:
            return True

        message = "This channel is not authorized for KŌMA Bot support."
        if isinstance(respond_to, discord.Interaction):
            if respond_to.response.is_done():
                await respond_to.followup.send(message, ephemeral=True)
            else:
                await respond_to.response.send_message(message, ephemeral=True)
        else:
            await respond_to.channel.send(message)
        return False

    async def _ensure_thread_for_context(self, ctx: commands.Context[commands.Bot]) -> discord.abc.Messageable:
        """Create a thread for prefix commands when possible."""
        return await self._ensure_thread_for_message(ctx.message, pointer_context=ctx)

    async def _ensure_thread_for_message(
        self,
        message: discord.Message,
        *,
        pointer_context: commands.Context[commands.Bot] | None = None,
    ) -> discord.abc.Messageable:
        """Create a support thread from a message when supported."""
        channel = message.channel
        if isinstance(channel, (discord.Thread, discord.DMChannel)):
            return channel
        if not isinstance(channel, discord.TextChannel):
            return channel

        thread_name = f"Koma Support • {message.author.display_name[:40]}"
        try:
            thread = await message.create_thread(
                name=thread_name,
                auto_archive_duration=self.settings.auto_archive_duration_minutes,
            )
            pointer_target = pointer_context if pointer_context is not None else message
            if isinstance(pointer_target, commands.Context):
                await pointer_target.reply(
                    f"🧵 I'll continue helping you in {thread.mention}.",
                    mention_author=False,
                )
            else:
                await message.reply(f"🧵 I'll continue helping you in {thread.mention}.", mention_author=False)
            return thread
        except discord.DiscordException as exc:
            self.logger.warning(
                "Failed to create support thread for message",
                extra={"message_id": message.id, "channel_id": channel.id, "error": str(exc)},
            )
            return channel

    async def _ensure_thread_for_interaction(
        self,
        interaction: discord.Interaction,
    ) -> tuple[discord.abc.Messageable, bool]:
        """Create a thread for slash commands when possible."""
        channel = interaction.channel
        if isinstance(channel, (discord.Thread, discord.DMChannel)):
            await interaction.response.defer(thinking=True)
            return channel, True

        if not isinstance(channel, discord.TextChannel):
            await interaction.response.defer(thinking=True)
            return channel or interaction.channel, True

        await interaction.response.send_message("🧵 Opening a support thread...")
        seed_message = await interaction.original_response()
        thread_name = f"Koma Support • {interaction.user.display_name[:40]}"
        try:
            thread = await seed_message.create_thread(
                name=thread_name,
                auto_archive_duration=self.settings.auto_archive_duration_minutes,
            )
            await seed_message.edit(content=f"🧵 Support started in {thread.mention}.")
            return thread, False
        except discord.DiscordException as exc:
            self.logger.warning(
                "Failed to create support thread for interaction",
                extra={"channel_id": channel.id, "user_id": interaction.user.id, "error": str(exc)},
            )
            await seed_message.edit(content="I couldn't open a thread. I'll answer right here instead.")
            return channel, False

    def _infer_intent(self, question: str) -> str:
        """Infer whether the message is a support request, tutorial, or error."""
        lowered = question.lower()
        if any(token in lowered for token in ("tutorial", "passo a passo", "como usar", "como faço")):
            return "tutorial"
        if any(token in lowered for token in ("erro", "falha", "bug", "travou", "não funciona", "nao funciona")):
            return "error"
        return "support"
