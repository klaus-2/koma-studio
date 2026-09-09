# KŌMA Studio

> **Um toolkit desktop livre e de código aberto para scanlation**: detecção, OCR, tradução, limpeza, diagramação e exportação, rodando localmente na sua máquina.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Discord](https://img.shields.io/badge/Discord-join%20us-5865F2?logo=discord)](https://discord.gg/tzaV2efD4e)
[![Website](https://img.shields.io/badge/website-koma--studio.site-111827)](https://koma-studio.site/)

[English](./README.md) · **Português (BR)** · [Español](./README.es.md) · [日本語](./README.ja.md)

> ### ⚠️ Esta branch é a v2 — em desenvolvimento
> A KŌMA Studio v2 é uma reescrita completa em **Tauri 2 + React 18**, substituindo a v1 em Electron.
> **Não está pronta para produção**: espere mudanças incompatíveis, recursos incompletos e arestas.
> Versão: `2.0.0-alpha.0`.

---

## O que é

KŌMA Studio é um aplicativo desktop para traduzir quadrinhos, mangá, manhwa e manhua. Ele reúne todo
o pipeline de scanlation em um só lugar: você joga as páginas dentro e ele detecta o texto, lê,
traduz, apaga o letreiramento original e ajuda a diagramar o resultado.

**100% gratuito.** Não existem planos, tiers, cotas, créditos, testes ou recursos pagos. Tudo que
está no repositório está disponível para todo mundo. Se você usar sua própria chave de API de um
provedor de IA na nuvem, a conversa é direta com esse provedor. Nada é intermediado ou medido.

**Local primeiro.** Detecção, OCR, inpainting, segmentação e tradução offline rodam na sua máquina
através de um sidecar Python. Os pesos dos modelos são baixados sob demanda de repositórios públicos
(Hugging Face, ModelScope, releases do GitHub) e ficam em cache local.

**Sem telemetria.** O app não coleta analytics, estatísticas de uso nem dados comportamentais. Veja
[Privacidade e telemetria](#privacidade-e-telemetria) para a lista exaustiva de chamadas de rede.

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

## Arquitetura

```
┌───────────────────────────────────────────────────────────┐
│ Shell desktop — Tauri 2 (Rust)                            │
│  · janela/updater/deep links · IPC seguro · cert pinning  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ UI — React 18 + Vite 6 + TypeScript + Zustand       │  │
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
| `../../packages/interface/` | Aplicação React (páginas, domains, hooks, i18n, stores) |
| `src-tauri/` | Shell Rust, comandos IPC, supervisão do sidecar, updater |
| `scripts/` | Ferramentas de build, hardening, auditoria e QA (Node ESM) |
| `resources/` | Fontes, templates, assets de exemplo |
| `tests/e2e/` | Cenários Playwright e a matriz de QA |

## Requisitos

- **[Bun](https://bun.sh) ≥ 1.4**: único gerenciador de pacotes e executor de scripts suportado
- **Node.js ≥ 22.18**: usado pelos scripts em `scripts/`
- **Rust ≥ 1.77** + os [pré-requisitos do Tauri 2](https://v2.tauri.app/start/prerequisites/)
- **Python 3.11+** — para o sidecar mini-backend (a CI usa 3.12)
- GPU é opcional; tudo tem fallback para CPU (mais lento)

## Começando

```bash
git clone https://github.com/klaus-2/koma-studio.git
cd koma-studio
cd apps/tauri

# 1. Dependências do frontend
bun install

# 2. Ambiente
cp .env.example .env        # todos os valores são opcionais para uso local

# 3. Executar
bun run dev                 # só a UI, no navegador
bun run tauri:dev           # app desktop completo (provisiona o sidecar Python na 1ª execução)
```

O `bun run tauri:dev` provisiona o sidecar Python automaticamente na primeira vez: cria o
`.venv-mini` e instala o `packages/mini-backend/requirements.txt`. Execuções seguintes comparam um SHA-256 do
`requirements.txt` com o `.venv-mini/.koma-install-stamp.json` e pulam a instalação por completo, de
modo que só uma mudança de dependência dispara reinstalação.

> O primeiro provisionamento baixa PyTorch e companhia. Espere vários GB. Os downloads ficam em cache em
> `.cache/pip`, então uma reinstalação posterior os reaproveita. Defina `MINI_BACKEND_PYTHON` para
> apontar para um interpretador específico se um `python3` adequado não estiver no `PATH`.

Controle manual, quando você quiser:

```bash
bun run mini:check          # o sidecar está pronto? saída 0 = sim, 1 = precisa provisionar
bun run mini:ensure         # provisiona só se necessário (o que o tauri:dev chama)
bun run mini:install-deps   # força uma reinstalação completa

# Provisiona um perfil de GPU em vez do conjunto de CPU (veja "Builds de release" abaixo)
bun run mini:install-deps --profile nvidia-cuda

KOMA_SKIP_MINI_BOOTSTRAP=1 bun run tauri:dev   # só o frontend, sem o sidecar
```

## Scripts

| Comando | Para quê |
| --- | --- |
| `bun run dev` | Servidor de desenvolvimento Vite |
| `bun run tauri:dev` | App desktop em desenvolvimento |
| `bun run build` | `tsc --noEmit` + bundle de produção |
| `bun run tauri:build` | Instaladores desktop |
| `bun run test` | Vitest (jsdom) |
| `bun run test:browser` | Vitest em navegador real |
| `bun run test:e2e` | Playwright ponta a ponta |
| `bun run lint` / `lint:strict` | ESLint (baseline / zero warnings) |
| `bun run typecheck` | Apenas TypeScript |
| `bun run audit:lines` | Teto rígido de 1000 linhas por arquivo |
| `bun run audit:deps` | Fronteiras do dependency-cruiser |
| `bun run qa:e2e-plan` | Valida a matriz de cenários E2E |
| `bun run build:hardened:{win,mac,linux}` | Pipeline de release endurecido |

Testes do mini-backend:

```bash
cd packages/mini-backend
python -m pytest tests -q
```

## Builds de release e perfis de hardware

O `bun run build:hardened:{win,mac,linux}` começa perguntando qual perfil de
aceleração de hardware deve ser embutido no build:

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

Responda com o número do menu ou o id do perfil. A escolha define qual
`packages/mini-backend/requirements*.txt` é instalado no `.venv-mini`, e é esse venv que o
PyInstaller congela, então as bibliotecas nativas do perfil (as DLLs do CUDA, o
execution provider do ROCm ou do OpenVINO) são compiladas **dentro** do único
sidecar `mini-backend` que o pipeline gera. O perfil **substitui** o conjunto de
CPU; nenhum binário de CPU separado é produzido junto.

| Perfil | Windows | macOS | Linux | Instala |
| --- | :-: | :-: | :-: | --- |
| `cpu` *(padrão)* | ✅ | ✅ | ✅ | Só o conjunto base; portátil, sem drivers de GPU |
| `nvidia-cuda` | ✅ | — | ✅ | `onnxruntime-gpu` + runtime CUDA 12 (RTX 20xx+) |
| `nvidia-cuda-legacy` | ✅ | — | ✅ | Mesma stack CUDA 12, ajustada para Pascal (GTX 10xx) |
| `nvidia-tensorrt` | ✅ | — | ✅ | Stack CUDA com o provider TensorRT |
| `amd-rocm` | — | — | ✅ | `onnxruntime-rocm` (não existe build ROCm para Windows) |
| `intel-openvino` | ✅ | — | ✅ | `onnxruntime-openvino` para iGPU/NPU/CPU Intel |
| `apple-mps` | — | ✅ | — | Apple Silicon; o Metal já vem na wheel padrão do PyTorch |

Todo arquivo de perfil começa com `-r requirements.txt`, então um build acelerado
é sempre o conjunto base **mais** as wheels nativas daquele perfil, nunca uma
árvore de dependências divergente.

### Builds não-interativos

A CI não tem terminal para responder a um prompt, então o pipeline só pergunta
quando o stdin é um TTY. Pule a pergunta de duas formas:

```bash
# Explicit flag
node scripts/build-hardened-release.mjs --platform win --profile nvidia-cuda

# Or an environment variable
KOMA_BUILD_PROFILE=nvidia-cuda bun run build:hardened:win
```

A precedência é `--profile` › `$KOMA_BUILD_PROFILE` › prompt › `cpu`. Uma execução
não-interativa sem nenhum dos dois gera `cpu`, o que mantém builds desassistidos
reprodutíveis. Pedir um perfil que não existe na plataforma alvo, `amd-rocm` no
Windows, por exemplo, falha imediatamente em vez de cair silenciosamente no CPU.

Dois guardas tornam impossível publicar um build incompatível:

- O `.venv-mini/.koma-install-stamp.json` registra o perfil com que foi
  provisionado. Buildar CUDA sobre um venv de CPU reinstala em vez de reaproveitar.
- O pipeline escreve `mini-backend-profile.json` ao lado do binário congelado e a
  verificação falha se ele não bater com o perfil solicitado.

O `bun run tauri:dev` não é afetado: o desenvolvimento sempre usa o conjunto de
CPU. Para desenvolver contra um venv acelerado, passe o perfil explicitamente:

```bash
bun run mini:install-deps --profile nvidia-cuda
```

## Configuração

Tudo é controlado pelo `.env` (ignorado pelo git). Veja [`.env.example`](./.env.example) para a lista
comentada. Nada é obrigatório para rodar localmente. Destaques:

| Variável | Significado |
| --- | --- |
| `VITE_AUTH_API_URL` | Auth server self-hosted; o app funciona sem ele |
| `VITE_LOCAL_API_URL` | Endereço do mini-backend (padrão `http://localhost:8001`) |
| `KOMA_MODELS_ROOT` | Onde os pesos de IA ficam; vazio = diretório de dados do app |
| `KOMA_EXTERNAL_STORAGE_ROOT` | Raiz externa opcional para dados grandes de projeto |
| `BUG_REPORT_DISCORD_WEBHOOK_URL` | Habilita o formulário opt-in de bug; vazio = desativado |
| `MINI_BACKEND_*_API_KEY` | Suas chaves de provedores de nuvem, usadas direto pelo sidecar |

### Opcional: o auth server

Contas, login e o feed da comunidade são servidos pelo **auth server que vem no `apps/auth-server/`**.
A KŌMA Studio funciona inteiramente em modo local sem ele — você
só precisa dele para recursos autenticados. Ele emite JWTs com audience `"koma-studio-backend"`; veja
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

Logs de erro são gravados **localmente** (winston/`tauri-plugin-log`) e nunca são enviados
automaticamente. As checagens anti-abuso em `interface/security/` e o handshake de registro do
desktop são sinais locais de integridade para instalações self-hosted, não rastreamento de usuário.

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

⚠️ Parte do código adaptador em `packages/mini-backend/models/` deriva desses projetos. Se você redistribuir um
build, revise cada licença. **Componentes GPL-3.0 em particular têm obrigações de copyleft** que uma
distribuição downstream precisa cumprir. Veja
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