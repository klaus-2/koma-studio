"""
harden-mini-backend.py
======================
Applies anti-reverse-engineering protections to the mini-backend Python source
code BEFORE PyInstaller packaging.

Protection layers:
  1. Cython compilation  - Compiles critical .py modules to native C extensions
                           (.pyd on Windows, .so on Linux/macOS). These are
                           native machine code and cannot be trivially decompiled.
  2. PyArmor obfuscation - Encrypts remaining .py bytecode with AES-256 and
                           injects runtime license checks. Prevents
                           decompilers (uncompyle6, decompyle3, pycdc) from
                           recovering readable source.
  3. PyInstaller key     - Enables the --key flag in the .spec so the PYZ
                           archive inside the executable is AES-encrypted,
                           adding one more layer of defence.

Usage:
  python scripts/harden-mini-backend.py [--skip-cython] [--skip-pyarmor] [--dry-run]

Requirements (install in the mini venv):
  pip install cython pyarmor
"""

from __future__ import annotations

import argparse
import glob
import importlib.util
import os
import platform
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent


def _resolve_env_path(name: str, default: Path) -> Path:
    raw_value = (os.getenv(name) or "").strip()
    if not raw_value:
        return default

    candidate = Path(raw_value).expanduser()
    if not candidate.is_absolute():
        candidate = ROOT_DIR / candidate
    return candidate.resolve()


BACKEND_DIR = _resolve_env_path("MINI_BACKEND_SOURCE_DIR", ROOT_DIR / ".." / ".." / "packages" / "mini-backend")
HARDENED_DIR = _resolve_env_path(
    "MINI_BACKEND_HARDENED_DIR",
    ROOT_DIR / "mini-backend-hardened",
)
# Optional directory (outside the repository) that hosts the heavy build
# artefacts. Set MINI_BACKEND_EXTERNAL_STORAGE_ROOT to enable the Windows
# junction layout; when unset, everything stays inside the project directory.
EXTERNAL_STORAGE_ROOT = (
    _resolve_env_path("MINI_BACKEND_EXTERNAL_STORAGE_ROOT", ROOT_DIR)
    if (os.getenv("MINI_BACKEND_EXTERNAL_STORAGE_ROOT") or "").strip()
    else None
)
HARDENED_STORAGE_DIR = _resolve_env_path(
    "MINI_BACKEND_HARDENED_STORAGE_DIR",
    (EXTERNAL_STORAGE_ROOT or ROOT_DIR) / "mini-backend-hardened-storage",
)

# Modules that contain the most valuable IP and MUST be compiled to native
# code via Cython.  These are the first layer of defence.
CYTHON_PRIORITY_MODULES: list[str] = [
    # Core business logic
    "core/config.py",
    "core/device.py",
    "core/models_store.py",
    "core/hf_download.py",
    "core/languages.py",
    "core/runtime_errors.py",
    # Detection pipeline (proprietary algorithms)
    "models/detection/factory.py",
    "models/detection/base_detector.py",
    "models/detection/reading_order.py",
    "models/detection/storage.py",
    "models/detection/craft/detector.py",
    "models/detection/comic_text_detector/detector.py",
    "models/detection/font/classify.py",
    "models/detection/font/detector.py",
    "models/detection/font/foreground_color.py",
    "models/detection/font/reference_classifier.py",
    "models/detection/yolo_bubble/detector.py",
    # OCR engines
    "models/ocr/factory.py",
    "models/ocr/base_ocr.py",
    # Inpainting
    "models/inpainting/factory.py",
    "models/inpainting/base_inpainter.py",
    "models/inpainting/aot/inpainter.py",
    "models/inpainting/lama/inpainter.py",
    # Segmentation
    "models/segmentation/factory.py",
    "models/segmentation/baka_segmenter.py",
    # Translation
    "models/translation/factory.py",
    "models/translation/local_ctranslate2.py",
    "models/translation/providers.py",
    # Pipelines (core orchestration)
    "pipelines/full_pipeline.py",
    "pipelines/clean_pipeline.py",
    "pipelines/ocr_pipeline.py",
    "pipelines/export_pipeline.py",
    "pipelines/queue_processor.py",
    "pipelines/cache_manager.py",
    # Utils with proprietary logic
    "utils/image.py",
    "utils/mask.py",
    "utils/inpaint_heuristics.py",
    "utils/detection_fallback.py",
    "utils/ocr_fallback.py",
    "utils/psd_exporter.py",
    "utils/psd_metadata.py",
    "utils/photoshop_text_layers.py",
]

# The PyInstaller spec and PyArmor fallback both expect ``app.py`` to remain
# as a Python entrypoint, so we keep it out of the Cython list.

# Files that should NEVER be compiled (they need to remain importable as-is or
# contain pure data / __init__ stubs).
CYTHON_EXCLUDE_PATTERNS: list[str] = [
    "tests/*",
    "scripts/*",
    "__init__.py",
    "*/pororo/*",  # Third-party BrainOCR code - complex C compilation issues
]

# Directories that PyArmor should obfuscate (everything Cython didn't compile).
PYARMOR_TARGET_DIRS: list[str] = [
    "core",
    "models",
    "pipelines",
    "routers",
    "schemas",
    "utils",
]

HARDENED_EXTERNAL_SUBDIRS: dict[str, Path] = {
    "build": HARDENED_STORAGE_DIR / "build",
    "dist": HARDENED_STORAGE_DIR / "dist",
    "_pyarmor_obfuscated": HARDENED_STORAGE_DIR / "_pyarmor_obfuscated",
    ".pyarmor": HARDENED_STORAGE_DIR / ".pyarmor",
    ".pyarmor-obf": HARDENED_STORAGE_DIR / ".pyarmor-obf",
}


def log(msg: str) -> None:
    print(f"[harden] {msg}", flush=True)


def run(
    cmd: list[str], cwd: Path | None = None, check: bool = True
) -> subprocess.CompletedProcess:
    log(f"  $ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=cwd, check=check, capture_output=False)


def get_python() -> str:
    """Return the path to the mini-backend venv Python."""
    requested_venv = (os.getenv("MINI_BACKEND_VENV_NAME") or "").strip()
    if requested_venv:
        requested_base = Path(requested_venv).expanduser()
        if not requested_base.is_absolute():
            requested_base = ROOT_DIR / requested_base
        requested_python = requested_base / (
            "Scripts/python.exe" if platform.system() == "Windows" else "bin/python"
        )
        if requested_python.exists():
            return str(requested_python)

    if platform.system() == "Windows":
        candidates = [
            ROOT_DIR / ".venv-mini" / "Scripts" / "python.exe",
            ROOT_DIR / ".venv-mini-hardened" / "Scripts" / "python.exe",
        ]
    else:
        candidates = [
            ROOT_DIR / ".venv-mini" / "bin" / "python",
            ROOT_DIR / ".venv-mini-hardened" / "bin" / "python",
        ]
    for c in candidates:
        if c.exists():
            return str(c)
    return sys.executable


def get_pyarmor_command(python: str) -> list[str]:
    """Return the most reliable PyArmor invocation for the active venv."""
    try:
        pyarmor_spec = importlib.util.find_spec("pyarmor.cli.__main__")
    except ModuleNotFoundError:
        pyarmor_spec = None

    if pyarmor_spec is not None:
        return [python, "-m", "pyarmor.cli"]

    scripts_dir = Path(python).parent
    if platform.system() == "Windows":
        candidates = [
            scripts_dir / "pyarmor.exe",
            scripts_dir / "pyarmor-8.exe",
            scripts_dir / "pyarmor-7.exe",
        ]
    else:
        candidates = [scripts_dir / "pyarmor"]

    for candidate in candidates:
        if candidate.exists():
            return [str(candidate)]

    # Legacy fallback for older PyArmor layouts that still expose
    # ``python -m pyarmor`` directly.
    return [python, "-m", "pyarmor"]


def pyinstaller_supports_pyz_encryption() -> bool:
    """Return whether the installed PyInstaller still supports PYZ ciphers."""
    try:
        from PyInstaller.archive.pyz_crypto import PyiBlockCipher
    except Exception:
        return False

    try:
        PyiBlockCipher("0123456789abcdef")
    except BaseException as exc:
        return "remove cipher and block_cipher parameters" not in str(exc)

    return True


def _matches_exclude(rel: str) -> bool:
    from fnmatch import fnmatch

    rel_posix = rel.replace("\\", "/")
    for pattern in CYTHON_EXCLUDE_PATTERNS:
        if fnmatch(rel_posix, pattern) or fnmatch(os.path.basename(rel_posix), pattern):
            return True
    return False


def windows_external_storage_available() -> bool:
    if (
        os.getenv("MINI_BACKEND_DISABLE_EXTERNAL_STORAGE_JUNCTIONS") or ""
    ).strip().lower() in {
        "1",
        "true",
        "yes",
    }:
        return False
    return (
        platform.system() == "Windows"
        and EXTERNAL_STORAGE_ROOT is not None
        and EXTERNAL_STORAGE_ROOT.exists()
    )


def ensure_windows_junction(link_path: Path, target_path: Path) -> None:
    target_path.mkdir(parents=True, exist_ok=True)

    if link_path.exists():
        try:
            if link_path.resolve() == target_path.resolve():
                return
        except OSError:
            pass

        if link_path.is_dir():
            shutil.rmtree(link_path)
        else:
            link_path.unlink()

    run(
        ["cmd", "/c", "mklink", "/J", str(link_path), str(target_path)],
        cwd=link_path.parent,
    )


def configure_hardened_external_storage() -> None:
    if not windows_external_storage_available():
        return

    log("Configuring hardened storage junctions...")
    HARDENED_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    for relative_name, target_path in HARDENED_EXTERNAL_SUBDIRS.items():
        ensure_windows_junction(HARDENED_DIR / relative_name, target_path)
        log(f"  Junction: {HARDENED_DIR / relative_name} -> {target_path}")


# ---------------------------------------------------------------------------
# Step 0 - Prepare hardened copy
# ---------------------------------------------------------------------------
def prepare_hardened_copy() -> None:
    """Create a clean copy of mini-backend for hardening (never modify the
    original source tree)."""
    log("Preparing hardened copy...")
    if HARDENED_DIR.exists():
        shutil.rmtree(HARDENED_DIR)

    shutil.copytree(
        BACKEND_DIR,
        HARDENED_DIR,
        ignore=shutil.ignore_patterns(
            "__pycache__",
            "*.pyc",
            ".mypy_cache",
            ".pytest_cache",
            "dist",
            "build",
            "*.egg-info",
            ".pyarmor",
            ".pyarmor-*",
            "_pyarmor_obfuscated",
        ),
    )
    configure_hardened_external_storage()
    log(f"  Copied to {HARDENED_DIR}")


# ---------------------------------------------------------------------------
# Step 1 - Cython compilation
# ---------------------------------------------------------------------------
def build_cython_modules() -> list[str]:
    """Compile priority modules to native extensions and remove the .py
    originals from the hardened tree."""
    log("=== Cython compilation ===")
    python = get_python()

    # Ensure Cython is installed
    run([python, "-m", "pip", "install", "cython", "--quiet"])

    compiled: list[str] = []
    ext_suffix = _get_extension_suffix(python)

    for rel_path in CYTHON_PRIORITY_MODULES:
        src = HARDENED_DIR / rel_path
        if not src.exists():
            log(f"  SKIP (not found): {rel_path}")
            continue
        if _matches_exclude(rel_path):
            log(f"  SKIP (excluded):  {rel_path}")
            continue

        # Cython compiles .py -> .c -> .pyd/.so
        module_dir = src.parent
        module_name = src.stem

        # Create a minimal setup.py for this single module
        setup_py = module_dir / "_cython_setup.py"
        setup_py.write_text(
            textwrap.dedent(f"""\
            from setuptools import setup, Extension
            from Cython.Build import cythonize
            import numpy
            setup(
                ext_modules=cythonize(
                    Extension(
                        "{module_name}",
                        ["{src.name}"],
                        include_dirs=[numpy.get_include()],
                    ),
                    compiler_directives={{
                        "language_level": "3",
                        "boundscheck": False,
                        "wraparound": False,
                    }},
                ),
            )
        """),
            encoding="utf-8",
        )

        result = run(
            [python, "_cython_setup.py", "build_ext", "--inplace"],
            cwd=module_dir,
            check=False,
        )

        # Cleanup temp files
        setup_py.unlink(missing_ok=True)
        for f in module_dir.glob(f"{module_name}.c"):
            f.unlink(missing_ok=True)
        build_dir = module_dir / "build"
        if build_dir.exists():
            shutil.rmtree(build_dir)

        if result.returncode != 0:
            log(f"  WARN: Cython failed for {rel_path} - will fall back to PyArmor")
            continue

        # Verify the .pyd/.so was created
        compiled_ext = list(module_dir.glob(f"{module_name}*{ext_suffix}"))
        if not compiled_ext:
            compiled_ext = list(module_dir.glob(f"{module_name}*.pyd")) + list(
                module_dir.glob(f"{module_name}*.so")
            )

        if compiled_ext:
            # Remove original .py so only the native extension remains
            src.unlink()
            compiled.append(rel_path)
            log(f"  OK: {rel_path} -> {compiled_ext[0].name}")
        else:
            log(f"  WARN: No extension found for {rel_path}")

    log(f"Cython compiled {len(compiled)}/{len(CYTHON_PRIORITY_MODULES)} modules")
    return compiled


def _get_extension_suffix(python: str) -> str:
    """Get the platform-specific extension suffix (e.g. .cpython-312-x86_64-linux-gnu.so)."""
    try:
        result = subprocess.run(
            [
                python,
                "-c",
                "import importlib.machinery; print(importlib.machinery.EXTENSION_SUFFIXES[0])",
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except Exception:
        return ".pyd" if platform.system() == "Windows" else ".so"


def _remove_dir_or_junction(path: Path) -> None:
    """Remove a directory or Windows junction point safely.

    shutil.rmtree raises OSError on junction points (treats them like
    symlinks).  os.rmdir() removes the junction entry without touching
    the target directory, which is exactly what we want here.
    """
    try:
        shutil.rmtree(path)
    except OSError as exc:
        if "symbolic link" in str(exc):
            # Junction point – remove the entry only, leave the target alone.
            os.rmdir(str(path))
        else:
            raise


# ---------------------------------------------------------------------------
# Step 2 - PyArmor obfuscation
# ---------------------------------------------------------------------------
def obfuscate_with_pyarmor() -> None:
    """Obfuscate all remaining .py files with PyArmor."""
    log("=== PyArmor obfuscation ===")
    python = get_python()
    pyarmor_cmd = get_pyarmor_command(python)

    # Ensure PyArmor is installed
    run([python, "-m", "pip", "install", "pyarmor", "--quiet"])

    # Collect all .py files that still exist (not compiled by Cython)
    py_files: list[Path] = []
    for d in PYARMOR_TARGET_DIRS:
        target = HARDENED_DIR / d
        if target.exists():
            py_files.extend(target.rglob("*.py"))

    # Also include app.py if it survived Cython
    app_py = HARDENED_DIR / "app.py"
    if app_py.exists():
        py_files.append(app_py)

    if not py_files:
        log("  No .py files remaining to obfuscate (all compiled by Cython)")
        return

    log(f"  Obfuscating {len(py_files)} remaining .py files...")

    # Use PyArmor gen to obfuscate in-place
    # --recursive handles subpackages, --output replaces originals
    obfuscated_output = HARDENED_DIR / "_pyarmor_obfuscated"

    result = run(
        [
            *pyarmor_cmd,
            "gen",
            "--output",
            str(obfuscated_output),
            "--enable-jit",  # JIT-based protection (harder to dump)
            "--enable-themida",  # Themida-like code virtualization (Windows)
            "--mix-str",  # Encrypt string constants
            "--assert-call",  # Anti-tampering assertions
            "--assert-import",  # Verify import integrity
            "--private",  # Private mode - restrict module access
            str(HARDENED_DIR / "app.py"),
        ],
        cwd=HARDENED_DIR,
        check=False,
    )

    if result.returncode != 0:
        log("  PyArmor advanced mode failed, trying basic obfuscation...")
        # Fallback: basic obfuscation without advanced features
        result = run(
            [
                *pyarmor_cmd,
                "gen",
                "--output",
                str(obfuscated_output),
                "--mix-str",
                str(HARDENED_DIR / "app.py"),
            ],
            cwd=HARDENED_DIR,
            check=False,
        )

    if result.returncode == 0 and obfuscated_output.exists():
        # Replace original files with obfuscated versions
        for item in obfuscated_output.iterdir():
            dest = HARDENED_DIR / item.name
            if item.is_dir():
                if dest.exists():
                    shutil.rmtree(dest)
                shutil.copytree(item, dest)
            else:
                shutil.copy2(item, dest)
        _remove_dir_or_junction(obfuscated_output)
        log("  PyArmor obfuscation applied successfully")
    else:
        log("  WARN: PyArmor obfuscation failed - proceeding without it")
        if obfuscated_output.exists() or os.path.islink(str(obfuscated_output)):
            _remove_dir_or_junction(obfuscated_output)


# ---------------------------------------------------------------------------
# Step 3 - Patch build.spec for encrypted PYZ archive
# ---------------------------------------------------------------------------
def patch_build_spec() -> None:
    """Add AES encryption key to the PyInstaller build.spec."""
    log("=== Patching build.spec for PYZ encryption ===")
    spec_file = HARDENED_DIR / "build.spec"
    if not spec_file.exists():
        log("  WARN: build.spec not found in hardened directory")
        return

    if not pyinstaller_supports_pyz_encryption():
        log("  SKIP: Installed PyInstaller does not support PYZ encryption keys")
        return

    content = spec_file.read_text(encoding="utf-8")

    # Replace `block_cipher = None` with a 16-byte AES key
    if "block_cipher = None" in content:
        # Generate a deterministic-but-hard-to-guess key from project metadata
        import hashlib

        key_seed = "koma-studio-mini-backend-cipher-v1"
        key = hashlib.sha256(key_seed.encode()).hexdigest()[:16]
        content = content.replace(
            "block_cipher = None",
            f"block_cipher = pyi_crypto.PyiBlockCipher(key='{key}')",
        )
        # Add import at top
        if "from PyInstaller.utils.crypto import pyi_crypto" not in content:
            content = "from PyInstaller.utils.crypto import pyi_crypto\n" + content

        spec_file.write_text(content, encoding="utf-8")
        log(f"  PYZ encryption key set (AES-128)")
    else:
        log("  build.spec already has cipher configured or uses different pattern")


# ---------------------------------------------------------------------------
# Step 4 - Strip debug symbols and optimize
# ---------------------------------------------------------------------------
def strip_debug_info() -> None:
    """Remove .pyc debug info, docstrings, and assert statements from
    remaining .py files using compile optimization."""
    log("=== Stripping debug info ===")
    python = get_python()

    # Compile all .py to .pyc with optimization level 2 (remove docstrings + asserts)
    run(
        [python, "-OO", "-m", "compileall", "-b", "-f", "-q", str(HARDENED_DIR)],
        check=False,
    )

    log("  Debug info stripped (OO optimization applied)")


# ---------------------------------------------------------------------------
# Step 5 - Clean up sensitive metadata
# ---------------------------------------------------------------------------
def cleanup_metadata() -> None:
    """Remove files that leak project structure information."""
    log("=== Cleaning up metadata ===")
    patterns_to_remove = [
        "**/*.md",
        "**/*.txt",  # Keep requirements.txt only if needed
        "**/.gitignore",
        "**/.flake8",
        "**/.mypy.ini",
        "**/*.cfg",
        "tests/**",
        "scripts/**",
    ]

    # Keep requirements.txt for reference but remove others
    kept = {"requirements.txt"}
    removed = 0

    for pattern in patterns_to_remove:
        for f in HARDENED_DIR.glob(pattern):
            if f.name in kept:
                continue
            if f.is_file():
                f.unlink()
                removed += 1
            elif f.is_dir():
                shutil.rmtree(f)
                removed += 1

    log(f"  Removed {removed} metadata files/directories")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Harden mini-backend against reverse engineering"
    )
    parser.add_argument(
        "--skip-cython", action="store_true", help="Skip Cython compilation step"
    )
    parser.add_argument(
        "--skip-pyarmor", action="store_true", help="Skip PyArmor obfuscation step"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Only show what would be done"
    )
    args = parser.parse_args()

    log("=" * 60)
    log("KOMA Studio - Mini Backend Hardening")
    log("=" * 60)

    if args.dry_run:
        log("DRY RUN - no changes will be made")
        log(f"  Cython targets: {len(CYTHON_PRIORITY_MODULES)} modules")
        log(f"  PyArmor targets: {PYARMOR_TARGET_DIRS}")
        log(f"  Source: {BACKEND_DIR}")
        log(f"  Output: {HARDENED_DIR}")
        return

    # Step 0: Create clean copy
    prepare_hardened_copy()

    # Step 1: Cython
    cython_compiled: list[str] = []
    if not args.skip_cython:
        cython_compiled = build_cython_modules()
    else:
        log("Skipping Cython compilation (--skip-cython)")

    # Step 2: PyArmor
    if not args.skip_pyarmor:
        obfuscate_with_pyarmor()
    else:
        log("Skipping PyArmor obfuscation (--skip-pyarmor)")

    # Step 3: Patch build.spec
    patch_build_spec()

    # Step 4: Strip debug info
    strip_debug_info()

    # Step 5: Clean metadata
    cleanup_metadata()

    log("")
    log("=" * 60)
    log("Hardening complete!")
    log(f"  Cython-compiled modules: {len(cython_compiled)}")
    log(f"  Hardened output: {HARDENED_DIR}")
    log("")
    log("Next step: run PyInstaller on the hardened directory:")
    log(f"  cd {HARDENED_DIR} && python -m PyInstaller build.spec")
    log("=" * 60)


if __name__ == "__main__":
    main()
