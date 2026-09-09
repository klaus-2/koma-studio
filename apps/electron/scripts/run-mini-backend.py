from __future__ import annotations

import argparse
import os
from pathlib import Path
import shlex
import signal
import subprocess
import sys
from urllib.error import URLError
from urllib.request import urlopen


ROOT_DIR = Path(__file__).resolve().parents[1]
MINI_BACKEND_DIR = ROOT_DIR / ".." / ".." / "packages" / "mini-backend"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the mini backend in dev or prod mode."
    )
    parser.add_argument("--mode", choices=("dev", "prod"), default="dev")
    parser.add_argument("--host", default=None)
    parser.add_argument("--port", type=int, default=None)
    return parser.parse_args()


def parse_env_line(raw_line: str) -> tuple[str, str] | None:
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        return None

    key, raw_value = line.split("=", 1)
    key = key.strip()
    value = raw_value.strip()
    if not key:
        return None

    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        value = value[1:-1]

    return key, value


def load_env_files(mode: str) -> list[Path]:
    protected_keys = set(os.environ)
    suffix = "development" if mode == "dev" else "production"
    candidate_files = [
        ROOT_DIR / ".env",
        ROOT_DIR / ".env.local",
        ROOT_DIR / f".env.{suffix}",
        ROOT_DIR / f".env.{suffix}.local",
        MINI_BACKEND_DIR / ".env",
        MINI_BACKEND_DIR / ".env.local",
        MINI_BACKEND_DIR / f".env.{suffix}",
        MINI_BACKEND_DIR / f".env.{suffix}.local",
    ]

    loaded: list[Path] = []
    for env_file in candidate_files:
        if not env_file.exists():
            continue

        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            parsed = parse_env_line(raw_line)
            if not parsed:
                continue

            key, value = parsed
            if key in protected_keys:
                continue
            os.environ[key] = value

        loaded.append(env_file)

    return loaded


def resolve_default_models_root() -> Path | None:
    explicit = (os.getenv("KOMA_MODELS_ROOT") or "").strip()
    if explicit:
        return Path(explicit)
    # DEV without an env override: use the same directory as the Electron app
    # (setName "koma-studio") when it exists — keeps the dev-stack backend in
    # parity with the application backend.
    appdata = os.getenv("APPDATA")
    if appdata:
        default_root = Path(appdata) / "koma-studio" / "models"
        if default_root.is_dir():
            return default_root
    return None


def is_service_healthy(host: str, port: str) -> bool:
    health_url = f"http://{host}:{port}/health"
    try:
        with urlopen(health_url, timeout=1.5) as response:
            return int(getattr(response, "status", 0)) == 200
    except (OSError, URLError, ValueError):
        return False


def main() -> int:
    args = parse_args()
    loaded_files = load_env_files(args.mode)

    os.environ["NODE_ENV"] = "development" if args.mode == "dev" else "production"
    os.environ.setdefault("HOST", "127.0.0.1" if args.mode == "dev" else "0.0.0.0")
    os.environ.setdefault("PORT", "8001")
    os.environ.setdefault("KOMA_APP_RESOURCES_DIR", str(ROOT_DIR / "resources"))
    os.environ.setdefault(
        "KOMA_REFERENCE_IMAGES_DIR",
        str(ROOT_DIR / "resources" / "reference_images"),
    )

    models_root = resolve_default_models_root()
    if models_root is not None:
        models_root.mkdir(parents=True, exist_ok=True)
        os.environ.setdefault("KOMA_MODELS_ROOT", str(models_root))

    if args.host:
        os.environ["HOST"] = args.host
    if args.port:
        os.environ["PORT"] = str(args.port)

    if is_service_healthy(os.environ["HOST"], os.environ["PORT"]):
        print(
            f"[mini-backend] already-active=http://{os.environ['HOST']}:{os.environ['PORT']}"
        )
        print("[mini-backend] Reusing existing local mini backend instance.")
        return 0

    command = [
        sys.executable,
        "app.py",
    ]

    print(f"[mini-backend] mode={args.mode}")
    print(f"[mini-backend] cwd={MINI_BACKEND_DIR}")
    print(
        "[mini-backend] env-files="
        + (
            ", ".join(str(path.relative_to(ROOT_DIR)) for path in loaded_files)
            if loaded_files
            else "(none)"
        )
    )
    print(f"[mini-backend] models-root={os.getenv('KOMA_MODELS_ROOT', '(unset)')}")
    print(f"[mini-backend] command={shlex.join(command)}")

    # Spawn app.py in its own process group so the parent dev-stack's
    # taskkill /T /F can walk the tree, and so we can deliver CTRL_BREAK_EVENT
    # on Windows (the only cross-process signal that reliably reaches a child
    # console process). subprocess.run swallows SIGINT, so this also lets us
    # forward the user pressing Ctrl+C instead of leaking a zombie uvicorn.
    creationflags = 0
    if sys.platform == "win32":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

    popen = subprocess.Popen(command, cwd=MINI_BACKEND_DIR, creationflags=creationflags)

    def _forward(signum, _frame):
        if sys.platform == "win32":
            try:
                popen.send_signal(signal.CTRL_BREAK_EVENT)
            except (OSError, ProcessLookupError):
                pass
        else:
            popen.terminate()

    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, _forward)

    try:
        return popen.wait()
    except KeyboardInterrupt:
        # Belt and braces: the signal handler above already asked the child to
        # exit; here we just wait it out and return the child's exit code.
        try:
            popen.wait(timeout=5)
        except subprocess.TimeoutExpired:
            popen.kill()
            popen.wait()
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
