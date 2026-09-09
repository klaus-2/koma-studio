"""RAG engine powered by LlamaIndex retrieval and free-cloud provider routing."""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from time import perf_counter
import asyncio
import re

from llama_index.core import Settings
from llama_index.core.base.base_retriever import BaseRetriever
from llama_index.core.schema import NodeWithScore, QueryBundle

from config import Settings as BotSettings
from indexer import CodebaseIndexer, IndexStats, LexicalChunk
from language_utils import (
    detect_answer_language,
    detect_language,
    localized_timeout_message,
    localized_unknown_message,
)
from provider_router import ProviderRouter
from utils.logger import get_logger


BASE_SYSTEM_PROMPT = """
You are the official Koma Assistant for KŌMA Studio. You speak directly to END USERS, not developers.

PURPOSE:
1. Answer product questions about how KŌMA Studio works.
2. Teach users how to use features with clear step-by-step guidance.
3. Provide technical support in simple language.
4. When the user asks about general design/productivity topics related to KŌMA Studio's niche, help usefully while making clear what is official product knowledge and what is general best practice.

ABSOLUTE RULES:
1. Use only the retrieved KŌMA Studio context as the source of truth for product behavior, buttons, screens, plans, limits, and workflows.
2. Never invent screens, buttons, formats, flows, or settings that do not exist in the retrieved context.
3. Translate technical concepts into friendly language for regular users.
4. Do not expose secrets, tokens, passwords, raw credentials, or large blocks of source code.
5. Do not show raw code paths unless it is strictly necessary for advanced support. Prefer friendly document names such as "Quick Start Guide" or "Dashboard help".
6. For tutorials, prefer numbered steps.
7. If the context is insufficient to answer a product-specific question, reply with exactly the localized fallback message provided below.
8. Always answer in {response_language_label}.
"""


@dataclass(slots=True)
class AnswerResult:
    """Structured answer returned by the RAG engine."""

    answer: str
    sources: list[str]
    latency_ms: int
    language_code: str
    provider_id: str | None = None
    provider_name: str | None = None
    provider_model: str | None = None
    failover_count: int = 0
    timed_out: bool = False


class PriorityRetriever(BaseRetriever):
    """Boost user-facing documents before synthesis."""

    def __init__(self, base_retriever: BaseRetriever, top_k: int) -> None:
        super().__init__(callback_manager=Settings.callback_manager)
        self.base_retriever = base_retriever
        self.top_k = top_k

    def _retrieve(self, query_bundle: QueryBundle) -> list[NodeWithScore]:
        nodes = self.base_retriever.retrieve(query_bundle)
        rescored: list[NodeWithScore] = []
        for node in nodes:
            boost = float(node.node.metadata.get("priority_boost", 0.0) or 0.0)
            node.score = float(node.score or 0.0) + boost
            rescored.append(node)
        rescored.sort(key=lambda item: float(item.score or 0.0), reverse=True)
        return rescored[: self.top_k]


class RAGEngine:
    """Manage index lifecycle, retrieval, conversation history, and provider routing."""

    def __init__(self, settings: BotSettings) -> None:
        self.settings = settings
        self.logger = get_logger(__name__)
        self.indexer = CodebaseIndexer(settings)
        self.provider_router = ProviderRouter(settings)
        self.histories: dict[int, deque[tuple[str, str]]] = defaultdict(
            lambda: deque(maxlen=self.settings.message_history_limit),
        )
        self._retriever: PriorityRetriever | None = None
        self._lexical_chunks: list[LexicalChunk] = []
        self._stats: IndexStats | None = None
        self._build_lock = asyncio.Lock()
        self._query_lock = asyncio.Lock()

    async def ensure_ready(self, force_reindex: bool = False) -> None:
        """Ensure the retriever exists and the index is loaded."""
        async with self._build_lock:
            if (self._retriever is not None or self._lexical_chunks) and not force_reindex:
                return
            await asyncio.to_thread(self._initialize_sync, force_reindex)

    async def answer_question(
        self,
        user_id: int,
        question: str,
        intent: str = "support",
        preferred_locale: str | None = None,
    ) -> AnswerResult:
        """Answer a user question using retrieval and provider failover."""
        await self.ensure_ready()
        language = detect_language(question, preferred_locale=preferred_locale)
        started_at = perf_counter()
        try:
            async with self._query_lock:
                answer, sources, provider_meta, final_language_code = await asyncio.wait_for(
                    asyncio.to_thread(
                        self._query_sync,
                        user_id,
                        question,
                        intent,
                        language.code,
                        language.label,
                    ),
                    timeout=self.settings.request_timeout_seconds,
                )
        except asyncio.TimeoutError:
            latency_ms = int((perf_counter() - started_at) * 1000)
            self.logger.warning(
                "RAG request timed out",
                extra={"user_id": user_id, "intent": intent, "timeout_seconds": self.settings.request_timeout_seconds},
            )
            return AnswerResult(
                answer=localized_timeout_message(language.code),
                sources=[],
                latency_ms=latency_ms,
                language_code=language.code,
                timed_out=True,
            )

        latency_ms = int((perf_counter() - started_at) * 1000)
        self._append_history(user_id, "user", question)
        self._append_history(user_id, "assistant", answer)
        self.logger.info(
            "RAG answer generated",
            extra={
                "user_id": user_id,
                "intent": intent,
                "latency_ms": latency_ms,
                "source_count": len(sources),
                "language_code": final_language_code,
                **provider_meta,
            },
        )
        return AnswerResult(
            answer=answer,
            sources=sources,
            latency_ms=latency_ms,
            language_code=final_language_code,
            provider_id=provider_meta.get("provider_id"),
            provider_name=provider_meta.get("provider_name"),
            provider_model=provider_meta.get("provider_model"),
            failover_count=int(provider_meta.get("failover_count", 0) or 0),
        )

    async def rebuild_index(self) -> IndexStats:
        """Force a fresh reindex of the configured codebase."""
        async with self._build_lock:
            await asyncio.to_thread(self._initialize_sync, True)
        return self._stats or IndexStats(
            collection_name=self.settings.collection_name,
            codebase_path=str(self.settings.codebase_path),
            document_count=0,
            chunk_count=0,
            last_indexed_at="",
        )

    def get_status(self) -> dict[str, object]:
        """Return current index status plus provider routing info."""
        stats = self._stats or self.indexer.read_stats()
        return {
            "ready": self._retriever is not None or bool(self._lexical_chunks),
            "collection_name": stats.collection_name if stats else self.settings.collection_name,
            "codebase_path": stats.codebase_path if stats else str(self.settings.codebase_path),
            "document_count": stats.document_count if stats else 0,
            "chunk_count": stats.chunk_count if stats else 0,
            "last_indexed_at": stats.last_indexed_at if stats else "never",
            "retrieval_mode": stats.retrieval_mode if stats else "unknown",
            "configured_providers": self.provider_router.list_configured_provider_ids(),
        }

    def clear_history(self, user_id: int) -> bool:
        """Clear cached conversation history for a specific user."""
        if user_id not in self.histories:
            return False
        self.histories.pop(user_id, None)
        return True

    def _initialize_sync(self, force_reindex: bool) -> None:
        """Load or build the index and create the retriever."""
        try:
            index, stats = self.indexer.load_or_build_index(force_reindex=force_reindex)
            base_retriever = index.as_retriever(
                similarity_top_k=max(self.settings.top_k_results * 3, self.settings.top_k_results),
            )
            self._retriever = PriorityRetriever(base_retriever, top_k=self.settings.top_k_results)
            self._lexical_chunks = []
            self._stats = stats
            self.logger.info(
                "RAG retriever ready",
                extra={
                    "force_reindex": force_reindex,
                    "document_count": stats.document_count,
                    "chunk_count": stats.chunk_count,
                    "retrieval_mode": "vector",
                },
            )
            return
        except Exception as exc:  # noqa: BLE001
            self.logger.warning(
                "Vector index unavailable, falling back to lexical retrieval",
                extra={"error": str(exc), "force_reindex": force_reindex},
            )

        if force_reindex or not self.indexer.lexical_index_path.exists():
            stats = self.indexer.build_lexical_index()
        else:
            stats = self.indexer.read_stats()
            if stats is None or stats.retrieval_mode != "lexical":
                stats = self.indexer.build_lexical_index()
        self._retriever = None
        self._lexical_chunks = self.indexer.load_lexical_chunks()
        self._stats = stats
        self.logger.info(
            "Lexical retriever ready",
            extra={
                "force_reindex": force_reindex,
                "document_count": stats.document_count,
                "chunk_count": stats.chunk_count,
                "retrieval_mode": "lexical",
            },
        )

    def _query_sync(
        self,
        user_id: int,
        question: str,
        intent: str,
        response_language_code: str,
        response_language_label: str,
    ) -> tuple[str, list[str], dict[str, object], str]:
        """Execute retrieval and synthesize an answer via provider routing."""
        if self._retriever is None:
            query_text = self._build_query_text(user_id, question, intent)
            sources, context = self._lexical_retrieve(query_text)
        else:
            query_text = self._build_query_text(user_id, question, intent)
            source_nodes = self._retriever.retrieve(query_text)
            sources = self._collect_sources(source_nodes)
            context = self._build_context(source_nodes)
        if not context:
            return localized_unknown_message(response_language_code), [], {}, response_language_code

        system_prompt = BASE_SYSTEM_PROMPT.format(response_language_label=response_language_label)
        user_prompt = self._build_generation_prompt(
            question=question,
            intent=intent,
            response_language_code=response_language_code,
            context=context,
            history=self.histories.get(user_id),
        )
        try:
            routed = self.provider_router.generate(system_prompt=system_prompt, user_prompt=user_prompt)
        except Exception as exc:  # noqa: BLE001
            self.logger.exception("Provider routing failed", exc_info=exc)
            return localized_unknown_message(response_language_code), sources, {}, response_language_code

        answer = routed.text.strip() or localized_unknown_message(response_language_code)
        final_language = detect_answer_language(answer, requested_locale=response_language_code)
        return answer, sources, {
            "provider_id": routed.provider_id,
            "provider_name": routed.provider_name,
            "provider_model": routed.model,
            "failover_count": routed.failover_count,
        }, final_language.code

    def _build_query_text(self, user_id: int, question: str, intent: str) -> str:
        """Compose the retrieval query with recent conversation context."""
        history = self.histories.get(user_id)
        history_lines: list[str] = []
        if history:
            history_lines = [f"{speaker}: {content}" for speaker, content in history]
        tutorial_hint = ""
        if intent == "tutorial":
            tutorial_hint = (
                "The user wants a step-by-step tutorial. Prefer concrete instructions, real feature names, and numbered guidance."
            )
        elif intent == "error":
            tutorial_hint = (
                "The user is reporting a problem. Focus retrieval on troubleshooting, errors, limits, and actionable diagnostics."
            )
        history_block = "\n".join(history_lines) if history_lines else "No recent history."
        return (
            f"{tutorial_hint}\n\n"
            f"Recent user history:\n{history_block}\n\n"
            f"Current question:\n{question}"
        ).strip()

    def _build_context(self, source_nodes: list[NodeWithScore]) -> str:
        """Render retrieved nodes into a compact context block."""
        blocks: list[str] = []
        for node in source_nodes:
            text = node.node.get_content().strip()
            if not text:
                continue
            label = str(node.node.metadata.get("source_label") or node.node.metadata.get("source_path") or "Koma Studio")
            blocks.append(f"[{label}]\n{text}")
        return "\n\n---\n\n".join(blocks)

    def _build_generation_prompt(
        self,
        *,
        question: str,
        intent: str,
        response_language_code: str,
        context: str,
        history: deque[tuple[str, str]] | None,
    ) -> str:
        """Compose the final prompt passed to the current provider."""
        history_lines = "\n".join(f"{speaker}: {content}" for speaker, content in (history or []))
        localized_fallback = localized_unknown_message(response_language_code)
        general_topic_hint = (
            "If the user is asking for general advice related to KŌMA's niche and the product context is partial, "
            "you may answer with general best practice, but explicitly separate official product facts from general advice."
        )
        tutorial_hint = ""
        if intent == "tutorial":
            tutorial_hint = "The answer should be a numbered tutorial with practical steps."
        elif intent == "error":
            tutorial_hint = "The answer should diagnose the likely cause and propose direct next steps."

        return (
            f"{tutorial_hint}\n"
            f"{general_topic_hint}\n\n"
            f"IMPORTANT: write the answer entirely in locale `{response_language_code}`. "
            "Do not switch to English unless the user's message is clearly in English.\n\n"
            f"Localized fallback if context is insufficient for a product-specific answer:\n{localized_fallback}\n\n"
            f"Recent conversation:\n{history_lines or 'No recent conversation.'}\n\n"
            f"Retrieved KŌMA Studio context:\n{context}\n\n"
            f"User question:\n{question}\n"
        ).strip()

    def _collect_sources(self, source_nodes: list[NodeWithScore]) -> list[str]:
        """Return friendly source labels from retrieved nodes."""
        sources: list[str] = []
        for node in source_nodes:
            metadata = node.node.metadata
            source_label = str(metadata.get("source_label") or metadata.get("source_path") or "").strip()
            if source_label and source_label not in sources:
                sources.append(source_label)
        return sources

    def _append_history(self, user_id: int, speaker: str, content: str) -> None:
        """Append a conversation turn to the bounded user history."""
        self.histories[user_id].append((speaker, content))

    def _lexical_retrieve(self, query_text: str) -> tuple[list[str], str]:
        """Retrieve context via lexical overlap when embeddings are unavailable."""
        query_tokens = set(re.findall(r"[a-z0-9_]{2,}", query_text.lower()))
        scored: list[tuple[float, LexicalChunk]] = []
        for chunk in self._lexical_chunks:
            text_tokens = set(re.findall(r"[a-z0-9_]{2,}", chunk.text.lower()))
            overlap = len(query_tokens & text_tokens)
            if overlap == 0:
                continue
            boost = float(chunk.metadata.get("priority_boost", 0.0) or 0.0)
            score = float(overlap) + (boost * 100.0)
            scored.append((score, chunk))
        scored.sort(key=lambda item: item[0], reverse=True)
        selected = [chunk for _, chunk in scored[: self.settings.top_k_results]]
        sources: list[str] = []
        blocks: list[str] = []
        for chunk in selected:
            label = str(chunk.metadata.get("source_label") or chunk.metadata.get("source_path") or "Koma Studio").strip()
            if label and label not in sources:
                sources.append(label)
            blocks.append(f"[{label}]\n{chunk.text}")
        return sources, "\n\n---\n\n".join(blocks)
