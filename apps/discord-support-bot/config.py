"""Centralized configuration for the KŌMA Discord support bot."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os

from dotenv import load_dotenv


def _parse_bool(value: str | None, default: bool = False) -> bool:
    """Parse a boolean environment variable."""
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_int_list(value: str | None) -> tuple[int, ...]:
    """Parse a comma-separated list of integers."""
    if not value:
        return ()
    items: list[int] = []
    for raw_item in value.split(","):
        item = raw_item.strip()
        if not item:
            continue
        items.append(int(item))
    return tuple(items)


def _resolve_path(base_dir: Path, raw_value: str) -> Path:
    """Resolve relative paths against the bot directory."""
    path = Path(raw_value).expanduser()
    if not path.is_absolute():
        path = (base_dir / path).resolve()
    return path


@dataclass(slots=True, frozen=True)
class Settings:
    """Runtime settings loaded from environment variables."""

    discord_bot_token: str
    discord_guild_id: int | None
    allowed_channel_ids: tuple[int, ...]
    admin_role_name: str
    openai_api_key: str | None
    openai_model: str
    openai_embedding_model: str
    codebase_path: Path
    vector_db_path: Path
    chunk_size: int
    chunk_overlap: int
    top_k_results: int
    collection_name: str
    use_ollama: bool
    ollama_base_url: str
    ollama_model: str
    ollama_embedding_model: str
    log_level: str
    provider_rate_limit_cooldown_seconds: int
    llm_provider_priority: tuple[str, ...]
    request_timeout_seconds: float = 45.0
    message_history_limit: int = 10
    rate_limit_requests: int = 5
    rate_limit_window_seconds: int = 60
    auto_archive_duration_minutes: int = 60

    @property
    def index_state_path(self) -> Path:
        """Return the metadata file path stored next to the vector DB."""
        return self.vector_db_path / "index_state.json"

    @property
    def has_vector_embeddings_backend(self) -> bool:
        """Return whether a valid-enough vector embedding backend is configured."""
        if self.use_ollama:
            return True
        if not self.openai_api_key:
            return False
        normalized = self.openai_api_key.strip().lower()
        if normalized.startswith("sua_") or normalized.endswith("_aqui") or "placeholder" in normalized:
            return False
        return self.openai_api_key.startswith("sk-")


def load_settings(env_file: str | Path | None = None) -> Settings:
    """Load and validate bot settings."""
    base_dir = Path(__file__).resolve().parent
    dotenv_path = Path(env_file).expanduser() if env_file else base_dir / ".env"
    load_dotenv(dotenv_path if dotenv_path.exists() else None)

    discord_bot_token = os.getenv("DISCORD_BOT_TOKEN", "").strip()
    if not discord_bot_token:
        raise ValueError("DISCORD_BOT_TOKEN is required.")

    discord_guild_id_raw = os.getenv("DISCORD_GUILD_ID", "").strip()
    discord_guild_id = int(discord_guild_id_raw) if discord_guild_id_raw else None

    use_ollama = _parse_bool(os.getenv("USE_OLLAMA"), default=False)
    openai_api_key = os.getenv("OPENAI_API_KEY", "").strip() or None
    codebase_path = _resolve_path(base_dir, os.getenv("CODEBASE_PATH", "../../"))
    vector_db_path = _resolve_path(base_dir, os.getenv("VECTOR_DB_PATH", "./chroma_db"))
    vector_db_path.mkdir(parents=True, exist_ok=True)

    return Settings(
        discord_bot_token=discord_bot_token,
        discord_guild_id=discord_guild_id,
        allowed_channel_ids=_parse_int_list(os.getenv("ALLOWED_CHANNEL_IDS")),
        admin_role_name=os.getenv("ADMIN_ROLE_NAME", "Admin").strip() or "Admin",
        openai_api_key=openai_api_key,
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini",
        openai_embedding_model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small").strip() or "text-embedding-3-small",
        codebase_path=codebase_path,
        vector_db_path=vector_db_path,
        chunk_size=int(os.getenv("CHUNK_SIZE", "512")),
        chunk_overlap=int(os.getenv("CHUNK_OVERLAP", "64")),
        top_k_results=int(os.getenv("TOP_K_RESULTS", "5")),
        collection_name=os.getenv("INDEX_COLLECTION_NAME", "koma_support_kb").strip() or "koma_support_kb",
        use_ollama=use_ollama,
        ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip() or "http://localhost:11434",
        ollama_model=os.getenv("OLLAMA_MODEL", "llama3.1").strip() or "llama3.1",
        ollama_embedding_model=os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text").strip() or "nomic-embed-text",
        log_level=os.getenv("LOG_LEVEL", "INFO").strip().upper() or "INFO",
        provider_rate_limit_cooldown_seconds=int(os.getenv("LLM_RATE_LIMIT_COOLDOWN_SECONDS", "300")),
        llm_provider_priority=tuple(
            item.strip().lower()
            for item in os.getenv("LLM_PROVIDER_PRIORITY", "").split(",")
            if item.strip()
        ),
    )
