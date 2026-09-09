# KŌMA Studio

> **Un toolkit de escritorio libre y de código abierto para scanlation**: detección, OCR, traducción, limpieza, tipografía y exportación, ejecutándose localmente en tu máquina.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Discord](https://img.shields.io/badge/Discord-join%20us-5865F2?logo=discord)](https://discord.gg/tzaV2efD4e)
[![Website](https://img.shields.io/badge/website-koma--studio.site-111827)](https://koma-studio.site/)

[English](./README.md) · [Português (BR)](./README.pt-BR.md) · **Español** · [日本語](./README.ja.md)

> ### ⚠️ Este shell es la v1: modo de mantenimiento
> KŌMA Studio v1 es el shell **Electron + React 18**. Las funciones nuevas aterrizan en el shell v2
> (**Tauri 2 + Rust**, `apps/tauri/`), que comparte la misma UI de React y el mismo backend Python de IA.
> La v1 sigue disponible y recibe correcciones, pero la v2 es la línea principal.

---

## Qué es

KŌMA Studio es una aplicación de escritorio para traducir cómics, manga, manhwa y manhua. Reúne todo
el pipeline de scanlation en un solo espacio de trabajo: sueltas las páginas y detecta el texto, lo
lee, lo traduce, borra el rotulado original y te ayuda a componer el resultado.

**100% gratis.** No hay planes, niveles, cuotas, créditos, pruebas ni funciones de pago. Todo lo que
está en el repositorio está disponible para cualquiera. Si usas tu propia clave de API de un
proveedor de IA en la nube, hablas directamente con ese proveedor. Nada se intermedia ni se mide por nosotros.

**Local primero.** Detección, OCR, inpainting, segmentación y traducción sin conexión se ejecutan en
tu propia máquina mediante un sidecar de Python. Los pesos de los modelos se descargan bajo demanda
desde repositorios públicos (Hugging Face, ModelScope, releases de GitHub) y quedan en caché local.

**Sin telemetría.** La app no recoge analíticas, estadísticas de uso ni datos de comportamiento.
Consulta [Privacidad y telemetría](#privacidad-y-telemetría) para la lista exhaustiva de llamadas.

| Antes | Después |
|:---:|:---:|
| ![Antes de la limpieza](resources/cl-before.webp) | ![Después de la limpieza](resources/cl-after.webp) |

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

## Descargas

¿Prefieres no compilar desde cero? Descarga un instalador desde la página de
[Releases de GitHub](https://github.com/klaus-2/koma-studio/releases) o visita
[koma-studio.site](https://koma-studio.site/).

## Arquitectura

Este shell es una de las dos apps de escritorio del monorepo KŌMA Studio. La otra
(Tauri, v2) comparte la misma UI de React y el mismo backend Python de IA.

```
┌───────────────────────────────────────────────────────────┐
│ Shell de escritorio — Electron (Node.js)                  │
│  · ventana/updater/deep links · IPC bridge · cert pinning │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ UI — React 18 + Vite + TypeScript + Zustand         │  │
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
| `electron/` | Procesos main y preload: gestión de ventanas, IPC, supervisión del sidecar, updater |
| `scripts/` | Herramientas de build, dev-stack, hardening y QA (Node ESM) |
| `resources/` | Iconos, fuentes, plantillas, assets de ejemplo |
| `tests/` | Suites `node --test` (marcadores del sidecar, comprobaciones de runtime) |

La aplicación React en sí vive en [`packages/interface/`](../../packages/interface/), compartida
con el shell Tauri; el sidecar de Python en [`packages/mini-backend/`](../../packages/mini-backend/).

## Requisitos

- **[Bun](https://bun.sh) ≥ 1.4**: el único gestor de paquetes y ejecutor de scripts soportado
- **Node.js ≥ 22.18**: usado por Vite, el tooling de Electron y los scripts de build (la CI usa 22)
- **Python 3.11+**: para el sidecar mini-backend (la CI usa 3.12)
- **PostgreSQL**: solo si ejecutas el auth server opcional
- La GPU es opcional; todo tiene respaldo en CPU (más lento)

## Primeros pasos

```bash
git clone https://github.com/klaus-2/koma-studio.git
cd koma-studio

# 1. Dependencias (ejecuta desde la raíz del monorepo para el wiring de los workspaces)
bun install

cd apps/electron

# 2. Entorno
cp .env.example .env.development   # todos los valores son opcionales en local

# 3. Ejecutar
bun run dev              # stack completa: Electron + Vite + bootstrap del sidecar
bun run dev:vite         # solo la UI, en el navegador
```

`bun run dev` aprovisiona el sidecar de Python automáticamente la primera vez: crea
`.venv-mini` e instala `packages/mini-backend/requirements.txt`. Las ejecuciones posteriores comparan
un SHA-256 de los requirements con `.venv-mini/.koma-install-stamp.json` y se saltan la instalación
por completo, así que solo un cambio de dependencias provoca una reinstalación.

> El primer aprovisionamiento descarga PyTorch y compañía. Espera varios GB. Las descargas se cachean
> en `.cache/pip`, de modo que una reinstalación posterior las reutiliza. Define `MINI_BACKEND_PYTHON`
> para apuntar a un intérprete concreto si no hay un `python3` adecuado en el `PATH`.

Control manual, cuando lo quieras:

```bash
bun run dev:mini          # aprovisiona/inicia solo el sidecar
bun run dev:auth          # solo el auth server incluido (terminal propio)
bun run mini:install-deps # fuerza una reinstalación completa del venv del sidecar
```

## Scripts

| Comando | Para qué |
| --- | --- |
| `bun run dev` | Stack de dev completa (Electron + Vite + sidecar + auth opcional) |
| `bun run dev:vite` | Solo el servidor Vite |
| `bun run dev:mini` | Solo el sidecar mini-backend |
| `bun run dev:auth` | Solo el auth server |
| `bun run test` | Suites `node --test` |
| `bun run test:python` | Suites del mini-backend (pytest) |
| `bun run lint` | ESLint |
| `bun run typecheck` | Solo TypeScript |
| `bun run build:app` | Build de producción (React + Electron) |
| `bun run build:mini` | Congela el sidecar mini-backend (selector de perfil) |
| `bun run build:all` | `build:mini` + `build:app` |
| `bun run build:desktop` | Instaladores de escritorio |
| `bun run build:release` | Artefactos de release |
| `bun run build:hardened:{win,mac,linux}` | Pipeline de release endurecido |
| `bun run release:{win,mac,linux}` | Build + publicación vía electron-builder |

Tests del mini-backend:

```bash
bun run test:python       # desde apps/electron
```

## Builds de release y perfiles de hardware

Cuando el build incluye el mini-backend (`build:mini`, `build:all`, `build:desktop`), un prompt
interactivo pregunta qué perfil de aceleración de hardware debe incrustarse en el build:

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

La elección determina qué `packages/mini-backend/requirements*.txt` se instala en `.venv-mini`,
y ese venv es el que el pipeline congela, así que las bibliotecas nativas del perfil (las DLL de
CUDA, el execution provider de ROCm o de OpenVINO) se compilan **dentro** del único sidecar
`mini-backend` que emite el pipeline. El perfil **sustituye** al conjunto de CPU; no se produce
ningún binario de CPU aparte.

| Perfil | Windows | macOS | Linux | Instala |
| --- | :-: | :-: | :-: | --- |
| `cpu` *(por defecto)* | ✅ | ✅ | ✅ | Solo el conjunto base; portátil, sin drivers de GPU |
| `nvidia-cuda` | ✅ | — | ✅ | `onnxruntime-gpu` + runtime CUDA 12 (RTX 20xx+) |
| `nvidia-cuda-legacy` | ✅ | — | ✅ | La misma stack CUDA 12, ajustada para Pascal (GTX 10xx) |
| `nvidia-tensorrt` | ✅ | — | ✅ | Stack CUDA con el provider TensorRT |
| `amd-rocm` | — | — | ✅ | `onnxruntime-rocm` (no existe build de ROCm para Windows) |
| `intel-openvino` | ✅ | — | ✅ | `onnxruntime-openvino` para iGPU/NPU/CPU de Intel |
| `apple-mps` | — | ✅ | — | Apple Silicon; Metal ya viene en la wheel por defecto de PyTorch |

### Builds no interactivos

La CI no tiene terminal para responder a un prompt. Evita la pregunta de dos maneras:

```bash
# Explicit flag
bun run build:mini -- --profile nvidia-cuda

# Or an environment variable
MINI_BACKEND_ACCELERATION_PROFILE=nvidia-cuda bun run build:mini
```

La precedencia es `--profile` › `$MINI_BACKEND_ACCELERATION_PROFILE` › prompt › `cpu`. Pedir un
perfil que no existe en la plataforma de destino, `amd-rocm` en Windows, por ejemplo, falla de
inmediato en lugar de caer silenciosamente en CPU.

### Caché de build

Los builds son incrementales: las fuentes sin cambios reutilizan el build anterior del mini-backend
(`.build-cache/`), y las dependencias de Python solo se reinstalan cuando cambian los requirements
o el perfil activo. Fuerza un rebuild completo con:

```bash
bun run build:mini -- --force        # o MINI_BACKEND_FORCE_REBUILD=1
```

## Configuración

Todo se controla desde `.env.development` / `.env.production` (ignorados por git). Consulta
[`.env.example`](./.env.example) para la lista comentada. Nada es obligatorio para ejecutarlo en
local. Destacados:

| Variable | Significado |
| --- | --- |
| `VITE_AUTH_API_URL` | Auth server self-hosted; la app funciona sin él |
| `VITE_AUTH_DISABLED` | `true` = modo solo local (sin pantallas de login, funciones de auth ocultas) |
| `VITE_LOCAL_API_URL` | Dirección del mini-backend (por defecto `http://localhost:8001`) |
| `KOMA_MODELS_ROOT` | Dónde se guardan los pesos de IA; vacío = directorio de datos de la app |
| `BUG_REPORT_DISCORD_WEBHOOK_URL` | Activa el formulario opt-in de bugs; vacío = desactivado |
| `MINI_BACKEND_PYTHON` | Intérprete de Python explícito para el sidecar |
| `MINI_BACKEND_*_API_KEY` | Tus claves de proveedores en la nube, usadas directamente por el sidecar |

### Opcional: el auth server

Las cuentas, el inicio de sesión y el feed comunitario los sirve **el auth server que viene en `apps/auth-server/`**.
KŌMA Studio funciona completamente en modo local sin él. Define `VITE_AUTH_DISABLED=true` y la app
abre directo en el dashboard, saltándose el login y ocultando las funciones que dependen de auth
(feed, ranking de modelos, ajustes de cuenta). Emite JWTs con audience `"koma-studio-backend"`;
consulta [`apps/auth-server/.env.example`](../../apps/auth-server/.env.example) para la lista completa
de variables y [`apps/auth-server/README.md`](../../apps/auth-server/README.md) para la configuración.

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

Los logs de error se escriben **localmente** (electron-log) y nunca se suben automáticamente.
Las comprobaciones antiabuso de `interface/security/` y el handshake de registro del escritorio son
señales locales de integridad para instalaciones self-hosted, no seguimiento de usuarios.

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

⚠️ Parte del código adaptador en `packages/mini-backend/models/` deriva de esos proyectos. Si
redistribuyes una build, revisa cada licencia. **Los componentes GPL-3.0 en particular tienen
obligaciones de copyleft** que una distribución downstream debe cumplir. Consulta
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
