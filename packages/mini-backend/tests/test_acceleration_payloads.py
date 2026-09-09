from __future__ import annotations

from pathlib import Path
import sys
import unittest


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.device import DeviceInfo, build_device_payload


class DevicePayloadTests(unittest.TestCase):
    def test_build_device_payload_includes_profile_and_capabilities(self) -> None:
        payload = build_device_payload(
            DeviceInfo(
                name="Apple M3 Max",
                has_gpu=True,
                onnx_provider="CoreMLExecutionProvider",
                available_onnx_providers=("CoreMLExecutionProvider", "CPUExecutionProvider"),
                vram_gb=36.0,
                acceleration_profile="apple-mps",
                fallback_reason="coreml_only_for_onnx",
                supported_model_families=("ocr", "translation", "detection"),
            ),
        )

        self.assertEqual(
            payload,
            {
                "name": "Apple M3 Max",
                "has_gpu": True,
                "provider": "CoreMLExecutionProvider",
                "available_providers": ["CoreMLExecutionProvider", "CPUExecutionProvider"],
                "vram_gb": 36.0,
                "profile": "apple-mps",
                "fallback_reason": "coreml_only_for_onnx",
                "supported_model_families": ["ocr", "translation", "detection"],
                "nvidia_cuda_available": False,
                "nvidia_tensorrt_available": False,
                "intel_openvino_available": False,
                "amd_rocm_available": False,
            },
        )


if __name__ == "__main__":
    unittest.main()
