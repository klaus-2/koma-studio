from __future__ import annotations

import ctypes
import sys
from collections.abc import Callable
from functools import cache
from typing import Final

_MCW_DN: Final[int] = 0x03000000
_DN_FLUSH: Final[int] = 0x01000000

type ControlFp = Callable[[int, int], int]


@cache
def _windows_controlfp() -> ControlFp | None:
    if sys.platform != "win32":
        return None
    try:
        controlfp = ctypes.CDLL("ucrtbase")._controlfp
    except (OSError, AttributeError):
        return None
    controlfp.restype = ctypes.c_uint
    controlfp.argtypes = [ctypes.c_uint, ctypes.c_uint]

    def call(new: int, mask: int) -> int:
        return int(controlfp(new, mask))

    return call


def current_thread_flushes_denormals() -> bool:
    controlfp = _windows_controlfp()
    if controlfp is None:
        return False
    return (controlfp(0, 0) & _MCW_DN) == _DN_FLUSH


def flush_denormals_on_current_thread() -> bool:
    controlfp = _windows_controlfp()
    if controlfp is None:
        return False
    controlfp(_DN_FLUSH, _MCW_DN)
    return current_thread_flushes_denormals()
