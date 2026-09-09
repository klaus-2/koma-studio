"""Index the KŌMA Studio codebase and documentation into ChromaDB."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import argparse
import json
import os
import re

import chromadb
from llama_index.core import Document, Settings, StorageContext, VectorStoreIndex
from llama_index.core.node_parser import TokenTextSplitter
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore
from tqdm import tqdm

from config import Settings as BotSettings
from config import load_settings
from utils.logger import configure_logging, get_logger


ALLOWED_EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".md",
    ".txt",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".rst",
}
IGNORED_DIR_NAMES = {
    ".git",
    ".agents",
    ".claude",
    ".codex",
    ".cursor",
    ".opencode",
    ".qwen",
    ".venv",
    ".venv-mini",
    ".pytest_cache",
    ".ruff_cache",
    ".npm-cache",
    ".build-cache",
    "__pycache__",
    "node_modules",
    "dist",
    "dist-electron",
    "build",
    "release-desktop",
    "temp",
}
IGNORED_FILE_NAMES = {
    "AGENTS.md",
    "AGENT.md",
    "QUESTIONS.md",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
}
PRIORITY_LABELS = {
    "guides-data.ts": ("In-app guides", 0.40),
    "resources-data.ts": ("In-app resources hub", 0.35),
    "dashboard.constants.ts": ("Dashboard constants", 0.30),
    "ptBR.ts": ("PT-BR interface strings", 0.28),
    "FAQ.tsx": ("Public site FAQ", 0.24),
    "README.md": ("Main project guide", 0.20),
}
CURATED_SOURCE_ROOTS = (
    "packages/interface/src/data/guides-data.ts",
    "packages/interface/src/data/resources-data.ts",
    "packages/interface/src/constants/dashboard.constants.ts",
    "packages/interface/src/i18n/langs/ptBR.ts",
    "packages/interface/src/i18n/langs/en.ts",
    "apps/landing/src/components/FAQ.tsx",
    "apps/landing/src/components/Features.tsx",
    "README.md",
)
@dataclass(slots=True)
class IndexStats:
    """Human-readable metadata about the persisted index."""

    collection_name: str
    codebase_path: str
    document_count: int
    chunk_count: int
    last_indexed_at: str
    retrieval_mode: str = "vector"


@dataclass(slots=True)
class LexicalChunk:
    """Minimal persisted chunk used by the lexical fallback retriever."""

    text: str
    metadata: dict[str, Any]


class CodebaseIndexer:
    """Build and load the Chroma-backed LlamaIndex index."""

    def __init__(self, settings: BotSettings) -> None:
        self.settings = settings
        self.logger = get_logger(__name__)
        self.client = chromadb.PersistentClient(path=str(self.settings.vector_db_path))

    def configure_embedding_model(self) -> None:
        """Set the global embedding model used by LlamaIndex."""
        if self.settings.use_ollama:
            Settings.embed_model = OllamaEmbedding(
                model_name=self.settings.ollama_embedding_model,
                base_url=self.settings.ollama_base_url,
            )
            return

        if not self.settings.has_vector_embeddings_backend:
            raise RuntimeError(
                "No valid vector backend configured for embeddings. "
                "Use Ollama for embeddings or let the engine fall back to lexical mode."
            )
        os.environ["OPENAI_API_KEY"] = self.settings.openai_api_key
        Settings.embed_model = OpenAIEmbedding(model=self.settings.openai_embedding_model)

    @property
    def lexical_index_path(self) -> Path:
        """Return the persisted lexical fallback file path."""
        return self.settings.vector_db_path / "lexical_chunks.json"

    def collection_exists(self) -> bool:
        """Return whether the target Chroma collection exists and contains data."""
        try:
            collection = self.client.get_collection(self.settings.collection_name)
        except Exception:
            return False
        return collection.count() > 0

    def read_stats(self) -> IndexStats | None:
        """Read persisted index metadata, if available."""
        if not self.settings.index_state_path.exists():
            return None
        raw = json.loads(self.settings.index_state_path.read_text(encoding="utf-8"))
        return IndexStats(**raw)

    def write_stats(self, stats: IndexStats) -> None:
        """Persist index metadata next to the vector store."""
        self.settings.index_state_path.write_text(
            json.dumps(asdict(stats), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def delete_existing_collection(self) -> None:
        """Delete the previous collection before rebuilding."""
        try:
            self.client.delete_collection(self.settings.collection_name)
        except Exception:
            return

    def iter_candidate_files(self) -> list[Path]:
        """Collect supported source files while ignoring caches and generated output."""
        root = self.settings.codebase_path
        candidates: list[Path] = []
        source_roots = [root / relative for relative in CURATED_SOURCE_ROOTS]
        for source_root in source_roots:
            if not source_root.exists():
                continue
            if source_root.is_file():
                if self._should_include_file(source_root):
                    candidates.append(source_root)
                continue
            for path in source_root.rglob("*"):
                if self._should_include_file(path):
                    candidates.append(path)
        return sorted(candidates)

    def _should_include_file(self, path: Path) -> bool:
        """Return whether a file should be part of the knowledge base."""
        if not path.is_file():
            return False
        if any(part in IGNORED_DIR_NAMES for part in path.parts):
            return False
        if path.name in IGNORED_FILE_NAMES or path.name.endswith((".pyc", ".log", ".tsbuildinfo")):
            return False
        if path.name.endswith(".env.example"):
            return True
        return path.suffix.lower() in ALLOWED_EXTENSIONS

    def build_documents(self) -> list[Document]:
        """Create LlamaIndex documents from supported files."""
        documents: list[Document] = []
        files = self.iter_candidate_files()
        root = self.settings.codebase_path
        for file_path in tqdm(files, desc="Reading files", unit="file"):
            text = self._read_text_file(file_path)
            if not text.strip():
                continue
            relative_path = file_path.relative_to(root).as_posix()
            source_label, priority_boost = self._resolve_source_label(relative_path)
            metadata = {
                "source_path": relative_path,
                "source_type": self._classify_source_type(relative_path),
                "source_label": source_label,
                "priority_boost": priority_boost,
            }
            documents.append(Document(text=text, metadata=metadata))
        return documents

    def build_index(self, force_reindex: bool = False) -> IndexStats:
        """Create or rebuild the persisted vector index."""
        self.configure_embedding_model()
        if force_reindex:
            self.delete_existing_collection()

        documents = self.build_documents()
        splitter = TokenTextSplitter(
            chunk_size=self.settings.chunk_size,
            chunk_overlap=self.settings.chunk_overlap,
            separator=" ",
        )
        nodes = splitter.get_nodes_from_documents(documents)
        self.logger.info(
            "Prepared chunks for indexing",
            extra={"document_count": len(documents), "chunk_count": len(nodes)},
        )

        collection = self.client.get_or_create_collection(self.settings.collection_name)
        vector_store = ChromaVectorStore(chroma_collection=collection)
        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        VectorStoreIndex(nodes, storage_context=storage_context, show_progress=False)

        stats = IndexStats(
            collection_name=self.settings.collection_name,
            codebase_path=str(self.settings.codebase_path),
            document_count=len(documents),
            chunk_count=len(nodes),
            last_indexed_at=datetime.now(timezone.utc).isoformat(),
            retrieval_mode="vector",
        )
        self.write_stats(stats)
        return stats

    def build_lexical_index(self) -> IndexStats:
        """Build and persist a lexical fallback index with no external embeddings."""
        documents = self.build_documents()
        splitter = TokenTextSplitter(
            chunk_size=self.settings.chunk_size,
            chunk_overlap=self.settings.chunk_overlap,
            separator=" ",
        )
        nodes = splitter.get_nodes_from_documents(documents)
        chunks = [
            LexicalChunk(
                text=node.get_content().strip(),
                metadata=dict(node.metadata),
            )
            for node in nodes
            if node.get_content().strip()
        ]
        payload = [asdict(chunk) for chunk in chunks]
        self.lexical_index_path.write_text(
            json.dumps(payload, ensure_ascii=False),
            encoding="utf-8",
        )
        stats = IndexStats(
            collection_name=self.settings.collection_name,
            codebase_path=str(self.settings.codebase_path),
            document_count=len(documents),
            chunk_count=len(chunks),
            last_indexed_at=datetime.now(timezone.utc).isoformat(),
            retrieval_mode="lexical",
        )
        self.write_stats(stats)
        return stats

    def load_lexical_chunks(self) -> list[LexicalChunk]:
        """Load persisted lexical chunks."""
        if not self.lexical_index_path.exists():
            raise FileNotFoundError(self.lexical_index_path)
        raw = json.loads(self.lexical_index_path.read_text(encoding="utf-8"))
        return [LexicalChunk(**item) for item in raw]

    def load_index(self) -> VectorStoreIndex:
        """Load the persisted vector store into a LlamaIndex index."""
        self.configure_embedding_model()
        collection = self.client.get_or_create_collection(self.settings.collection_name)
        vector_store = ChromaVectorStore(chroma_collection=collection)
        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        return VectorStoreIndex.from_vector_store(vector_store, storage_context=storage_context)

    def load_or_build_index(self, force_reindex: bool = False) -> tuple[VectorStoreIndex, IndexStats]:
        """Ensure the index exists and return both the index and its stats."""
        if force_reindex or not self.collection_exists():
            stats = self.build_index(force_reindex=force_reindex)
            return self.load_index(), stats

        stats = self.read_stats()
        if stats is None:
            collection = self.client.get_or_create_collection(self.settings.collection_name)
            stats = IndexStats(
                collection_name=self.settings.collection_name,
                codebase_path=str(self.settings.codebase_path),
                document_count=collection.count(),
                chunk_count=collection.count(),
                last_indexed_at=datetime.now(timezone.utc).isoformat(),
                retrieval_mode="vector",
            )
            self.write_stats(stats)
        return self.load_index(), stats

    def _read_text_file(self, file_path: Path) -> str:
        """Read a file with tolerant decoding."""
        for encoding in ("utf-8", "utf-8-sig", "latin-1"):
            try:
                return file_path.read_text(encoding=encoding)
            except UnicodeDecodeError:
                continue
        return file_path.read_text(encoding="utf-8", errors="ignore")

    def _classify_source_type(self, relative_path: str) -> str:
        """Classify files as documentation or code for metadata."""
        lower_path = relative_path.lower()
        if (
            lower_path.endswith((".md", ".txt", ".rst"))
            or "/docs/" in lower_path
            or "guides-data.ts" in lower_path
            or "resources-data.ts" in lower_path
            or "faq.tsx" in lower_path
            or "ptbr.ts" in lower_path
        ):
            return "documentation"
        return "code"

    def _resolve_source_label(self, relative_path: str) -> tuple[str, float]:
        """Map file paths to friendly source labels and retrieval boosts."""
        for suffix, (label, boost) in PRIORITY_LABELS.items():
            if relative_path.endswith(suffix):
                return label, boost
        if "/docs/" in relative_path.replace("\\", "/"):
            return "Project documentation", 0.18
        if "LandingPage/" in relative_path:
            return "Public site content", 0.12
        return Path(relative_path).name, 0.0


def build_parser() -> argparse.ArgumentParser:
    """Create the CLI parser for the indexer script."""
    parser = argparse.ArgumentParser(description="Index the Koma Studio knowledge base.")
    parser.add_argument("--force", action="store_true", help="Rebuild the index from scratch.")
    parser.add_argument("--env-file", type=str, default=None, help="Alternative path to the .env file.")
    return parser


def main() -> int:
    """Run the indexing CLI."""
    parser = build_parser()
    args = parser.parse_args()
    settings = load_settings(args.env_file)
    configure_logging(settings.log_level)
    indexer = CodebaseIndexer(settings)
    try:
        _, stats = indexer.load_or_build_index(force_reindex=args.force)
    except Exception:
        stats = indexer.build_lexical_index()
    print(json.dumps(asdict(stats), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
