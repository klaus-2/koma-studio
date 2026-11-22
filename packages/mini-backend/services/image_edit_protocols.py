from __future__ import annotations

import asyncio
import base64
import binascii
import ipaddress
import re
import time
from typing import Final

import httpx

from services.http_client import get_shared_client

_POLL_INTERVAL_SECONDS: Final = 2.0
_POLL_DEADLINE_SECONDS: Final = 180.0
_MAX_REDIRECTS: Final = 3
_MAX_DOWNLOAD_BYTES: Final = 32 * 1024 * 1024
_IMAGE_MAGIC: Final = (b"\x89PNG", b"\xff\xd8", b"RIFF", b"GIF8")
_PNG_MIME = "image/png"
_REPLICATE_INLINE_IMAGE_LIMIT: Final = 700 * 1024
_REPLICATE_VERSION_HEX: Final = re.compile(r"^[0-9a-f]{64}$", re.IGNORECASE)
_CLOUDFLARE_RETRY_STATUSES: Final = frozenset({400, 422})


class ImageEditProtocolError(RuntimeError):
    """The provider answered, but not with a usable edited image."""


async def _polite_sleep(seconds: float) -> None:
    await asyncio.sleep(seconds)


def _text_detail(value: object, limit: int = 300) -> str:
    collapsed = " ".join(str(value or "").split())
    if len(collapsed) <= limit:
        return collapsed
    return collapsed[: limit - 1].rstrip() + "…"


def _json_body(response: httpx.Response) -> dict[str, object]:
    try:
        parsed = response.json()
    except ValueError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _host_root_api_base(api_base: str) -> str:
    """Provider paths are built from the host root, so a trailing `/v1` is dropped."""
    normalized = (api_base or "").strip().rstrip("/")
    if normalized.lower().endswith("/v1"):
        return normalized[:-3].rstrip("/")
    return normalized


def _bearer_headers(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}"} if api_key else {}


def _decode_data_uri(value: str) -> bytes | None:
    text = (value or "").strip()
    if not text.startswith("data:") or "," not in text:
        return None
    _, encoded = text.split(",", 1)
    try:
        return base64.b64decode(encoded)
    except (binascii.Error, ValueError):
        return None


async def _resolves_to_public_ip(host: str) -> bool:
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, None)
    except OSError:
        return False
    return bool(infos) and all(
        ipaddress.ip_address(info[4][0]).is_global for info in infos
    )


_FAL_QUEUE_HOSTS = frozenset({"fal.run", "queue.fal.run", "falrun.com"})


def _validate_poll_url(url: str, provider_host: str) -> str:
    try:
        parsed = httpx.URL(url.strip())
    except httpx.InvalidURL as exc:
        raise ImageEditProtocolError("The provider polling URL is malformed.") from exc
    host = (parsed.host or "").lower()
    allowed = {provider_host.lower()}
    if provider_host.lower() in _FAL_QUEUE_HOSTS:
        allowed |= _FAL_QUEUE_HOSTS
    if parsed.scheme not in {"http", "https"} or host not in allowed:
        raise ImageEditProtocolError(
            f"Refusing to poll {host or 'an origin-less URL'!r}: provider polling "
            f"URLs must stay on the configured provider host ({provider_host!r})."
        )
    return url.strip()


def _require_path_safe_model(model_name: str) -> str:
    candidate = model_name.strip().strip("/")
    if (
        not candidate
        or ".." in candidate
        or any(char in candidate for char in ("?", "#"))
        or any(ord(char) < 0x20 for char in candidate)
    ):
        raise ImageEditProtocolError(
            f"The model id {model_name!r} cannot be used in a provider URL path."
        )
    return candidate


async def _download_image(url: str, client: httpx.AsyncClient) -> bytes:
    try:
        current = httpx.URL(url.strip())
    except httpx.InvalidURL as exc:
        raise ImageEditProtocolError("The output image URL is malformed.") from exc
    for _ in range(_MAX_REDIRECTS + 1):
        if current.scheme not in {"http", "https"} or not await _resolves_to_public_ip(
            current.host
        ):
            raise ImageEditProtocolError(
                f"Refusing to download the output image from host {current.host!r}."
            )
        async with client.stream("GET", current, follow_redirects=False) as response:
            if response.is_redirect:
                location = response.headers.get("location")
                if not location:
                    raise ImageEditProtocolError(
                        "Output image download followed a redirect without Location."
                    )
                try:
                    current = current.join(location)
                except httpx.InvalidURL as exc:
                    raise ImageEditProtocolError(
                        "The output image redirect location is malformed."
                    ) from exc
                continue
            if response.status_code >= 400:
                raise ImageEditProtocolError(
                    f"Output image download returned HTTP {response.status_code}."
                )
            buffer = bytearray()
            async for chunk in response.aiter_bytes():
                buffer.extend(chunk)
                if len(buffer) > _MAX_DOWNLOAD_BYTES:
                    raise ImageEditProtocolError(
                        "Output image exceeds the 32 MiB download limit."
                    )
            content_type = response.headers.get("content-type", "").lower()
            if "image/" not in content_type and not bytes(buffer[:4]).startswith(_IMAGE_MAGIC):
                raise ImageEditProtocolError(
                    "Output image URL returned non-image content "
                    f"(content-type: {content_type or 'unknown'})."
                )
            return bytes(buffer)
    raise ImageEditProtocolError("Output image download exceeded the redirect limit.")


async def _resolve_output_image(value: str, client: httpx.AsyncClient) -> bytes:
    decoded = _decode_data_uri(value)
    if decoded is not None:
        return decoded
    if value.strip().lower().startswith(("http://", "https://")):
        return await _download_image(value, client)
    raise ImageEditProtocolError("The provider returned an unsupported image reference.")


def _decode_base64_image(encoded: str, provider_label: str) -> bytes:
    try:
        return base64.b64decode(encoded.strip())
    except (binascii.Error, ValueError) as exc:
        raise ImageEditProtocolError(
            f"{provider_label} returned a malformed base64 image payload."
        ) from exc


_REPLICATE_VERSION_CACHE: dict[tuple[str, str, str], str] = {}


def _split_replicate_model(model_name: str) -> tuple[str, str | None]:
    """`owner/name:<64-hex>` keeps its version; other `:suffix` shapes resolve latest."""
    raw = model_name.strip()
    owner_name, _, suffix = raw.partition(":")
    owner_name = owner_name.strip()
    suffix = suffix.strip()
    if suffix and _REPLICATE_VERSION_HEX.fullmatch(suffix):
        return owner_name, suffix
    return owner_name, None


async def _resolve_replicate_version(
    client: httpx.AsyncClient, *, host_root: str, api_key: str, owner_name: str
) -> str:
    cache_key = (host_root, owner_name, api_key)
    cached = _REPLICATE_VERSION_CACHE.get(cache_key)
    if cached:
        return cached
    response = await client.get(
        f"{host_root}/v1/models/{owner_name}", headers=_bearer_headers(api_key)
    )
    response.raise_for_status()
    body = _json_body(response)
    latest = body.get("latest_version")
    version_id = (
        str(latest.get("id") or "").strip() if isinstance(latest, dict) else ""
    )
    if not version_id:
        raise ImageEditProtocolError(
            f"Replicate did not report a latest version for model {owner_name!r}."
        )
    _REPLICATE_VERSION_CACHE[cache_key] = version_id
    return version_id


async def _replicate_input_image(
    client: httpx.AsyncClient, *, host_root: str, api_key: str, image_bytes: bytes
) -> str:
    if len(image_bytes) <= _REPLICATE_INLINE_IMAGE_LIMIT:
        return f"data:{_PNG_MIME};base64,{base64.b64encode(image_bytes).decode('utf-8')}"
    response = await client.post(
        f"{host_root}/v1/files",
        headers=_bearer_headers(api_key),
        files={"content": ("image.png", image_bytes, _PNG_MIME)},
    )
    response.raise_for_status()
    body = _json_body(response)
    urls = body.get("urls")
    get_url = str(urls.get("get") or "").strip() if isinstance(urls, dict) else ""
    if not get_url:
        raise ImageEditProtocolError(
            "Replicate file upload did not return a usable URL (urls.get)."
        )
    return get_url


def _replicate_first_output(prediction: dict[str, object]) -> str | None:
    output = prediction.get("output")
    if isinstance(output, str) and output.strip():
        return output.strip()
    if isinstance(output, list):
        for item in output:
            if isinstance(item, str) and item.strip():
                return item.strip()
    return None


def _replicate_poll_url(prediction: dict[str, object]) -> str:
    urls = prediction.get("urls")
    if not isinstance(urls, dict):
        return ""
    return str(urls.get("get") or "").strip()


async def call_replicate_clean(
    *,
    api_base: str,
    api_key: str,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    image_bytes: bytes,
) -> bytes:
    host_root = _host_root_api_base(api_base)
    owner_name, explicit_version = _split_replicate_model(model_name)
    owner_name = _require_path_safe_model(owner_name)
    if not owner_name:
        raise ImageEditProtocolError("A Replicate Model ID (owner/name) is required.")
    client = get_shared_client()
    deadline = time.monotonic() + _POLL_DEADLINE_SECONDS
    version = explicit_version or await _resolve_replicate_version(
        client, host_root=host_root, api_key=api_key, owner_name=owner_name
    )
    input_image = await _replicate_input_image(
        client, host_root=host_root, api_key=api_key, image_bytes=image_bytes
    )
    payload = {
        "version": version,
        "input": {
            "image": input_image,
            "prompt": f"{system_prompt}\n\n{user_prompt}",
        },
    }
    response = await client.post(
        f"{host_root}/v1/predictions",
        headers={**_bearer_headers(api_key), "Prefer": "wait"},
        json=payload,
    )
    response.raise_for_status()
    prediction = _json_body(response)
    poll_url = ""
    while True:
        status = str(prediction.get("status") or "").strip().lower()
        if status == "succeeded":
            output = _replicate_first_output(prediction)
            if output is None:
                raise ImageEditProtocolError(
                    "Replicate prediction succeeded but returned no output image."
                )
            return await _resolve_output_image(output, client)
        if status in {"failed", "canceled"}:
            raise ImageEditProtocolError(
                f"Replicate prediction {status}: "
                f"{_text_detail(prediction.get('error') or 'no error detail provided')}"
            )
        if status not in {"starting", "processing"}:
            raise ImageEditProtocolError(
                f"Replicate prediction reported unexpected status {status!r}."
            )
        if time.monotonic() > deadline:
            raise ImageEditProtocolError(
                f"Replicate prediction did not finish within {_POLL_DEADLINE_SECONDS:g}s "
                f"(last status: {status})."
            )
        poll_url = _replicate_poll_url(prediction) or poll_url
        if not poll_url:
            raise ImageEditProtocolError(
                "Replicate prediction response is missing its polling URL (urls.get)."
            )
        await _polite_sleep(_POLL_INTERVAL_SECONDS)
        poll_response = await client.get(
            _validate_poll_url(poll_url, httpx.URL(host_root).host or ""),
            headers=_bearer_headers(api_key),
        )
        poll_response.raise_for_status()
        prediction = _json_body(poll_response)


async def _fal_first_image(images: list[object], client: httpx.AsyncClient) -> bytes:
    for item in images:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        if url:
            return await _resolve_output_image(url, client)
    raise ImageEditProtocolError("The fal.ai image list contained no usable entry.")


async def _fal_poll_queue_result(
    client: httpx.AsyncClient,
    *,
    headers: dict[str, str],
    root: str,
    status_url: str,
    response_url: str,
    deadline: float,
) -> bytes:
    provider_host = httpx.URL(root).host or ""
    result_url = _validate_poll_url(response_url, provider_host) if response_url else ""
    while True:
        status_response = await client.get(
            _validate_poll_url(status_url, provider_host), headers=headers
        )
        status_response.raise_for_status()
        status_body = _json_body(status_response)
        status = str(status_body.get("status") or "").strip().upper()
        if status == "COMPLETED":
            break
        error = str(status_body.get("error") or "").strip()
        if error:
            raise ImageEditProtocolError(
                f"fal.ai queue reported an error: {_text_detail(error)}"
            )
        next_url = str(status_body.get("response_url") or "").strip()
        if next_url:
            result_url = _validate_poll_url(next_url, provider_host)
        if time.monotonic() > deadline:
            raise ImageEditProtocolError(
                f"fal.ai queue did not complete within {_POLL_DEADLINE_SECONDS:g}s "
                f"(last status: {status or 'unknown'})."
            )
        await _polite_sleep(_POLL_INTERVAL_SECONDS)
    if not result_url:
        raise ImageEditProtocolError(
            "fal.ai queue completed but returned no response URL."
        )
    result_response = await client.get(result_url, headers=headers)
    result_response.raise_for_status()
    result_body = _json_body(result_response)
    images = result_body.get("images")
    if isinstance(images, list) and images:
        return await _fal_first_image(images, client)
    raise ImageEditProtocolError("The fal.ai queue result did not contain an edited image.")


async def call_fal_clean(
    *,
    api_base: str,
    api_key: str,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    image_bytes: bytes,
) -> bytes:
    root = _host_root_api_base(api_base)
    model = _require_path_safe_model(model_name)
    if not model:
        raise ImageEditProtocolError(
            "A fal.ai model id (e.g. `fal-ai/nano-banana/edit`) is required."
        )
    headers = {"Authorization": f"Key {api_key}"} if api_key else {}
    client = get_shared_client()
    deadline = time.monotonic() + _POLL_DEADLINE_SECONDS
    payload = {
        "image_urls": [
            f"data:{_PNG_MIME};base64,{base64.b64encode(image_bytes).decode('utf-8')}"
        ],
        "prompt": f"{system_prompt}\n\n{user_prompt}",
        "sync_mode": True,
    }
    response = await client.post(f"{root}/{model}", headers=headers, json=payload)
    response.raise_for_status()
    body = _json_body(response)
    images = body.get("images")
    if isinstance(images, list) and images:
        return await _fal_first_image(images, client)
    status_url = str(body.get("status_url") or "").strip()
    if status_url:
        return await _fal_poll_queue_result(
            client,
            headers=headers,
            root=root,
            status_url=status_url,
            response_url=str(body.get("response_url") or "").strip(),
            deadline=deadline,
        )
    raise ImageEditProtocolError("fal.ai did not return an edited image.")


async def call_stability_clean(
    *,
    api_base: str,
    api_key: str,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    image_bytes: bytes,
) -> bytes:
    root = _host_root_api_base(api_base)
    mode = _require_path_safe_model(model_name)
    if not mode:
        raise ImageEditProtocolError(
            "A Stability AI edit mode (e.g. `search-and-replace`) is required."
        )
    client = get_shared_client()
    response = await client.post(
        f"{root}/v2beta/stable-image/edit/{mode}",
        headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
        files={"image": ("image.png", image_bytes, _PNG_MIME)},
        data={
            "prompt": f"{system_prompt}\n\n{user_prompt}",
            "output_format": "png",
        },
    )
    response.raise_for_status()
    content_type = response.headers.get("content-type", "").lower()
    if content_type.startswith("image/"):
        return response.content
    body = _json_body(response)
    encoded = str(body.get("image") or "").strip()
    if encoded:
        return _decode_base64_image(encoded, "Stability AI")
    finish_reason = str(body.get("finish_reason") or "").strip()
    if finish_reason:
        raise ImageEditProtocolError(
            f"Stability AI did not return an image (finish_reason: {finish_reason})."
        )
    raise ImageEditProtocolError("Stability AI did not return an edited image.")


def _cloudflare_run_url(api_base: str, model_name: str) -> str:
    normalized = (api_base or "").strip().rstrip("/")
    lowered = normalized.lower()
    model = _require_path_safe_model(model_name)
    if lowered.endswith("/ai/run"):
        return f"{normalized}/{model}"
    if "/ai/run/" in lowered:
        return normalized
    return f"{normalized}/ai/run/{model}"


def _cloudflare_error_detail(response: httpx.Response) -> str:
    body = _json_body(response)
    errors = body.get("errors")
    if isinstance(errors, list) and errors:
        return _text_detail(errors)
    return _text_detail(response.text) or f"HTTP {response.status_code}"


def _cloudflare_envelope_error(body: dict[str, object]) -> str | None:
    errors = body.get("errors")
    if isinstance(errors, list) and errors:
        return f"Cloudflare Workers AI reported errors: {_text_detail(errors)}"
    if body.get("success") is False:
        return "Cloudflare Workers AI reported success=false without error detail."
    return None


async def call_cloudflare_clean(
    *,
    api_base: str,
    api_key: str,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    image_bytes: bytes,
) -> bytes:
    url = _cloudflare_run_url(api_base, model_name)
    headers = _bearer_headers(api_key)
    prompt = f"{system_prompt}\n\n{user_prompt}"
    encoded_image = base64.b64encode(image_bytes).decode("utf-8")
    client = get_shared_client()
    response = await client.post(
        url,
        headers=headers,
        files={"image": ("image.png", image_bytes, _PNG_MIME)},
        data={"prompt": prompt},
    )
    if response.status_code == 410:
        raise ImageEditProtocolError(
            "Cloudflare Workers AI deprecated this model (HTTP 410); switch to an "
            "FLUX.2 model such as `@cf/black-forest-labs/flux-2-klein-9b`."
        )
    if response.status_code in _CLOUDFLARE_RETRY_STATUSES:
        multipart_detail = _cloudflare_error_detail(response)
        response = await client.post(
            url,
            headers=headers,
            json={"prompt": prompt, "image_b64": encoded_image},
        )
        if response.status_code == 410:
            raise ImageEditProtocolError(
                "Cloudflare Workers AI deprecated this model (HTTP 410); switch to an "
                "FLUX.2 model such as `@cf/black-forest-labs/flux-2-klein-9b`."
            )
        if response.status_code in _CLOUDFLARE_RETRY_STATUSES:
            raise ImageEditProtocolError(
                "Cloudflare Workers AI rejected both request formats "
                f"(multipart: {multipart_detail}; "
                f"JSON: {_cloudflare_error_detail(response)})."
            )
    response.raise_for_status()
    content_type = response.headers.get("content-type", "").lower()
    if content_type.startswith("image/"):
        return response.content
    body = _json_body(response)
    envelope_error = _cloudflare_envelope_error(body)
    if envelope_error:
        raise ImageEditProtocolError(envelope_error)
    result = body.get("result")
    if isinstance(result, dict):
        encoded = str(result.get("image") or "").strip()
        if encoded:
            return _decode_base64_image(encoded, "Cloudflare Workers AI")
    raise ImageEditProtocolError("Cloudflare Workers AI did not return an edited image.")
