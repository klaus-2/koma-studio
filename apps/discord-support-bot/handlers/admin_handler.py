"""Admin-only commands for the KŌMA Discord bot."""

from __future__ import annotations

from dataclasses import asdict

import discord
from discord.ext import commands

from config import Settings
from rag_engine import RAGEngine
from utils.logger import get_logger


class AdminHandler:
    """Handle reindex/status/history-clear commands for administrators."""

    def __init__(self, settings: Settings, rag_engine: RAGEngine) -> None:
        self.settings = settings
        self.rag_engine = rag_engine
        self.logger = get_logger(__name__)

    async def handle_reindex(self, ctx: commands.Context[commands.Bot]) -> None:
        """Force a full reindex."""
        if not self._is_admin(ctx.author):
            await ctx.send("🚫 You need the admin role to use this command.")
            return
        await ctx.send("🔄 Reindex started. This may take a few minutes.")
        stats = await self.rag_engine.rebuild_index()
        embed = discord.Embed(
            title="✅ Reindex complete",
            description=(
                f"Documents: **{stats.document_count}**\n"
                f"Chunks: **{stats.chunk_count}**\n"
                f"Collection: `{stats.collection_name}`"
            ),
            color=discord.Colour.from_str("#2ecc71"),
        )
        embed.set_footer(text=f"Last indexed: {stats.last_indexed_at}")
        await ctx.send(embed=embed)

    async def handle_status(self, ctx: commands.Context[commands.Bot]) -> None:
        """Report current index metadata."""
        if not self._is_admin(ctx.author):
            await ctx.send("🚫 You need the admin role to use this command.")
            return
        status = self.rag_engine.get_status()
        embed = discord.Embed(
            title="📊 Index status",
            color=discord.Colour.from_str("#9b59b6"),
        )
        embed.add_field(name="Ready", value="Yes" if status["ready"] else "No", inline=True)
        embed.add_field(name="Documents", value=str(status["document_count"]), inline=True)
        embed.add_field(name="Chunks", value=str(status["chunk_count"]), inline=True)
        embed.add_field(name="Collection", value=str(status["collection_name"]), inline=False)
        embed.add_field(name="Codebase", value=str(status["codebase_path"]), inline=False)
        configured_providers = status.get("configured_providers") or []
        embed.add_field(
            name="Configured providers",
            value=", ".join(str(item) for item in configured_providers) if configured_providers else "None",
            inline=False,
        )
        embed.set_footer(text=f"Last indexed: {status['last_indexed_at']}")
        await ctx.send(embed=embed)

    async def handle_clear(self, ctx: commands.Context[commands.Bot], raw_user_id: str | None = None) -> None:
        """Clear cached chat history for a specific user or the caller."""
        if not self._is_admin(ctx.author):
            await ctx.send("🚫 You need the admin role to use this command.")
            return

        target_user_id = ctx.author.id
        if raw_user_id:
            cleaned = raw_user_id.strip().replace("<@", "").replace(">", "").replace("!", "")
            if cleaned.isdigit():
                target_user_id = int(cleaned)

        cleared = self.rag_engine.clear_history(target_user_id)
        if cleared:
            await ctx.send(f"🧹 History cleared for user `{target_user_id}`.")
            return
        await ctx.send(f"ℹ️ There was no cached history for user `{target_user_id}`.")

    def _is_admin(self, author: discord.abc.User) -> bool:
        """Check whether the author can use admin commands."""
        if not isinstance(author, discord.Member):
            return False
        if author.guild_permissions.administrator:
            return True
        target_role = self.settings.admin_role_name.casefold()
        return any(role.name.casefold() == target_role for role in author.roles)
