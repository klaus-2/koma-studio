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


class EmptyTranslationError(TranslationError):
    """The engine answered, but not one region came back translated.

    Providers that retry per region may give up and return empty text; without
    this the stage looks successful with zero blocks and the only trace is a
    warning in the sidecar log.
    """

    def __init__(self, translator_key: str, region_count: int) -> None:
        self.translator_key = translator_key
        self.region_count = region_count
        super().__init__(
            f"{translator_key} returned no translation for any of the "
            f"{region_count} region(s) it was asked to translate."
        )


class InvalidModelSelectionError(TranslationError):
    """The caller explicitly selected a local model that cannot run here."""

    def __init__(self, model_key: str, reason: str) -> None:
        self.model_key = model_key
        self.reason = reason
        super().__init__(f"Translation model {model_key!r} cannot be used: {reason}")
