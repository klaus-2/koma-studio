from __future__ import annotations

from io import BytesIO
import unittest

from fastapi import HTTPException, UploadFile
from pydantic import TypeAdapter

from routers._boundary import parse_json_form_field, read_upload_bytes


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


if __name__ == "__main__":
    unittest.main()
