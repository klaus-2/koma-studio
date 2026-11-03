"""Probe what env the win-unpacked shell passes to the backend, and what the
backend then reports. Reads the backend's environment block EARLY (before any
runtime fallback can rewrite it) and again late, plus /device/info at the end.
"""
import json
import subprocess
import sys
import time

import psutil
import urllib.request

APP = r"C:\Github\koma-studio\apps\electron\release-desktop\build-20261102151750\win-unpacked\KŌMA Studio.exe"

interesting = [
    "MINI_BACKEND_ACCELERATION_PROFILE",
    "KOMA_MODELS_ROOT",
    "KOMA_APP_RESOURCES_DIR",
    "PORT",
    "KOMA_LOCAL_API_SESSION_SECRET",
    "NODE_ENV",
]


def find_backends():
    out = []
    for proc in psutil.process_iter(["pid", "name", "cwd"]):
        try:
            name = (proc.info["name"] or "").lower()
            if name == "mini-backend.exe":
                out.append(proc)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return out


def snapshot_env(proc):
    try:
        env = proc.environ()
        return {key: env.get(key) for key in interesting if env.get(key) is not None}
    except (psutil.NoSuchProcess, psutil.AccessDenied) as error:
        return {"error": str(error)}


print("launching:", APP)
app = subprocess.Popen([APP], cwd=r"C:\Github\koma-studio\apps\electron\release-desktop\build-20261102151750\win-unpacked")
try:
    backends = []
    for _ in range(60):
        time.sleep(1)
        backends = find_backends()
        if backends:
            break
    if not backends:
        print("NO mini-backend process appeared in 60s")
        sys.exit(1)

    early = {}
    for _ in range(30):
        early = {proc.pid: snapshot_env(proc) for proc in backends}
        if any("MINI_BACKEND_ACCELERATION_PROFILE" in snap for snap in early.values()):
            break
        time.sleep(1)
    print("=== ENV EARLY (spawn) ===")
    print(json.dumps(early, indent=2, ensure_ascii=False))

    # wait for the backend to settle (warmup / possible fallback)
    time.sleep(100)
    procs = psutil.Process()
    late = {proc.pid: snapshot_env(proc) for proc in find_backends()}
    print("=== ENV LATE (after warmup window) ===")
    print(json.dumps(late, indent=2, ensure_ascii=False))

    for proc in find_backends():
        try:
            env = proc.environ()
            port = env.get("PORT")
            secret = env.get("KOMA_LOCAL_API_SESSION_SECRET", "")
            if not port:
                continue
            request = urllib.request.Request(
                f"http://127.0.0.1:{port}/device/info",
                headers={"x-koma-local-session": secret},
            )
            with urllib.request.urlopen(request, timeout=10) as response:
                payload = json.load(response)
            print(f"=== /device/info (pid {proc.pid}, port {port}) ===")
            print(json.dumps({
                "profile": payload.get("profile"),
                "name": payload.get("name"),
                "provider": payload.get("provider"),
                "has_gpu": payload.get("has_gpu"),
            }, indent=2))
        except Exception as error:  # noqa: BLE001 - probe
            print(f"device/info failed for pid {proc.pid}: {error}")
finally:
    print("=== cleaning up ===")
    for proc in find_backends():
        try:
            proc.kill()
        except psutil.NoSuchProcess:
            pass
    app.kill()
    print("done")
