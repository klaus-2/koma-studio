# detect → mask → inpaint

import numpy as np
from PIL import Image
from models.inpainting.base_inpainter import HDStrategy, InpaintConfig
from models.detection.factory import get_detector
from models.inpainting.factory import get_inpainter
from core.device import DeviceInfo
from schemas.inpainting import CleanRequest, CleanResult

class CleanPipeline:
    def __init__(self, device: DeviceInfo):
        self.device = device
        self.detector = get_detector("text", device.has_gpu)
        self.inpainter = get_inpainter(device.has_gpu, "auto")

    async def run(self, image: Image.Image, request: CleanRequest) -> CleanResult:
        # 1. Detect text regions
        detections = await self.detector.detect(image)

        # 2. Build a mask from the detected regions
        mask = self._build_mask(image.size, detections, request.mask_dilation)

        # 3. Inpainting
        inpaint_config = InpaintConfig(
            hd_strategy=HDStrategy.from_value(request.hd_strategy),
            hd_strategy_resize_limit=int(request.hd_strategy_resize_limit),
            hd_strategy_crop_margin=int(request.hd_strategy_crop_margin),
            hd_strategy_crop_trigger_size=int(request.hd_strategy_crop_trigger_size),
        )
        result_np = await self.inpainter.inpaint(
            np.array(image.convert("RGB")),
            np.array(mask, dtype=np.uint8),
            inpaint_config,
        )
        result = Image.fromarray(result_np)

        return CleanResult(
            image=result,
            detections=detections,
            mask=mask,
            model_used={
                "detector": self.detector.name,
                "inpainter": self.inpainter.name
            }
        )

    def _build_mask(self, size, detections, dilation: int = 3):
        import numpy as np
        import cv2
        mask = np.zeros((size[1], size[0]), dtype=np.uint8)
        for det in detections:
            x1, y1, x2, y2 = det.bbox
            mask[y1:y2, x1:x2] = 255
        if dilation > 0:
            kernel = np.ones((dilation, dilation), np.uint8)
            mask = cv2.dilate(mask, kernel, iterations=2)
        return Image.fromarray(mask)
