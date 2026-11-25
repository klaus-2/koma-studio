from __future__ import annotations

import atexit
import logging
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import cast
from urllib.parse import urlparse

import httpx

from models.translation.errors import LocalModelError
from models.translation.json_types import JsonValue

logger = logging.getLogger(__name__)

GGUF_BACKEND_ENV = "KOMA_GGUF_BACKEND"
LLAMA_SERVER_URL_ENV = "KOMA_LLAMA_SERVER_URL"
LLAMA_SERVER_BIN_ENV = "KOMA_LLAMA_SERVER_BIN"

_DEFAULT_STARTUP_TIMEOUT_SECONDS = 60.0
_DEFAULT_REQUEST_TIMEOUT_SECONDS = 120.0
_HEALTH_POLL_INTERVAL_SECONDS = 0.05
_STDERR_TAIL_BYTES = 4096

_REGISTRY_LOCK = threading.Lock()
_ACTIVE_SERVERS: set[LlamaServerChatModel] = set()


def _binary_filename() -> str:
    return "llama-server.exe" if sys.platform == "win32" else "llama-server"


def resolve_llama_server_binary() -> Path | None:
    explicit = os.getenv(LLAMA_SERVER_BIN_ENV, "").strip()
    if explicit:
        candidate = Path(explicit).expanduser()
        if candidate.is_file():
            return candidate.resolve()
        return None

    on_path = shutil.which("llama-server")
    if on_path:
        path_obj = Path(on_path)
        if path_obj.is_file():
            return path_obj.resolve()

    backend_root = Path(__file__).resolve().parents[2]
    local_candidate = backend_root / "bin" / _binary_filename()
    if local_candidate.is_file():
        return local_candidate.resolve()
    return None


def _reserve_loopback_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        address = cast(tuple[str, int], sock.getsockname())
        return int(address[1])


def build_llama_server_command(
    *,
    binary_path: Path,
    model_path: Path,
    port: int,
    n_ctx: int,
    n_gpu_layers: int,
    n_threads: int | None = None,
) -> list[str]:
    command = [
        str(binary_path),
        "-m",
        str(model_path),
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
        "-c",
        str(n_ctx),
        "-ngl",
        str(n_gpu_layers),
        "--cache-reuse",
        "256",
        "--parallel",
        "1",
    ]
    if n_threads is not None and n_threads > 0:
        command.extend(["-t", str(n_threads)])
    return command


def _validate_base_url(raw_url: str) -> str:
    parsed = urlparse(raw_url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise LocalModelError(f"Invalid {LLAMA_SERVER_URL_ENV}: {raw_url!r}")
    return raw_url.strip().rstrip("/")


class LlamaServerChatModel:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        binary_path: Path | None = None,
        model_path: Path | None = None,
        n_ctx: int = 2048,
        n_gpu_layers: int = -1,
        n_threads: int | None = None,
        startup_timeout_seconds: float = _DEFAULT_STARTUP_TIMEOUT_SECONDS,
        request_timeout_seconds: float = _DEFAULT_REQUEST_TIMEOUT_SECONDS,
    ) -> None:
        self._process: subprocess.Popen[bytes] | None = None
        self._client = httpx.Client(timeout=request_timeout_seconds)
        self._closed = False
        self._lock = threading.Lock()
        self._stderr_lock = threading.Lock()
        self._stderr_tail = bytearray()
        self._stderr_thread: threading.Thread | None = None

        if base_url is not None and base_url.strip():
            self.base_url = _validate_base_url(base_url)
            self._managed = False
            return

        if binary_path is None or model_path is None:
            raise LocalModelError(
                "Managed llama-server requires both binary_path and model_path."
            )

        port = _reserve_loopback_port()
        self.base_url = f"http://127.0.0.1:{port}"
        self._managed = True
        command = build_llama_server_command(
            binary_path=binary_path,
            model_path=model_path,
            port=port,
            n_ctx=n_ctx,
            n_gpu_layers=n_gpu_layers,
            n_threads=n_threads,
        )
        creationflags = (
            getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0
        )
        try:
            self._process = subprocess.Popen(
                command,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                creationflags=creationflags,
            )
        except OSError as exc:
            self._client.close()
            raise LocalModelError(f"Failed to launch llama-server: {exc}") from exc

        if self._process.stderr is not None:
            self._stderr_thread = threading.Thread(
                target=self._drain_stderr,
                args=(self._process.stderr,),
                name="koma-llama-server-stderr",
                daemon=True,
            )
            self._stderr_thread.start()

        with _REGISTRY_LOCK:
            _ACTIVE_SERVERS.add(self)

        try:
            self._wait_until_ready(startup_timeout_seconds)
        except Exception:
            self.close()
            raise

        logger.info(
            "translation.gguf.llama_server_ready",
            extra={"base_url": self.base_url, "model": model_path.name},
        )

    def _drain_stderr(self, pipe: object) -> None:
        read_fn = getattr(pipe, "read", None)
        close_fn = getattr(pipe, "close", None)
        try:
            if not callable(read_fn):
                return
            while True:
                try:
                    chunk = read_fn(1024)
                except (OSError, ValueError):
                    break
                if not chunk or not isinstance(chunk, (bytes, bytearray)):
                    break
                with self._stderr_lock:
                    self._stderr_tail.extend(chunk)
                    if len(self._stderr_tail) > _STDERR_TAIL_BYTES:
                        del self._stderr_tail[:-_STDERR_TAIL_BYTES]
        finally:
            if callable(close_fn):
                try:
                    close_fn()
                except OSError:
                    pass

    def _read_stderr_tail(self) -> str:
        with self._stderr_lock:
            if not self._stderr_tail:
                return ""
            return bytes(self._stderr_tail).decode("utf-8", errors="replace").strip()

    def _wait_until_ready(self, timeout_seconds: float) -> None:
        deadline = time.monotonic() + max(0.5, timeout_seconds)
        health_url = f"{self.base_url}/health"
        while time.monotonic() < deadline:
            proc = self._process
            if proc is not None:
                exit_code = proc.poll()
                if exit_code is not None:
                    detail = self._read_stderr_tail()
                    suffix = f": {detail}" if detail else ""
                    raise LocalModelError(
                        f"llama-server exited during startup with code {exit_code}{suffix}"
                    )
            try:
                response = self._client.get(health_url, timeout=1.0)
                if response.status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            time.sleep(_HEALTH_POLL_INTERVAL_SECONDS)

        raise LocalModelError("Timed out waiting for llama-server /health.")

    def create_chat_completion(
        self, *, messages: list[dict[str, str]], temperature: float, max_tokens: int
    ) -> JsonValue:
        if self._closed:
            raise LocalModelError("llama-server runtime has been closed.")
        payload: dict[str, object] = {
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "cache_prompt": True,
        }
        try:
            response = self._client.post(
                f"{self.base_url}/v1/chat/completions",
                json=payload,
            )
            response.raise_for_status()
            parsed = cast(JsonValue, response.json())
        except (httpx.HTTPError, ValueError) as exc:
            raise LocalModelError(f"llama-server request failed: {exc}") from exc
        if not isinstance(parsed, dict):
            raise LocalModelError("llama-server returned a non-object JSON payload.")
        return parsed

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
            proc = self._process
            self._process = None
            client = self._client
            stderr_thread = self._stderr_thread
            self._stderr_thread = None

        with _REGISTRY_LOCK:
            _ACTIVE_SERVERS.discard(self)

        try:
            client.close()
        except Exception:
            pass

        if proc is not None:
            if proc.poll() is None:
                try:
                    proc.terminate()
                    proc.wait(timeout=5.0)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait(timeout=2.0)
                except OSError:
                    pass
        if stderr_thread is not None:
            stderr_thread.join(timeout=1.0)


def shutdown_llama_server() -> None:
    with _REGISTRY_LOCK:
        servers = tuple(_ACTIVE_SERVERS)
        _ACTIVE_SERVERS.clear()
    for server in servers:
        server.close()


atexit.register(shutdown_llama_server)
