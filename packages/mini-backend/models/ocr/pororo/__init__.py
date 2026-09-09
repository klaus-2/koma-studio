from __future__ import annotations

__all__ = ["PororoOcr"]


def __getattr__(name: str):
    if name != "PororoOcr":
        raise AttributeError(name)

    from .main import PororoOcr

    return PororoOcr
