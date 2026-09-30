"""Structural type for decoded JSON. Enables isinstance narrowing under strict typing."""

type JsonValue = (
    dict[str, JsonValue] | list[JsonValue] | str | int | float | bool | None
)
