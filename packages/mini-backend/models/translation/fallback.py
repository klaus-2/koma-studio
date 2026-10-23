"""Ordered provider-fallback routing for translation.

`get_translation_engine` never raises for an unknown or unavailable non-local
key — it silently swaps in the default engine (factory.py). An explicitly
requested local key without a runtime raises `InvalidModelSelectionError`
instead of substituting a cloud engine, and a typo inside a chain is caught by
`validate_translation_chain_keys` before resolving.
"""

from __future__ import annotations

import datetime
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Final, Generic, TypeVar

from core.config import normalize_stage_model_key
from models.translation.base_translator import BaseTranslator
from models.translation.errors import (
    EmptyTranslationError,
    LocalModelError,
    TranslationError,
    TranslatorConfigurationError,
    TranslatorResponseError,
    TranslatorUnavailableError,
)
from models.translation.factory import TranslationModelOption, list_translation_models


T = TypeVar("T")

# Transport/provider hedges are worth another engine; config and language-pair
# errors are the client's to fix, so re-raising them is the honest answer. An
# engine that answered with nothing usable is worth another engine too.
_RETRYABLE_ERRORS: Final[tuple[type[TranslationError], ...]] = (
    TranslatorUnavailableError,
    TranslatorResponseError,
    LocalModelError,
    EmptyTranslationError,
)


@dataclass(frozen=True, slots=True)
class FallbackAttempt:
    model_key: str
    ok: bool
    error_class: str | None
    error_detail: str


@dataclass(frozen=True, slots=True)
class FallbackResult(Generic[T]):
    value: T
    engine_key: str
    attempts: list[FallbackAttempt]


class TranslationFallbackError(TranslationError):
    """Every engine offered by the chain failed."""

    def __init__(self, attempts: Sequence[FallbackAttempt]) -> None:
        self.attempts = list(attempts)
        detail = ", ".join(
            f"{attempt.model_key} -> {attempt.error_class}: {attempt.error_detail}"
            for attempt in self.attempts
        ) or "no candidate was attempted"
        super().__init__(f"Translation fallback chain exhausted ({detail})")


def _today() -> datetime.date:
    """Local calendar day source; patched by tests (the repo has no freezegun)."""
    return datetime.date.today()


class QuotaBlocklist:
    """Providers that were unreachable today, kept in memory per process."""

    def __init__(self) -> None:
        self._blocked_on: dict[str, datetime.date] = {}

    def block(self, key: str) -> None:
        self._blocked_on[key] = _today()

    def is_blocked(self, key: str) -> bool:
        blocked_on = self._blocked_on.get(key)
        if blocked_on is None:
            return False
        if blocked_on == _today():
            return True
        del self._blocked_on[key]
        return False


def _is_retryable(exc: TranslationError) -> bool:
    return isinstance(exc, _RETRYABLE_ERRORS)


def validate_translation_chain_keys(keys: Sequence[str]) -> tuple[str, ...]:
    """Return the normalized keys, failing fast on anything unusable.

    A key is accepted only when the registry lists it as implemented and
    available; otherwise `TranslatorConfigurationError` is raised before any
    network or model load happens.
    """
    options = {option["key"]: option for option in list_translation_models()}
    validated: list[str] = []
    for raw_key in keys:
        key = normalize_stage_model_key("translation", raw_key)
        option: TranslationModelOption | None = options.get(key)
        if option is None:
            raise TranslatorConfigurationError(
                f"Unknown translation engine in fallback chain: {raw_key!r}"
            )
        if not option["implemented"]:
            raise TranslatorConfigurationError(
                f"Translation engine {key!r} is declared but not implemented"
            )
        if not option["available"]:
            raise TranslatorConfigurationError(
                f"Translation engine {key!r} is not available (model missing or API key unset)"
            )
        validated.append(key)
    return tuple(validated)


async def translate_with_fallback(
    keys: Sequence[str],
    *,
    resolve: Callable[[str], BaseTranslator],
    translate: Callable[[BaseTranslator], Awaitable[T]],
    quota_blocklist: QuotaBlocklist | None = None,
) -> FallbackResult[T]:
    """Run `translate` over the engines for `keys` until one succeeds.

    `keys` must already be validated (see `validate_translation_chain_keys`):
    this helper resolves whatever it is handed, trusting the caller.
    """
    attempts: list[FallbackAttempt] = []
    last_error: TranslationError | None = None

    for key in keys:
        if quota_blocklist is not None and quota_blocklist.is_blocked(key):
            continue
        engine = resolve(key)
        try:
            value = await translate(engine)
        except TranslationError as exc:
            if not _is_retryable(exc):
                raise
            if quota_blocklist is not None and isinstance(exc, TranslatorUnavailableError):
                quota_blocklist.block(key)
            attempts.append(
                FallbackAttempt(
                    model_key=key,
                    ok=False,
                    error_class=type(exc).__name__,
                    error_detail=str(exc),
                )
            )
            last_error = exc
            continue
        attempts.append(
            FallbackAttempt(model_key=key, ok=True, error_class=None, error_detail="")
        )
        return FallbackResult(value=value, engine_key=key, attempts=attempts)

    raise TranslationFallbackError(attempts) from last_error
