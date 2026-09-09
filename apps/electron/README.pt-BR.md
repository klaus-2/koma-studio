# KŌMA Studio

> **Um toolkit desktop livre e de código aberto para scanlation**: detecção, OCR, tradução, limpeza, diagramação e exportação, rodando localmente na sua máquina.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Discord](https://img.shields.io/badge/Discord-join%20us-5865F2?logo=discord)](https://discord.gg/tzaV2efD4e)
[![Website](https://img.shields.io/badge/website-koma--studio.site-111827)](https://koma-studio.site/)

[English](./README.md) · **Português (BR)** · [Español](./README.es.md) · [日本語](./README.ja.md)

> ### ⚠️ Este shell é a v1: modo de manutenção
> A KŌMA Studio v1 é o shell **Electron + React 18**. Recursos novos pousam no shell v2
> (**Tauri 2 + Rust**, `apps/tauri/`), que compartilha a mesma UI React e o mesmo backend Python de IA.
> A v1 continua disponível e recebe correções, mas a v2 é a linha principal.

---

## O que é

KŌMA Studio é um aplicativo desktop para traduzir quadrinhos, mangá, manhwa e manhua. Ele reúne todo
o pipeline de scanlation em um só lugar: você joga as páginas dentro e ele detecta o texto, lê,
traduz, apaga o letreiramento original e ajuda a diagramar o resultado.

**100% gratuito.** Não existem planos, tiers, cotas, créditos, testes ou recursos pagos. Tudo que
está no repositório está disponível para todo mundo. Se você usar sua própria chave de API de um
provedor de IA na nuvem, a conversa é direta com esse provedor. Nada é intermediado ou medido por nós.

**Local primeiro.** Detecção, OCR, inpainting, segmentação e tradução offline rodam na sua máquina
através de um sidecar Python. Os pesos dos modelos são baixados sob demanda de repositórios públicos
(Hugging Face, ModelScope, releases do GitHub) e ficam em cache local.

**Sem telemetria.** O app não coleta analytics, estatísticas de uso nem dados comportamentais. Veja
[Privacidade e telemetria](#privacidade-e-telemetria) para a lista exaustiva de chamadas de rede.

| Antes | Depois |
|:---:|:---:|
| ![Antes da limpeza](resources/cl-before.webp) | ![Depois da limpeza](resources/cl-after.webp) |

## Recursos

| Etapa | O que faz |
| --- | --- |
| **Ingestão** | Importa imagens, PDF, PSD, CBZ/7z; fatia tiras de webtoon em páginas |
| **Detecção** | Localiza balões e texto solto (Comic Text Detector, ONNX) |
| **OCR** | Lê texto em JA / KO / ZH / EN e outros (Manga OCR, PaddleOCR, EasyOCR, Pororo) |
| **Tradução** | Modelos offline (CTranslate2 / llama.cpp) ou provedores de nuvem com sua chave |
| **Segmentação e limpeza** | Cria máscara do texto original e reconstrói o fundo (LaMa, ONNX) |
| **Diagramação** | Detecção de estilo de fonte, efeitos de texto, ferramentas de layout, edição inline |
| **Exportação** | PSD com camadas e metadados, imagens achatadas, ZIP em lote |
| **AIO** | Roda o pipeline inteiro em lote, automático ou etapa por etapa |

Além disso: 14 idiomas de interface, feed da comunidade, guias de recursos, gerenciador de modelos,
atalhos de teclado, Discord Rich Presence e atualizador incremental.

## Download

Prefere não buildar do zero? Baixe um instalador na página de
[Releases do GitHub](https://github.com/klaus-2/koma-studio/releases) ou visite
[koma-studio.site](https://koma-studio.site/).

## Arquitetura

Este shell é um dos dois apps desktop do monorepo KŌMA Studio. O outro
(Tauri, v2) compartilha a mesma UI React e o mesmo backend Python de IA.

```
┌───────────────────────────────────────────────────────────┐
│ Shell desktop — Electron (Node.js)                        │
│  · janela/updater/deep links · IPC bridge · cert pinning  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ UI — React 18 + Vite + TypeScript + Zustand         │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Sidecar — FastAPI "mini-backend" (127.0.0.1)        │  │
│  │  detecção · OCR · tradução · inpainting · exportação │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
             ▲ opcional, self-hosted
             └── auth-server (contas, JWT) — incluído em apps/auth-server/
```

| Diretório | Conteúdo |
| --- | --- |
| `electron/` | Processos main e preload: gerência de janelas, IPC, supervisão do sidecar, updater |
| `scripts/` | Ferramentas de build, dev-stack, hardening e QA (Node ESM) |
| `resources/` | Ícones, fontes, templates, assets de exemplo |
| `tests/` | Suítes `node --test` (marcadores do sidecar, checagens de runtime) |

A aplicação React em si vive em [`packages/interface/`](../../packages/interface/), compartilhada
com o shell Tauri; o sidecar Python em [`packages/mini-backend/`](../../packages/mini-backend/).

## Requisitos

- **[Bun](https://bun.sh) ≥ 1.4**: único gerenciador de pacotes e executor de scripts suportado
- **Node.js ≥ 22.18**: usado pelo Vite, pelo tooling do Electron e pelos scripts de build (a CI roda 22)
- **Python 3.11+**: para o sidecar mini-backend (a CI usa 3.12)
- **PostgreSQL**: só se você rodar o auth server opcional
- GPU é opcional; tudo tem fallback para CPU (mais lento)

## Começando

```bash
git clone https://github.com/klaus-2/koma-studio.git
cd koma-studio

# 1. Dependências (rode da raiz do monorepo para o wiring dos workspaces)
bun install

cd apps/electron

# 2. Ambiente
cp .env.example .env.development   # todos os valores são opcionais para uso local

# 3. Executar
bun run dev              # stack completa: Electron + Vite + bootstrap do sidecar
bun run dev:vite         # só a UI, no navegador
```

O `bun run dev` provisiona o sidecar Python automaticamente na primeira vez: cria o
`.venv-mini` e instala o `packages/mini-backend/requirements.txt`. Execuções seguintes comparam um
SHA-256 dos requirements com o `.venv-mini/.koma-install-stamp.json` e pulam a instalação por
completo, de modo que só uma mudança de dependência dispara reinstalação.

> O primeiro provisionamento baixa PyTorch e companhia. Espere vários GB. Os downloads ficam em cache
> em `.cache/pip`, então uma reinstalação posterior os reaproveita. Defina `MINI_BACKEND_PYTHON` para
> apontar para um interpretador específico se um `python3` adequado não estiver no `PATH`.

Controle manual, quando você quiser:

```bash
bun run dev:mini          # provisiona/inicia só o sidecar
bun run dev:auth          # só o auth server incluso (terminal próprio)
bun run mini:install-deps # força uma reinstalação completa do venv do sidecar
```

## Scripts

| Comando | Para quê |
| --- | --- |
| `bun run dev` | Stack de dev completa (Electron + Vite + sidecar + auth opcional) |
| `bun run dev:vite` | Só o servidor Vite |
| `bun run dev:mini` | Só o sidecar mini-backend |
| `bun run dev:auth` | Só o auth server |
| `bun run test` | Suítes `node --test` |
| `bun run test:python` | Suítes do mini-backend (pytest) |
| `bun run lint` | ESLint |
| `bun run typecheck` | Apenas TypeScript |
| `bun run build:app` | Build de produção (React + Electron) |
| `bun run build:mini` | Congela o sidecar mini-backend (seletor de perfil) |
| `bun run build:all` | `build:mini` + `build:app` |
| `bun run build:desktop` | Instaladores desktop |
| `bun run build:release` | Artefatos de release |
| `bun run build:hardened:{win,mac,linux}` | Pipeline de release endurecido |
| `bun run release:{win,mac,linux}` | Build + publicação via electron-builder |

Testes do mini-backend:

```bash
bun run test:python       # a partir de apps/electron
```

## Builds de release e perfis de hardware

Quando o build inclui o mini-backend (`build:mini`, `build:all`, `build:desktop`), um prompt
interativo pergunta qual perfil de aceleração de hardware deve ser embutido no build:

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

A escolha define qual `packages/mini-backend/requirements*.txt` é instalado no `.venv-mini`,
e é esse venv que o pipeline congela, então as bibliotecas nativas do perfil (as DLLs do CUDA,
o execution provider do ROCm ou do OpenVINO) são compiladas **dentro** do único sidecar
`mini-backend` que o pipeline gera. O perfil **substitui** o conjunto de CPU; nenhum binário
de CPU separado é produzido junto.

| Perfil | Windows | macOS | Linux | Instala |
| --- | :-: | :-: | :-: | --- |
| `cpu` *(padrão)* | ✅ | ✅ | ✅ | Só o conjunto base; portátil, sem drivers de GPU |
| `nvidia-cuda` | ✅ | — | ✅ | `onnxruntime-gpu` + runtime CUDA 12 (RTX 20xx+) |
| `nvidia-cuda-legacy` | ✅ | — | ✅ | Mesma stack CUDA 12, ajustada para Pascal (GTX 10xx) |
| `nvidia-tensorrt` | ✅ | — | ✅ | Stack CUDA com o provider TensorRT |
| `amd-rocm` | — | — | ✅ | `onnxruntime-rocm` (não existe build ROCm para Windows) |
| `intel-openvino` | ✅ | — | ✅ | `onnxruntime-openvino` para iGPU/NPU/CPU Intel |
| `apple-mps` | — | ✅ | — | Apple Silicon; o Metal já vem na wheel padrão do PyTorch |

### Builds não-interativos

A CI não tem terminal para responder a um prompt. Pule a pergunta de duas formas:

```bash
# Explicit flag
bun run build:mini -- --profile nvidia-cuda

# Or an environment variable
MINI_BACKEND_ACCELERATION_PROFILE=nvidia-cuda bun run build:mini
```

A precedência é `--profile` › `$MINI_BACKEND_ACCELERATION_PROFILE` › prompt › `cpu`. Pedir um
perfil que não existe na plataforma alvo, `amd-rocm` no Windows, por exemplo, falha imediatamente
em vez de cair silenciosamente no CPU.

### Cache de build

Os builds são incrementais: fontes inalteradas reutilizam o build anterior do mini-backend
(`.build-cache/`), e as dependências Python só são reinstaladas quando os requirements ou o perfil
ativo mudam. Force um rebuild completo com:

```bash
bun run build:mini -- --force        # ou MINI_BACKEND_FORCE_REBUILD=1
```

## Configuração

Tudo é controlado pelo `.env.development` / `.env.production` (ignorados pelo git). Veja
[`.env.example`](./.env.example) para a lista comentada. Nada é obrigatório para rodar localmente.
Destaques:

| Variável | Significado |
| --- | --- |
| `VITE_AUTH_API_URL` | Auth server self-hosted; o app funciona sem ele |
| `VITE_AUTH_DISABLED` | `true` = modo totalmente local (sem telas de login, recursos de auth ocultos) |
| `VITE_LOCAL_API_URL` | Endereço do mini-backend (padrão `http://localhost:8001`) |
| `KOMA_MODELS_ROOT` | Onde os pesos de IA ficam; vazio = diretório de dados do app |
| `BUG_REPORT_DISCORD_WEBHOOK_URL` | Habilita o formulário opt-in de bug; vazio = desativado |
| `MINI_BACKEND_PYTHON` | Interpretador Python explícito para o sidecar |
| `MINI_BACKEND_*_API_KEY` | Suas chaves de provedores de nuvem, usadas direto pelo sidecar |

### Opcional: o auth server

Contas, login e o feed da comunidade são servidos pelo **auth server que vem no `apps/auth-server/`**.
A KŌMA Studio funciona inteiramente em modo local sem ele. Defina `VITE_AUTH_DISABLED=true` e o app
abre direto no dashboard, pulando o login e escondendo os recursos dependentes de auth (feed, ranking
de modelos, configurações de conta). Ele emite JWTs com audience `"koma-studio-backend"`; veja
[`apps/auth-server/.env.example`](../../apps/auth-server/.env.example) para a lista completa de envs e
[`apps/auth-server/README.md`](../../apps/auth-server/README.md) para o setup.

## Privacidade e telemetria

A KŌMA Studio **não tem analytics nem telemetria**. Não há rastreamento de eventos, relatório de uso
nem beaconing em segundo plano. O conjunto completo de requisições que o app pode fazer:

| Chamada | Quando | Como desligar |
| --- | --- | --- |
| Download de modelos | Você instala um modelo no Gerenciador | Não instale |
| Provedores de IA na nuvem | Você configura sua chave e roda uma etapa na nuvem | Não configure |
| Reporte de bug | Você envia o formulário (texto + prints que anexar) | Deixe o webhook vazio |
| Verificação de update | Na inicialização, consulta a última versão | Desative em Configurações |
| Discord Rich Presence | Se você ativar; envia só a atividade atual | Desligado por padrão |
| Auth server | Só se você configurar um e fizer login | Não configure |

Logs de erro são gravados **localmente** (electron-log) e nunca são enviados automaticamente.
As checagens anti-abuso em `interface/security/` e o handshake de registro do desktop são sinais
locais de integridade para instalações self-hosted, não rastreamento de usuário.

## Modelos de terceiros e licenças

O código da aplicação é MIT. **Os modelos de IA são baixados em tempo de execução e têm licenças
próprias**, que você é responsável por respeitar. Algumas são mais restritivas que a MIT e podem não
permitir uso comercial. Em especial:

| Componente | Origem | Licença |
| --- | --- | --- |
| Comic Text Detector | [dmMaze/comic-text-detector](https://github.com/dmMaze/comic-text-detector) | **GPL-3.0** |
| Manga OCR | [kha-white/manga-ocr](https://github.com/kha-white/manga-ocr) | Apache-2.0 |
| Pororo / brainOCR | [kakaobrain/pororo](https://github.com/kakaobrain/pororo) | Apache-2.0 |
| Pesos PaddleOCR / RapidOCR | ModelScope `RapidAI/RapidOCR` | Apache-2.0 |
| Inpainting LaMa | [advimman/lama](https://github.com/advimman/lama) | Apache-2.0 |
| EasyOCR | [JaidedAI/EasyOCR](https://github.com/JaidedAI/EasyOCR) | Apache-2.0 |

⚠️ Parte do código adaptador em `packages/mini-backend/models/` deriva desses projetos. Se você
redistribuir um build, revise cada licença. **Componentes GPL-3.0 em particular têm obrigações de
copyleft** que uma distribuição downstream precisa cumprir. Veja
[`docs/THIRD-PARTY-NOTICES.md`](../../docs/THIRD-PARTY-NOTICES.md).

## Contribuindo

Contribuições são bem-vindas. Leia [CONTRIBUTING.md](../../CONTRIBUTING.md) para o fluxo e
[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md) para as expectativas da comunidade. Problemas de
segurança: veja [SECURITY.md](../../SECURITY.md). Por favor não abra uma issue pública para vulnerabilidades.

## Comunidade

- Discord: <https://discord.gg/tzaV2efD4e>
- Site: <https://koma-studio.site/>
- E-mail: <klaus@koma-studio.site>

## Licença

[MIT](../../LICENSE) © Klaus
