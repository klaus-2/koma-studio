"""Entry point for the KŌMA Studio Discord support bot."""

from __future__ import annotations

import asyncio

import discord
from discord import app_commands
from discord.ext import commands

from config import load_settings
from handlers.admin_handler import AdminHandler
from handlers.chat_handler import ChatHandler
from rag_engine import RAGEngine
from utils.logger import configure_logging, get_logger


class KomaSupportBot(commands.Bot):
    """Discord bot configured for KŌMA Studio support."""

    def __init__(self) -> None:
        self.settings = load_settings()
        configure_logging(self.settings.log_level)
        self.logger = get_logger(__name__)

        intents = discord.Intents.default()
        intents.message_content = True
        intents.guild_messages = True
        intents.dm_messages = True

        super().__init__(
            command_prefix="!",
            intents=intents,
            help_command=None,
            allowed_mentions=discord.AllowedMentions.none(),
        )

        self.rag_engine = RAGEngine(self.settings)
        self.chat_handler = ChatHandler(self, self.settings, self.rag_engine)
        self.admin_handler = AdminHandler(self.settings, self.rag_engine)
        self._warmup_started = False
        self._register_prefix_commands()
        self._register_slash_commands()

    async def setup_hook(self) -> None:
        """Sync application commands on startup."""
        if self.settings.discord_guild_id:
            guild = discord.Object(id=self.settings.discord_guild_id)
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
            self.logger.info("Synced slash commands to guild", extra={"guild_id": self.settings.discord_guild_id})
            return

        await self.tree.sync()
        self.logger.info("Synced slash commands globally")

    async def on_ready(self) -> None:
        """Log readiness and kick off the background warm-up."""
        self.logger.info(
            "Bot connected",
            extra={"user_id": self.user.id if self.user else None, "user_name": str(self.user) if self.user else None},
        )
        if not self._warmup_started:
            self._warmup_started = True
            asyncio.create_task(self._warm_up_index())

    async def on_message(self, message: discord.Message) -> None:
        """Handle direct mentions before regular command processing."""
        if message.author.bot:
            return
        handled = await self.chat_handler.handle_direct_mention(message)
        if handled:
            return
        await self.process_commands(message)

    async def on_command_error(self, ctx: commands.Context[commands.Bot], error: commands.CommandError) -> None:
        """Handle command errors with concise feedback."""
        if isinstance(error, commands.CommandNotFound):
            return
        if isinstance(error, commands.CheckFailure):
            await ctx.send("🚫 You don't have permission to run this command.")
            return
        self.logger.exception("Unhandled command error", exc_info=error)
        await ctx.send("⚠️ Something went wrong while processing that command. Please try again shortly.")

    async def _warm_up_index(self) -> None:
        """Warm up the RAG engine in the background."""
        try:
            await self.rag_engine.ensure_ready()
        except Exception as exc:  # noqa: BLE001
            self.logger.exception("Background warm-up failed", exc_info=exc)

    def _register_prefix_commands(self) -> None:
        """Register classic prefix commands."""

        @self.command(name="k")
        async def ask_prefix(ctx: commands.Context[commands.Bot], *, question: str = "") -> None:
            """Ask the KŌMA assistant a question."""
            await self.chat_handler.handle_prefix_question(ctx, question)

        @self.command(name="reindex")
        async def reindex_prefix(ctx: commands.Context[commands.Bot]) -> None:
            """Force a full reindex of the knowledge base."""
            await self.admin_handler.handle_reindex(ctx)

        @self.command(name="status")
        async def status_prefix(ctx: commands.Context[commands.Bot]) -> None:
            """Show current index statistics."""
            await self.admin_handler.handle_status(ctx)

        @self.command(name="clear")
        async def clear_prefix(ctx: commands.Context[commands.Bot], raw_user_id: str | None = None) -> None:
            """Clear a user's cached conversation history."""
            await self.admin_handler.handle_clear(ctx, raw_user_id)

    def _register_slash_commands(self) -> None:
        """Register public slash commands."""

        @self.tree.command(name="ask", description="Ask anything about KŌMA Studio.")
        @app_commands.describe(question="Your question, error, or request for guidance")
        async def ask_command(interaction: discord.Interaction, question: str) -> None:
            await self.chat_handler.handle_slash_ask(interaction, question)

        @self.tree.command(name="help", description="See examples of what the bot can do.")
        async def help_command(interaction: discord.Interaction) -> None:
            await self.chat_handler.handle_slash_help(interaction)

        @self.tree.command(name="tutorial", description="Get a step-by-step guide for a feature.")
        @app_commands.describe(feature="Example: AIO pipeline, cleaner, stitch, export")
        async def tutorial_command(interaction: discord.Interaction, feature: str) -> None:
            await self.chat_handler.handle_slash_tutorial(interaction, feature)


def main() -> None:
    """Run the Discord bot."""
    bot = KomaSupportBot()
    bot.run(bot.settings.discord_bot_token, log_handler=None)


if __name__ == "__main__":
    main()
