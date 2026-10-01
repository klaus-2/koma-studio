from __future__ import annotations

import unittest
import unittest.mock
from typing import cast

import services.device_fallback as fallback
from core.device import DeviceInfo
from services.device_fallback import (
    CpuFallbackFailedError,
    ExecutionFailedError,
    run_with_cpu_fallback,
)


class _OOM(RuntimeError):
    ...


class DeviceFallbackTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        gpu = cast(DeviceInfo, type("D", (), {"has_gpu": True, "name": "cuda"})())
        cpu = cast(DeviceInfo, type("D", (), {"has_gpu": False, "name": "cpu"})())
        self._cpu = cpu
        # Patch at the consumer module: the runner resolves these names there.
        for patcher in (
            unittest.mock.patch.object(fallback, "build_cpu_device_info", lambda _d, *, fallback_reason: cpu),
            unittest.mock.patch.object(fallback, "release_gpu_memory", lambda: None),
            unittest.mock.patch.object(
                fallback, "is_insufficient_memory_error", lambda e: isinstance(e, _OOM)
            ),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)
        self.device = gpu

    async def test_success_keeps_device(self) -> None:
        async def op(device: DeviceInfo, has_gpu: bool) -> str:
            return f"{device.name}:{has_gpu}"

        outcome = await run_with_cpu_fallback(op, device=self.device, use_gpu=True, stage="t")
        self.assertEqual(outcome.result, "cuda:True")
        self.assertFalse(outcome.fell_back_to_cpu)
        self.assertEqual(outcome.fallback_headers(model_key="m"), {})

    async def test_oom_falls_back_to_cpu(self) -> None:
        calls: list[bool] = []

        async def op(device: DeviceInfo, has_gpu: bool) -> str:
            calls.append(has_gpu)
            if has_gpu:
                raise _OOM("CUDA out of memory")
            return device.name

        outcome = await run_with_cpu_fallback(op, device=self.device, use_gpu=True, stage="t")
        self.assertEqual(calls, [True, False])
        self.assertEqual(outcome.result, "cpu")
        self.assertEqual(
            outcome.fallback_headers(model_key="m")["X-Koma-Execution-Fallback"],
            "gpu_oom_to_cpu",
        )

    async def test_non_oom_raises_execution_failed(self) -> None:
        async def op(device: DeviceInfo, has_gpu: bool) -> str:
            raise ValueError("bad tensor")

        with self.assertRaises(ExecutionFailedError) as ctx:
            await run_with_cpu_fallback(op, device=self.device, use_gpu=True, stage="t")
        self.assertIsInstance(ctx.exception.original, ValueError)

    async def test_cpu_failure_after_oom(self) -> None:
        async def op(device: DeviceInfo, has_gpu: bool) -> str:
            raise _OOM("oom") if has_gpu else RuntimeError("cpu broke")

        with self.assertRaises(CpuFallbackFailedError) as ctx:
            await run_with_cpu_fallback(op, device=self.device, use_gpu=True, stage="t")
        self.assertIsInstance(ctx.exception.gpu_error, _OOM)
        self.assertEqual(str(ctx.exception.cpu_error), "cpu broke")

    async def test_file_not_found_propagates(self) -> None:
        async def op(device: DeviceInfo, has_gpu: bool) -> str:
            raise FileNotFoundError("weights missing")

        with self.assertRaises(FileNotFoundError):
            await run_with_cpu_fallback(op, device=self.device, use_gpu=True, stage="t")


if __name__ == "__main__":
    unittest.main()
