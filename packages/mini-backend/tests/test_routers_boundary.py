from __future__ import annotations

from io import BytesIO
import unittest

from fastapi import HTTPException, UploadFile
from models.execution import InferenceBusyError
from pydantic import TypeAdapter

from routers._boundary import (
    INFERENCE_BUSY_HTTP_STATUS,
    INFERENCE_BUSY_WIRE_CODE,
    inference_busy_to_http,
    parse_json_form_field,
    read_upload_bytes,
)


class ReadUploadBytesTests(unittest.IsolatedAsyncioTestCase):
    async def test_rejects_over_limit(self) -> None:
        upload = UploadFile(BytesIO(b"x" * (2 * 1024 * 1024 + 1)), filename="big.bin")
        with self.assertRaises(HTTPException) as ctx:
            await read_upload_bytes(upload, limit_bytes=2 * 1024 * 1024)
        self.assertEqual(ctx.exception.status_code, 413)

    async def test_exact_limit_passes(self) -> None:
        upload = UploadFile(BytesIO(b"x" * 1024), filename="ok.bin")
        payload = await read_upload_bytes(upload, limit_bytes=1024)
        self.assertEqual(len(payload), 1024)

    async def test_empty_stream_returns_empty(self) -> None:
        upload = UploadFile(BytesIO(b""), filename="empty.bin")
        self.assertEqual(await read_upload_bytes(upload, limit_bytes=1024), b"")


class ParseJsonFormFieldTests(unittest.TestCase):
    def test_blank_is_none(self) -> None:
        self.assertIsNone(
            parse_json_form_field("   ", TypeAdapter(list[int]), field_name="f")
        )
        self.assertIsNone(
            parse_json_form_field(None, TypeAdapter(list[int]), field_name="f")
        )

    def test_invalid_is_422(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            parse_json_form_field('[1, "a"]', TypeAdapter(list[int]), field_name="regions")
        self.assertEqual(ctx.exception.status_code, 422)
        detail = ctx.exception.detail
        assert isinstance(detail, dict)
        self.assertEqual(detail["field"], "regions")

    def test_valid_payload_round_trips(self) -> None:
        parsed = parse_json_form_field("[1, 2]", TypeAdapter(list[int]), field_name="f")
        self.assertEqual(parsed, [1, 2])


class InferenceBusyToHttpTests(unittest.TestCase):
    """The busy wire signal: dedicated 503 status, conventional body, own code."""

    def test_maps_busy_to_dedicated_503_wire_signal(self) -> None:
        http_exc = inference_busy_to_http(
            InferenceBusyError("Inference capacity is exhausted"),
            stage="detect",
            model_key=None,
        )
        self.assertEqual(http_exc.status_code, INFERENCE_BUSY_HTTP_STATUS)
        self.assertEqual(http_exc.status_code, 503)
        detail = http_exc.detail
        assert isinstance(detail, dict)
        self.assertEqual(detail["code"], INFERENCE_BUSY_WIRE_CODE)
        self.assertNotEqual(detail["code"], "RUNTIME_ERROR")
        self.assertEqual(detail["stage"], "detect")
        self.assertEqual(detail["model_key"], "auto")
        self.assertEqual(detail["raw_detail"], "Inference capacity is exhausted")
        self.assertIn("busy", str(detail["error"]).lower())

    def test_keeps_the_requested_model_key_in_the_body(self) -> None:
        http_exc = inference_busy_to_http(
            InferenceBusyError("Inference capacity is exhausted"),
            stage="inpaint",
            model_key=" auto ",
        )
        detail = http_exc.detail
        assert isinstance(detail, dict)
        self.assertEqual(detail["stage"], "inpaint")
        self.assertEqual(detail["model_key"], "auto")


if __name__ == "__main__":
    unittest.main()
