"""Exception hierarchy for the translation domain."""


class TranslationError(RuntimeError):
    """Base class for every translation failure.

    Inherits from RuntimeError so existing HTTP boundaries that catch
    RuntimeError keep working while new code catches specific subclasses.
    """


class TranslatorConfigurationError(TranslationError):
    """Provider is not usable: missing credentials or invalid static config."""


class UnsupportedLanguagePairError(TranslationError):
    def __init__(
        self, translator_key: str, source_language: str, target_language: str
    ) -> None:
        self.translator_key = translator_key
        self.source_language = source_language
        self.target_language = target_language
        super().__init__(
            f"{translator_key} does not support {source_language!r} -> {target_language!r}"
        )


class TranslatorUnavailableError(TranslationError):
    """Transport-level failure: DNS, connection refused, timeout."""

    def __init__(self, provider_label: str, reason: str) -> None:
        self.provider_label = provider_label
        self.reason = reason
        super().__init__(f"{provider_label} unavailable: {reason}")


class TranslatorResponseError(TranslationError):
    """Provider answered with an error status or an unparseable body."""

    def __init__(self, provider_label: str, status_code: int, detail: str) -> None:
        self.provider_label = provider_label
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"{provider_label} HTTP {status_code}: {detail}")


class LocalModelError(TranslationError):
    """Local runtime (ctranslate2 / llama.cpp) missing or model files absent."""
