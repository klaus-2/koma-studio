from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path
from typing import Sequence

import numpy as np
import onnxruntime as ort
from PIL import Image

from core.device import get_device_info, get_onnx_execution_providers
from models.ocr.base_ocr import BaseOCR, OCRInputRegion, OCRTextResult
from models.ocr.manga_ocr.storage import resolve_manga_ocr_model_dir

_OCR_BATCH_SIZE = 8

logger = logging.getLogger(__name__)

try:
    import jaconv  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    jaconv = None


class MangaOCRONNX:
    def __init__(
        self,
        encoder_path: str | Path,
        decoder_path: str | Path,
        vocab_path: str | Path,
        providers: Sequence[str],
    ) -> None:
        self.encoder = ort.InferenceSession(str(encoder_path), providers=list(providers))
        self.decoder = ort.InferenceSession(str(decoder_path), providers=list(providers))
        self.vocab = self._load_vocab(vocab_path)

        self.encoder_image_input = self._find_input_name(self.encoder, ("image", "pixel_values", "input"))
        self.encoder_output_name = self.encoder.get_outputs()[0].name
        self.decoder_token_input = self._find_input_name(self.decoder, ("token_ids", "input_ids", "input"))
        self.decoder_encoder_input = self._find_input_name(
            self.decoder,
            ("encoder_hidden_states", "encoder_outputs", "encoder_last_hidden_state"),
        )

    @staticmethod
    def _load_vocab(path: str | Path) -> list[str]:
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read().splitlines()

    @staticmethod
    def _find_input_name(session: ort.InferenceSession, candidates: Sequence[str]) -> str:
        names = [item.name for item in session.get_inputs()]
        for candidate in candidates:
            for name in names:
                if candidate in name:
                    return name
        return names[0]

    @staticmethod
    def _preprocess(image: np.ndarray) -> np.ndarray:
        pil_image = Image.fromarray(image).convert("L").convert("RGB")
        pil_image = pil_image.resize((224, 224), resample=Image.BILINEAR)
        arr = np.asarray(pil_image, dtype=np.float32)
        arr /= 255.0
        arr = (arr - 0.5) / 0.5
        arr = arr.transpose((2, 0, 1)).astype(np.float32)
        return arr[None]

    def _generate(self, image: np.ndarray) -> list[int]:
        encoder_out = self.encoder.run(None, {self.encoder_image_input: image})
        encoder_hidden = encoder_out[0]

        token_ids = [2]
        for _ in range(300):
            decoder_inputs = {
                self.decoder_token_input: np.array([token_ids], dtype=np.int64),
                self.decoder_encoder_input: encoder_hidden,
            }
            logits = self.decoder.run(None, decoder_inputs)[0]
            next_token = int(np.argmax(logits[0, -1, :]))
            token_ids.append(next_token)
            if next_token == 3:
                break
        return token_ids

    def _decode(self, token_ids: list[int]) -> str:
        text = ""
        for token_id in token_ids:
            if token_id < 5:
                continue
            if token_id < len(self.vocab):
                text += self.vocab[token_id]
        return text

    @staticmethod
    def _postprocess(text: str) -> str:
        result = "".join(text.split())
        result = result.replace("…", "...")
        result = re.sub(r"[・.]{2,}", lambda match: "." * len(match.group(0)), result)
        if jaconv is not None:
            result = jaconv.h2z(result, ascii=True, digit=True)
        return result

    def predict(self, image: np.ndarray) -> str:
        x = self._preprocess(image)
        token_ids = self._generate(x)
        raw = self._decode(token_ids)
        return self._postprocess(raw)


class MangaOCROnnxEngine(BaseOCR):
    key = "manga_ocr"
    name = "Manga OCR (ONNX)"

    def __init__(
        self,
        providers: Sequence[str] | None = None,
        expansion_percentage: int = 5,
        model_dir: str | Path | None = None,
    ) -> None:
        self.expansion_percentage = max(0, expansion_percentage)
        if model_dir is not None:
            self.model_dir = Path(model_dir).expanduser().resolve()
        else:
            resolved_dir = resolve_manga_ocr_model_dir()
            if resolved_dir is None:
                raise RuntimeError(
                    "Managed models directory is not configured for Manga OCR. "
                    "Verifique KOMA_MODELS_ROOT.",
                )
            self.model_dir = resolved_dir
        self.providers = list(providers) if providers else get_onnx_execution_providers(get_device_info())
        self.model: MangaOCRONNX | None = None

    def _ensure_model(self) -> None:
        if self.model is not None:
            return
        encoder_path = self.model_dir / "encoder_model.onnx"
        decoder_path = self.model_dir / "decoder_model.onnx"
        vocab_path = self.model_dir / "vocab.txt"
        if not encoder_path.exists() or not decoder_path.exists() or not vocab_path.exists():
            raise FileNotFoundError(
                f"manga_ocr models not found in {self.model_dir}",
            )
        self.model = MangaOCRONNX(
            encoder_path=encoder_path,
            decoder_path=decoder_path,
            vocab_path=vocab_path,
            providers=self.providers,
        )

    def _expand_box(
        self,
        bbox: tuple[int, int, int, int],
        width: int,
        height: int,
    ) -> tuple[int, int, int, int]:
        x1, y1, x2, y2 = bbox
        box_w = max(1, x2 - x1)
        box_h = max(1, y2 - y1)
        dx = int(box_w * self.expansion_percentage / 100.0)
        dy = int(box_h * self.expansion_percentage / 100.0)
        nx1 = max(0, x1 - dx)
        ny1 = max(0, y1 - dy)
        nx2 = min(width, x2 + dx)
        ny2 = min(height, y2 + dy)
        return nx1, ny1, nx2, ny2

    def _recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "en",
    ) -> list[OCRTextResult]:
        self._ensure_model()
        assert self.model is not None

        rgb = np.asarray(image.convert("RGB"))
        img_h, img_w = rgb.shape[:2]
        results: list[OCRTextResult] = []

        for region in regions:
            x1, y1, x2, y2 = self._expand_box(region.bbox, img_w, img_h)
            if x2 <= x1 or y2 <= y1:
                text = ""
            else:
                crop = rgb[y1:y2, x1:x2]
                try:
                    text = self.model.predict(crop)
                except Exception as exc:
                    exc_msg = str(exc).lower()
                    if "allocate memory" in exc_msg or "out of memory" in exc_msg or "bfc_arena" in exc_msg:
                        import gc
                        gc.collect()
                        raise RuntimeError(
                            f"Failed to allocate memory for requested buffer "
                            f"during manga_ocr inference: {exc}"
                        ) from exc
                    text = ""

            score = 1.0 if text else 0.0
            results.append(
                OCRTextResult(
                    id=region.id,
                    bbox=region.bbox,
                    text=text,
                    score=score,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    model_key=self.key,
                ),
            )

        return results

    def _process_batch_sync(
        self,
        rgb: np.ndarray,
        img_w: int,
        img_h: int,
        batch: list[OCRInputRegion],
    ) -> list[OCRTextResult]:
        """Process a batch of regions synchronously.  Meant to be called via
        ``asyncio.to_thread`` so that the event loop is **not** blocked during
        ONNX inference.

        If an OOM / allocation failure is detected the error is **re-raised**
        so that the caller (``ocr.py``) can trigger the CPU fallback path.
        """
        import gc

        assert self.model is not None
        results: list[OCRTextResult] = []
        for region in batch:
            x1, y1, x2, y2 = self._expand_box(region.bbox, img_w, img_h)
            if x2 <= x1 or y2 <= y1:
                text = ""
            else:
                crop = rgb[y1:y2, x1:x2]
                try:
                    text = self.model.predict(crop)
                except Exception as exc:
                    exc_msg = str(exc).lower()
                    if "allocate memory" in exc_msg or "out of memory" in exc_msg or "bfc_arena" in exc_msg:
                        # OOM — force GC and propagate so the endpoint can
                        # fall back to CPU.
                        logger.error("manga_ocr OOM during predict: %s", exc)
                        gc.collect()
                        raise RuntimeError(
                            f"Failed to allocate memory for requested buffer "
                            f"during manga_ocr inference: {exc}"
                        ) from exc
                    logger.warning("manga_ocr predict failed for region %s: %s", region.id, exc)
                    text = ""

            score = 1.0 if text else 0.0
            results.append(
                OCRTextResult(
                    id=region.id,
                    bbox=region.bbox,
                    text=text,
                    score=score,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    model_key=self.key,
                ),
            )
        return results

    def _release_gpu_sessions(self) -> None:
        """Destroy the ONNX sessions to free GPU VRAM after an OOM error.

        A fresh model will be re-created on the next ``_ensure_model`` call
        (possibly with CPU-only providers via the fallback path in ``ocr.py``).
        """
        import gc

        if self.model is not None:
            try:
                del self.model.encoder
                del self.model.decoder
            except Exception:
                pass
            self.model = None
        gc.collect()
        logger.info("manga_ocr GPU sessions released after OOM")

    async def recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "en",
        *,
        cancellation_event: asyncio.Event | None = None,
    ) -> list[OCRTextResult]:
        """Async recognize that processes regions in batches.

        Each batch runs in a **thread executor** via ``asyncio.to_thread`` so
        the event loop stays free for disconnect detection, timeout enforcement,
        and other async tasks.  Between batches we check the cancellation event.

        If an OOM error is detected during inference, the ONNX sessions are
        released and the error is propagated so the caller can fall back to CPU.
        """
        self._ensure_model()
        assert self.model is not None

        rgb = np.asarray(image.convert("RGB"))
        img_h, img_w = rgb.shape[:2]
        results: list[OCRTextResult] = []
        batch_size = max(1, _OCR_BATCH_SIZE)

        total_regions = len(regions)
        logger.info(
            "manga_ocr recognize started regions=%d batch_size=%d image=%dx%d",
            total_regions,
            batch_size,
            img_w,
            img_h,
        )

        try:
            for batch_start in range(0, total_regions, batch_size):
                # --- Check cancellation before starting a new batch ---
                if cancellation_event is not None and cancellation_event.is_set():
                    for region in regions[batch_start:]:
                        results.append(
                            OCRTextResult(
                                id=region.id,
                                bbox=region.bbox,
                                text="",
                                score=0.0,
                                source=region.source,
                                detector_model_key=region.detector_model_key,
                                model_key=self.key,
                            ),
                        )
                    logger.info(
                        "manga_ocr recognize cancelled at batch_start=%d/%d",
                        batch_start,
                        total_regions,
                    )
                    break

                batch = regions[batch_start : batch_start + batch_size]

                # Run the synchronous ONNX inference in a thread so the event
                # loop remains responsive (timeouts, disconnect monitor, etc.).
                batch_results = await asyncio.to_thread(
                    self._process_batch_sync, rgb, img_w, img_h, batch
                )
                results.extend(batch_results)

                logger.info(
                    "manga_ocr batch done %d/%d",
                    min(batch_start + batch_size, total_regions),
                    total_regions,
                )
        except (RuntimeError, Exception) as exc:
            exc_msg = str(exc).lower()
            if "allocate memory" in exc_msg or "out of memory" in exc_msg or "bfc_arena" in exc_msg:
                logger.error("manga_ocr OOM — releasing GPU sessions: %s", exc)
                self._release_gpu_sessions()
            raise

        return results
