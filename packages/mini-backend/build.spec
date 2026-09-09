# -*- mode: python ; coding: utf-8 -*-

import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules, collect_dynamic_libs

block_cipher = None

PROJECT_ROOT = Path.cwd()
LOCAL_PACKAGE_NAMES = (
    'core',
    'models',
    'pipelines',
    'raw_provider',
    'routers',
    'schemas',
    'services',
    'utils',
)
LOCAL_BINARY_SUFFIXES = {'.pyd', '.so', '.dll', '.dylib'}
CURRENT_ABI_MARKERS = {
    f".cp{sys.version_info.major}{sys.version_info.minor}-",
    f".cpython-{sys.version_info.major}{sys.version_info.minor}",
}


def collect_local_extension_binaries():
    binaries = []
    for package_name in LOCAL_PACKAGE_NAMES:
        package_root = PROJECT_ROOT / package_name
        if not package_root.exists():
            continue
        for file_path in package_root.rglob('*'):
            if not file_path.is_file():
                continue
            if file_path.suffix.lower() not in LOCAL_BINARY_SUFFIXES:
                continue
            normalized_name = file_path.name.lower()
            if ('.cp' in normalized_name or '.cpython-' in normalized_name) and not any(
                marker in normalized_name for marker in CURRENT_ABI_MARKERS
            ):
                continue
            destination = file_path.parent.relative_to(PROJECT_ROOT).as_posix()
            binaries.append((str(file_path), destination))
    return binaries


def collect_local_hiddenimports():
    imports = []
    for package_name in LOCAL_PACKAGE_NAMES:
        try:
            imports.extend(collect_submodules(package_name))
        except Exception:
            pass
    return list(dict.fromkeys(imports))


local_hiddenimports = collect_local_hiddenimports()
local_binaries = collect_local_extension_binaries()

psd_hiddenimports = collect_submodules('psd_tools')
psd_datas = collect_data_files('psd_tools')
photoshop_hiddenimports = collect_submodules('photoshop')
photoshop_datas = collect_data_files('photoshop')
pdfium_hiddenimports = collect_submodules('pypdfium2')
pdfium_datas = [*collect_data_files('pypdfium2'), *collect_data_files('pypdfium2_raw')]
py7zr_hiddenimports = collect_submodules('py7zr')
py7zr_datas = collect_data_files('py7zr')
transformers_hiddenimports = [
    *collect_submodules('transformers'),
    *collect_submodules('transformers.models.qwen2_5_vl'),
    *collect_submodules('transformers.models.got_ocr2'),
    *collect_submodules('transformers.models.glm_ocr'),
]
transformers_datas = collect_data_files('transformers')
tokenizers_hiddenimports = collect_submodules('tokenizers')
tokenizers_datas = collect_data_files('tokenizers')
sentencepiece_hiddenimports = collect_submodules('sentencepiece')
torch_hiddenimports = collect_submodules('torch')
torchvision_hiddenimports = collect_submodules('torchvision')
onnxruntime_hiddenimports = collect_submodules('onnxruntime')
onnxruntime_datas = collect_data_files('onnxruntime')

# ---------------------------------------------------------------------------
# NVIDIA CUDA libraries (bundled via pip for nvidia-cuda / nvidia-cuda-legacy)
# These packages may or may not be installed depending on the build profile.
# Gracefully skip collection when they are absent (e.g. cpu-only builds).
# ---------------------------------------------------------------------------
_NVIDIA_PACKAGES = [
    'nvidia.cuda_runtime',
    'nvidia.cublas',
    'nvidia.cudnn',
    'nvidia.cufft',
    'nvidia.curand',
    'nvidia.cusolver',
    'nvidia.cusparse',
    'nvidia.nvtx',
    'nvidia.nvjitlink',
    'nvidia.cuda_nvrtc',
]

nvidia_binaries = []
nvidia_datas = []
for _pkg in _NVIDIA_PACKAGES:
    try:
        nvidia_binaries += collect_dynamic_libs(_pkg)
        nvidia_datas += collect_data_files(_pkg)
    except Exception:
        pass  # package not installed for this profile — skip

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[*nvidia_binaries, *local_binaries],
    datas=[*psd_datas, *photoshop_datas, *pdfium_datas, *py7zr_datas, *transformers_datas, *tokenizers_datas, *onnxruntime_datas, *nvidia_datas],
    hiddenimports=['uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto', 'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto', 'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto', 'uvicorn.lifespan', 'uvicorn.lifespan.on', 'multipart', *local_hiddenimports, *psd_hiddenimports, *photoshop_hiddenimports, *pdfium_hiddenimports, *py7zr_hiddenimports, *transformers_hiddenimports, *tokenizers_hiddenimports, *sentencepiece_hiddenimports, *torch_hiddenimports, *torchvision_hiddenimports, *onnxruntime_hiddenimports],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    name='mini-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='mini-backend',
)
