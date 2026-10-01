"""Boundary models for cloud-provider configuration endpoints."""

from __future__ import annotations

from typing import Self

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator, model_validator
from pydantic.alias_generators import to_camel


class _ProviderInput(BaseModel):
    # Clients send camelCase (apiBase) or snake_case (api_base); both are accepted.
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
        str_strip_whitespace=True,
    )

    api_key: SecretStr | None = None

    @field_validator("api_key", mode="before")
    @classmethod
    def _blank_key_is_absent(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    def api_key_value(self) -> str | None:
        return None if self.api_key is None else self.api_key.get_secret_value()


class ProviderTestRequest(_ProviderInput):
    transport: str = Field(min_length=1)
    stage: str = Field(min_length=1)
    api_base: str = Field(min_length=1)
    model: str = Field(min_length=1)

    @field_validator("transport", "stage")
    @classmethod
    def _lowercase(cls, value: str) -> str:
        return value.lower()

    @model_validator(mode="after")
    def _gemini_requires_key(self) -> Self:
        if self.transport == "gemini_native" and self.api_key is None:
            raise ValueError("An API key is required for Gemini")
        return self


class CustomLlmConfig(_ProviderInput):
    api_base: str = Field(min_length=1)
    model: str | None = None

    @field_validator("model", mode="before")
    @classmethod
    def _blank_model_is_absent(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value


class ProviderTestResponse(BaseModel):
    ok: bool
    message: str
    model: str
    status: int | None = None


class ProviderModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str
    kind: str = Field(default="model", alias="object")
    created: int = 0


class ProviderModelsResponse(BaseModel):
    available: bool
    models: list[ProviderModel] = Field(default_factory=list)
    count: int = 0
    error: str | None = None

    @classmethod
    def failure(cls, error: str) -> ProviderModelsResponse:
        return cls(available=False, error=error)


class VisionProbeResponse(BaseModel):
    vision_supported: bool
    model: str
    error: str | None = None
