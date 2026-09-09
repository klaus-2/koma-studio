# Third-party notices

KŌMA Studio's own source code is licensed under the [MIT License](../LICENSE). It depends on, bundles
adapters for, and downloads at runtime a number of third-party components that carry **their own
licenses**. This document lists what we know, and — importantly — flags the parts that are **not**
permissive.

> **This is not legal advice.** It is an engineering inventory produced by reading package metadata
> and upstream repositories. If you plan to redistribute a build of KŌMA Studio, review each item
> yourself.

---

## 1. Items that need attention before redistribution

These are the components whose licenses impose obligations beyond attribution.

| Component | Where | License | Obligation |
| --- | --- | --- | --- |
| **Comic Text Detector** | `mini-backend/models/detection/comic_text_detector/` (adapter) + ONNX weights downloaded at runtime | **GPL-3.0** | Strong copyleft. The upstream project [dmMaze/comic-text-detector](https://github.com/dmMaze/comic-text-detector) is GPL-3.0. Distributing a combined work that includes GPL-3.0 code may require the whole distribution to be GPL-3.0. |
| **py7zr** | `mini-backend/requirements.txt` — CBZ/7z ingest | **LGPL-2.1-or-later** | Weak copyleft. Fine when used as an unmodified separate library; modifications must be released under the LGPL, and users must be able to relink. |
| **PyInstaller** | `mini-backend/requirements.txt` — build tooling only | **GPL-2.0 with bootloader exception** | The exception explicitly permits building and distributing non-free/commercial applications. Only *modifications to PyInstaller itself* are GPL-encumbered. Not linked into the shipped app. |
| **axe-core** | devDependency (accessibility testing) | **MPL-2.0** | File-level copyleft. Test-only, not shipped in the application bundle. |
| **lightningcss** (+ platform binaries) | transitive devDependency (Vite) | **MPL-2.0** | File-level copyleft. Build-time only. |

### Notes on the GPL-3.0 detector

`mini-backend/models/detection/comic_text_detector/detector.py` is an ONNX-inference adapter written
for this project, but it targets the upstream model and follows its pre/post-processing. The weights
themselves (`comictextdetector.pt.onnx`) are downloaded at runtime from the
[manga-image-translator](https://github.com/zyddnys/manga-image-translator) releases and are **never
committed to this repository**.

Runtime download means the GPL-3.0 artefact is not distributed by us, which is the reason the project
can be MIT. **A redistributor who bundles the weights or the upstream code into an installer takes on
the GPL-3.0 obligations.** If that matters to you, ship without the detector or replace it.

### Vendored Pororo / brainOCR

`mini-backend/models/ocr/pororo/` contains ~4,750 lines vendored from
[kakaobrain/pororo](https://github.com/kakaobrain/pororo) (Apache-2.0). The upstream `LICENSE`
(Apache-2.0), `LICENSE.3rd_party_library` and `LICENSE.3rd_party_model` files are vendored alongside
the fork at `packages/mini-backend/models/ocr/pororo/`, satisfying the Apache-2.0 §4 retention
requirement.

---

## 2. AI models downloaded at runtime

No model weights are committed to this repository. They are fetched on demand by the Model Manager
and cached under `KOMA_MODELS_ROOT`. Each carries its own license and, in some cases, restrictions on
commercial use or on the datasets it was trained on.

| Model | Source | License |
| --- | --- | --- |
| Comic Text Detector (`comictextdetector.pt.onnx`) | `zyddnys/manga-image-translator` GitHub releases | **GPL-3.0** (upstream) |
| Manga OCR (encoder/decoder ONNX, vocab) | `mayocream/manga-ocr-onnx` on Hugging Face; upstream [kha-white/manga-ocr](https://github.com/kha-white/manga-ocr) | Apache-2.0 |
| PaddleOCR / PP-OCRv5 (det + rec + dicts) | `monkt/paddleocr-onnx` on Hugging Face; `RapidAI/RapidOCR` on ModelScope | Apache-2.0 |
| Pororo brainOCR (`brainocr.pt`, `craft.pt`) | `ogkalu/pororo` on Hugging Face; tree vendored at `packages/mini-backend/models/ocr/pororo/` (upstream [kakaobrain/pororo](https://github.com/kakaobrain/pororo)) | Apache-2.0 (code) / CC-BY-NC-SA-4.0 (some checkpoints — check each model card) |
| LaMa inpainting (ONNX) | [advimman/lama](https://github.com/advimman/lama) | Apache-2.0 |
| EasyOCR detection/recognition | [JaidedAI/EasyOCR](https://github.com/JaidedAI/EasyOCR) | Apache-2.0 |
| Offline translation models | CTranslate2 / GGUF conversions, per-model | Varies — **check each model card** |

Translation models the user installs (CTranslate2 or llama.cpp/GGUF) may be under non-commercial or
research-only terms depending on the checkpoint. KŌMA Studio does not vet them.

---

## 3. JavaScript / TypeScript dependencies

All direct dependencies declared in the workspace `package.json` files, and the installed tree, are
permissively licensed. Snapshot taken on 2026-08-28; distribution across the installed tree at that
time:

| License | Packages |
| --- | --- |
| MIT | 693 |
| Apache-2.0 | 25 |
| ISC | 24 |
| BSD-2-Clause | 13 |
| BSD-3-Clause | 12 |
| MIT OR Apache-2.0 | 5 |
| MPL-2.0 | 4 (see §1 — `axe-core`, `lightningcss` ×3) |
| BlueOak-1.0.0 | 4 |
| Apache-2.0 OR MIT | 4 |
| CC-BY-4.0 | 1 |
| MIT OR CC0-1.0 | 1 |
| Python-2.0 | 1 |

Direct dependencies only: 51 MIT, 5 "MIT OR Apache-2.0", 4 Apache-2.0, 2 "Apache-2.0 OR MIT", 2 ISC,
1 BSD-2-Clause — **no copyleft among the direct dependencies**.

Regenerate this inventory after any dependency change.

---

## 4. Python dependencies (`mini-backend/requirements.txt`)

| Package | License |
| --- | --- |
| fastapi | MIT |
| uvicorn | BSD-3-Clause |
| python-multipart | Apache-2.0 |
| httpx | BSD-3-Clause |
| opencv-python | Apache-2.0 (OpenCV 4.5+) |
| numpy | BSD-3-Clause |
| Pillow | MIT-CMU |
| psd-tools | MIT |
| pypdfium2 | Apache-2.0 OR BSD-3-Clause (PDFium: BSD-3-Clause) |
| **py7zr** | **LGPL-2.1-or-later** — see §1 |
| photoshop-python-api *(Windows only)* | MIT |
| pywin32 *(Windows only)* | PSF-2.0 |
| onnxruntime | MIT |
| huggingface-hub | Apache-2.0 |
| jaconv | MIT |
| easyocr | Apache-2.0 |
| natsort | MIT |
| wget | Public domain (unlicensed PyPI package) |
| tokenizers | Apache-2.0 |
| ctranslate2 | MIT |
| sentencepiece | Apache-2.0 |
| transformers | Apache-2.0 |
| torch | BSD-3-Clause |
| torchvision | BSD-3-Clause |
| **pyinstaller** | **GPL-2.0 with bootloader exception** — see §1 |
| psutil | BSD-3-Clause |
| llama-cpp-python | MIT (bundles llama.cpp, MIT) |

`wget` (PyPI) is an unmaintained, effectively public-domain package with no formal license
declaration. Consider replacing it with `httpx`, which is already a dependency.

---

## 5. Rust dependencies (`src-tauri/Cargo.toml`)

The declared direct dependencies (Tauri 2 and its official plugins, tokio, serde, reqwest, rustls,
ed25519-dalek, sha2, chrono, uuid, anyhow, thiserror, log, png, machine-uid, base64, hex,
futures-util) are, to the best of our knowledge, all MIT and/or Apache-2.0 dual-licensed, which is
the norm in the Rust ecosystem.

To generate an exhaustive inventory, run `cargo install cargo-about && cargo about generate` (or
use `cargo-deny`) against `apps/tauri/src-tauri/` and append the output here.

---

## 6. Fonts and assets

`resources/` contains fonts and templates used for typesetting. Each font carries its own license
(commonly SIL OFL for open fonts). Verify the licenses of any font you ship in an installer or use in
published work — several popular comic lettering fonts are **not** free for commercial use.

---

## Reporting a problem

If you believe a component is misattributed here, or that KŌMA Studio is violating a license, please
email <klaus@koma-studio.site>. We will correct it promptly.
