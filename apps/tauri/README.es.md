# KŌMA Studio

> **Un toolkit de escritorio libre y de código abierto para scanlation**: detección, OCR, traducción, limpieza, tipografía y exportación, ejecutándose localmente en tu máquina.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Discord](https://img.shields.io/badge/Discord-join%20us-5865F2?logo=discord)](https://discord.gg/tzaV2efD4e)
[![Website](https://img.shields.io/badge/website-koma--studio.site-111827)](https://koma-studio.site/)

[English](./README.md) · [Português (BR)](./README.pt-BR.md) · **Español** · [日本語](./README.ja.md)

> ### ⚠️ Esta rama es la v2: trabajo en curso
> KŌMA Studio v2 es una reescritura completa sobre **Tauri 2 + React 18**, que reemplaza la v1 basada
> en Electron. **No está lista para producción**: espera cambios incompatibles, funciones incompletas
> y aristas. Versión: `2.0.0-alpha.0`.

---

## Qué es

KŌMA Studio es una aplicación de escritorio para traducir cómics, manga, manhwa y manhua. Reúne todo
el pipeline de scanlation en un solo espacio de trabajo: sueltas las páginas y detecta el texto, lo
lee, lo traduce, borra el rotulado original y te ayuda a componer el resultado.

**100% gratis.** No hay planes, niveles, cuotas, créditos, pruebas ni funciones de pago. Todo lo que
está en el repositorio está disponible para cualquiera. Si usas tu propia clave de API de un
proveedor de IA en la nube, hablas directamente con ese proveedor. Nada se intermedia ni se mide.

**Local primero.** Detección, OCR, inpainting, segmentación y traducción sin conexión se ejecutan en
tu propia máquina mediante un sidecar de Python. Los pesos de los modelos se descargan bajo demanda
desde repositorios públicos (Hugging Face, ModelScope, releases de GitHub) y quedan en caché local.

**Sin telemetría.** La app no recoge analíticas, estadísticas de uso ni datos de comportamiento.
Consulta [Privacidad y telemetría](#privacidad-y-telemetría) para la lista exhaustiva de llamadas.

## Funcionalidades

| Etapa | Qué hace |
| --- | --- |
| **Ingesta** | Importa imágenes, PDF, PSD, CBZ/7z; divide tiras de webtoon en páginas |
| **Detección** | Localiza globos de diálogo y texto suelto (Comic Text Detector, ONNX) |
| **OCR** | Lee texto en JA / KO / ZH / EN y más (Manga OCR, PaddleOCR, EasyOCR, Pororo) |
| **Traducción** | Modelos offline (CTranslate2 / llama.cpp) o proveedores en la nube con tu clave |
| **Segmentación y limpieza** | Enmascara el texto original y reconstruye el fondo (LaMa, ONNX) |
| **Tipografía** | Detección de estilo de fuente, efectos de texto, herramientas de layout, edición inline |
| **Exportación** | PSD con capas y metadatos, imágenes aplanadas, ZIP por lotes |
| **AIO** | Ejecuta todo el pipeline sobre un lote, automático o etapa por etapa |

Además: 14 idiomas de interfaz, feed comunitario, guías de recursos, gestor de modelos, atajos de
teclado, Discord Rich Presence y un actualizador incremental.

## Arquitectura

```
┌───────────────────────────────────────────────────────────┐
│ Shell de escritorio — Tauri 2 (Rust)                      │
│  · ventana/updater/deep links · IPC seguro · cert pinning │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ UI — React 18 + Vite 6 + TypeScript + Zustand       │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Sidecar — FastAPI "mini-backend" (127.0.0.1)        │  │
│  │  detección · OCR · traducción · inpainting · export  │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
             ▲ opcional, self-hosted
             └── auth-server (cuentas, JWT) — incluido en apps/auth-server/
```

| Directorio | Contenido |
| --- | --- |
| `../../packages/interface/` | Aplicación React (páginas, domains, hooks, i18n, stores) |
| `src-tauri/` | Shell Rust, comandos IPC, supervisión del sidecar, updater |
| `scripts/` | Herramientas de build, hardening, auditoría y QA (Node ESM) |
| `resources/` | Fuentes, plantillas, assets de ejemplo |
| `tests/e2e/` | Escenarios de Playwright y la matriz de QA |

## Requisitos

- **[Bun](https://bun.sh) ≥ 1.4**: el único gestor de paquetes y ejecutor de scripts soportado
- **Node.js ≥ 22.18**: usado por los scripts de `scripts/`
- **Rust ≥ 1.77** + los [prerrequisitos de Tauri 2](https://v2.tauri.app/start/prerequisites/)
- **Python 3.11+** — para el sidecar mini-backend (la CI usa 3.12)
- La GPU es opcional; todo tiene respaldo en CPU (más lento)

## Primeros pasos

```bash
git clone https://github.com/klaus-2/koma-studio.git
cd koma-studio
cd apps/tauri

# 1. Dependencias del frontend
bun install

# 2. Entorno
cp .env.example .env        # todos los valores son opcionales en local

# 3. Ejecutar
bun run dev                 # solo la UI, en el navegador
bun run tauri:dev           # app de escritorio completa (aprovisiona el sidecar en la 1.ª ejecución)
```

`bun run tauri:dev` aprovisiona el sidecar de Python automáticamente la primera vez: crea
`.venv-mini` e instala `packages/mini-backend/requirements.txt`. Las ejecuciones posteriores comparan un
SHA-256 de `requirements.txt` con `.venv-mini/.koma-install-stamp.json` y se saltan la instalación por
completo, así que solo un cambio de dependencias provoca una reinstalación.

> El primer aprovisionamiento descarga PyTorch y compañía. Espera varios GB. Las descargas se cachean en
> `.cache/pip`, de modo que una reinstalación posterior las reutiliza. Define `MINI_BACKEND_PYTHON`
> para apuntar a un intérprete concreto si no hay un `python3` adecuado en el `PATH`.

Control manual, cuando lo quieras:

```bash
bun run mini:check          # ¿está listo el sidecar? salida 0 = sí, 1 = hay que aprovisionar
bun run mini:ensure         # aprovisiona solo si hace falta (lo que llama tauri:dev)
bun run mini:install-deps   # fuerza una reinstalación completa

# Aprovisiona un perfil de GPU en vez del conjunto de CPU (ver "Builds de release" abajo)
bun run mini:install-deps --profile nvidia-cuda

KOMA_SKIP_MINI_BOOTSTRAP=1 bun run tauri:dev   # solo el frontend, sin el sidecar
```

## Scripts

| Comando | Para qué |
| --- | --- |
| `bun run dev` | Servidor de desarrollo Vite |
| `bun run tauri:dev` | App de escritorio en desarrollo |
| `bun run build` | `tsc --noEmit` + bundle de producción |
| `bun run tauri:build` | Instaladores de escritorio |
| `bun run test` | Vitest (jsdom) |
| `bun run test:browser` | Vitest en navegador real |
| `bun run test:e2e` | Playwright de extremo a extremo |
| `bun run lint` / `lint:strict` | ESLint (baseline / cero warnings) |
| `bun run typecheck` | Solo TypeScript |
| `bun run audit:lines` | Techo duro de 1000 líneas por archivo |
| `bun run audit:deps` | Fronteras de dependency-cruiser |
| `bun run qa:e2e-plan` | Valida la matriz de escenarios E2E |
| `bun run build:hardened:{win,mac,linux}` | Pipeline de release endurecido |

Tests del mini-backend:

```bash
cd packages/mini-backend
python -m pytest tests -q
```

## Builds de release y perfiles de hardware

`bun run build:hardened:{win,mac,linux}` empieza preguntando qué perfil de
aceleración de hardware debe incrustarse en el build:

```
Select the hardware acceleration profile to bake into this build.
The chosen profile's dependencies replace the CPU set entirely; the
pipeline produces one mini-backend sidecar, not one per profile.

  1) CPU only (default)
     cpu — Portable build. Runs anywhere, no GPU drivers required.
  2) NVIDIA CUDA
     nvidia-cuda — onnxruntime-gpu + the CUDA 12 runtime. Turing (RTX 20xx) and newer.
  ...

Profile [1-6 or id, blank = cpu]:
```

Responde con el número del menú o el id del perfil. La elección determina qué
`packages/mini-backend/requirements*.txt` se instala en `.venv-mini`, y ese venv es el que
PyInstaller congela, así que las bibliotecas nativas del perfil (las DLL de CUDA,
el execution provider de ROCm o de OpenVINO) se compilan **dentro** del único
sidecar `mini-backend` que emite el pipeline. El perfil **sustituye** al conjunto
de CPU; no se produce ningún binario de CPU aparte.

| Perfil | Windows | macOS | Linux | Instala |
| --- | :-: | :-: | :-: | --- |
| `cpu` *(por defecto)* | ✅ | ✅ | ✅ | Solo el conjunto base; portátil, sin drivers de GPU |
| `nvidia-cuda` | ✅ | — | ✅ | `onnxruntime-gpu` + runtime CUDA 12 (RTX 20xx+) |
| `nvidia-cuda-legacy` | ✅ | — | ✅ | La misma stack CUDA 12, ajustada para Pascal (GTX 10xx) |
| `nvidia-tensorrt` | ✅ | — | ✅ | Stack CUDA con el provider TensorRT |
| `amd-rocm` | — | — | ✅ | `onnxruntime-rocm` (no existe build de ROCm para Windows) |
| `intel-openvino` | ✅ | — | ✅ | `onnxruntime-openvino` para iGPU/NPU/CPU de Intel |
| `apple-mps` | — | ✅ | — | Apple Silicon; Metal ya viene en la wheel por defecto de PyTorch |

Todo archivo de perfil empieza con `-r requirements.txt`, así que un build
acelerado es siempre el conjunto base **más** las wheels nativas de ese perfil,
nunca un árbol de dependencias divergente.

### Builds no interactivos

CI no tiene terminal para responder a un prompt, así que el pipeline solo pregunta
cuando stdin es un TTY. Evita la pregunta de dos maneras:

```bash
# Explicit flag
node scripts/build-hardened-release.mjs --platform win --profile nvidia-cuda

# Or an environment variable
KOMA_BUILD_PROFILE=nvidia-cuda bun run build:hardened:win
```

La precedencia es `--profile` › `$KOMA_BUILD_PROFILE` › prompt › `cpu`. Una
ejecución no interactiva sin ninguno de los dos genera `cpu`, lo que mantiene
reproducibles los builds desatendidos. Pedir un perfil que no existe en la
plataforma de destino, `amd-rocm` en Windows, por ejemplo, falla de inmediato en
lugar de caer silenciosamente en CPU.

Dos guardas hacen imposible publicar un build incompatible:

- `.venv-mini/.koma-install-stamp.json` registra el perfil con el que se
  aprovisionó. Compilar CUDA sobre un venv de CPU reinstala en vez de reutilizarlo.
- El pipeline escribe `mini-backend-profile.json` junto al binario congelado y la
  verificación falla si no coincide con el perfil solicitado.

`bun run tauri:dev` no se ve afectado: el desarrollo siempre usa el conjunto de
CPU. Para desarrollar contra un venv acelerado, pasa el perfil explícitamente:

```bash
bun run mini:install-deps --profile nvidia-cuda
```

## Configuración

Todo se controla desde `.env` (ignorado por git). Consulta [`.env.example`](./.env.example) para la
lista comentada. Nada es obligatorio para ejecutarlo en local. Destacados:

| Variable | Significado |
| --- | --- |
| `VITE_AUTH_API_URL` | Auth server self-hosted; la app funciona sin él |
| `VITE_LOCAL_API_URL` | Dirección del mini-backend (por defecto `http://localhost:8001`) |
| `KOMA_MODELS_ROOT` | Dónde se guardan los pesos de IA; vacío = directorio de datos de la app |
| `KOMA_EXTERNAL_STORAGE_ROOT` | Raíz externa opcional para datos grandes de proyecto |
| `BUG_REPORT_DISCORD_WEBHOOK_URL` | Activa el formulario opt-in de bugs; vacío = desactivado |
| `MINI_BACKEND_*_API_KEY` | Tus claves de proveedores en la nube, usadas directamente por el sidecar |

### Opcional: el auth server

Las cuentas, el inicio de sesión y el feed comunitario los sirve **el auth server que viene en `apps/auth-server/`**.
KŌMA Studio funciona completamente en modo local sin él — solo lo necesitas para funciones autenticadas.
Emite JWTs con audience `"koma-studio-backend"`; consulta [`apps/auth-server/.env.example`](../../apps/auth-server/.env.example)
para la lista completa de variables y [`apps/auth-server/README.md`](../../apps/auth-server/README.md) para la configuración.

## Privacidad y telemetría

KŌMA Studio **no incluye analíticas ni telemetría**. No hay seguimiento de eventos, informes de uso
ni beaconing en segundo plano. El conjunto completo de peticiones salientes que puede hacer:

| Llamada | Cuándo | Cómo desactivarla |
| --- | --- | --- |
| Descarga de modelos | Instalas un modelo en el Gestor de Modelos | No lo instales |
| Proveedores de IA en la nube | Configuras tu clave y ejecutas una etapa en la nube | No configures ninguna |
| Informe de errores | Envías el formulario (texto + capturas que adjuntes) | Deja el webhook vacío |
| Comprobación de updates | Al iniciar, consulta la última versión | Desactívalo en Ajustes |
| Discord Rich Presence | Si lo activas; envía solo la actividad actual | Desactivado por defecto |
| Auth server | Solo si configuras uno e inicias sesión | No configures ninguno |

Los logs de error se escriben **localmente** (winston/`tauri-plugin-log`) y nunca se suben
automáticamente. Las comprobaciones antiabuso de `interface/security/` y el handshake de registro del
escritorio son señales locales de integridad para instalaciones self-hosted, no seguimiento de
usuarios.

## Modelos de terceros y licencias

El código de la aplicación es MIT. **Los modelos de IA se descargan en tiempo de ejecución y tienen
sus propias licencias**, que eres responsable de respetar. Algunas son más restrictivas que MIT y
podrían no permitir uso comercial. En particular:

| Componente | Origen | Licencia |
| --- | --- | --- |
| Comic Text Detector | [dmMaze/comic-text-detector](https://github.com/dmMaze/comic-text-detector) | **GPL-3.0** |
| Manga OCR | [kha-white/manga-ocr](https://github.com/kha-white/manga-ocr) | Apache-2.0 |
| Pororo / brainOCR | [kakaobrain/pororo](https://github.com/kakaobrain/pororo) | Apache-2.0 |
| Pesos PaddleOCR / RapidOCR | ModelScope `RapidAI/RapidOCR` | Apache-2.0 |
| Inpainting LaMa | [advimman/lama](https://github.com/advimman/lama) | Apache-2.0 |
| EasyOCR | [JaidedAI/EasyOCR](https://github.com/JaidedAI/EasyOCR) | Apache-2.0 |

⚠️ Parte del código adaptador en `packages/mini-backend/models/` deriva de esos proyectos. Si redistribuyes una
build, revisa cada licencia. **Los componentes GPL-3.0 en particular tienen obligaciones de
copyleft** que una distribución downstream debe cumplir. Consulta
[`docs/THIRD-PARTY-NOTICES.md`](../../docs/THIRD-PARTY-NOTICES.md).

## Contribuir

Las contribuciones son bienvenidas. Lee [CONTRIBUTING.md](../../CONTRIBUTING.md) para el flujo de trabajo
y [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md) para las expectativas de la comunidad. Problemas de
seguridad: consulta [SECURITY.md](../../SECURITY.md). Por favor no abras una issue pública para una
vulnerabilidad.

## Comunidad

- Discord: <https://discord.gg/tzaV2efD4e>
- Web: <https://koma-studio.site/>
- Correo: <klaus@koma-studio.site>

## Licencia

[MIT](../../LICENSE) © Klaus