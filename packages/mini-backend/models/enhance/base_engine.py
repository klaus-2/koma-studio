from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np


class BaseEnhancer(ABC):
    key: str
    scale: int

    @abstractmethod
    async def enhance(self, image: np.ndarray) -> np.ndarray:
        raise NotImplementedError
