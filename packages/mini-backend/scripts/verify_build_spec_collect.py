from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from PyInstaller.utils.hooks import (  # noqa: E402
    collect_data_files,
    collect_dynamic_libs,
    collect_submodules,
)

EXPECTED_DLLS = {
    "llama_cpp": ("llama.dll", "ggml.dll", "ggml-base.dll", "ggml-cpu.dll"),
    "ctranslate2": ("ctranslate2.dll",),
}


def main() -> int:
    failures: list[str] = []
    for package, expected_dlls in EXPECTED_DLLS.items():
        submodules = collect_submodules(package)
        dynlibs = collect_dynamic_libs(package)
        datas = collect_data_files(package)
        dll_names = {Path(source).name.lower() for source, _destination in dynlibs}
        print(
            f"{package}: submodules={len(submodules)} dynlibs={len(dynlibs)} datas={len(datas)}"
        )
        print(f"  dlls: {sorted(dll_names)}")
        if not submodules:
            failures.append(f"{package}: collect_submodules returned nothing")
        for expected in expected_dlls:
            if expected.lower() not in dll_names:
                failures.append(
                    f"{package}: expected native library '{expected}' not collected "
                    f"(got {sorted(dll_names)})"
                )

    if failures:
        print("\nFAIL:")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("\nOK: build.spec collection requirements satisfied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
