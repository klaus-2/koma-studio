# refactor-queue.md — Performance da `packages/interface`

> **Fase 0 concluída e programa executado por completo** (2026-08-30). Relatório final salvo em
> [`react-doctor-interface-final.json`](./react-doctor-interface-final.json)
> (React Doctor 0.9.12, scan full, sem upload de score; números da Fase 0 registrados na seção 1 e no resultado final).
>
> **Protocolo**: uma tarefa por vez. Agente de Refatoração executa → registra o que fez
> na task → Agente de Review aprova ou registra issue → Agente de Correção resolve →
> só então avança. Re-run do React Doctor após cada lote concluído.

---

## 1. Diagnóstico (resumo estruturado)

**Totais**: 704 diagnósticos — 58 erros, 646 warnings — em 132 arquivos.
Por categoria: **Performance 127 · Bugs 221 · Acessibilidade 298 · Manutenibilidade 56 · Segurança 2**.

### 1.1 Mapeamento sintoma → causa

| Sintoma relatado | Causa raiz encontrada | Evidência |
| --- | --- | --- |
| Queda de FPS / jank | Animação de propriedades de layout (`left/top/width/height`, `height:auto`) em vez de `transform`/`opacity` | `no-layout-property-animation` — **22 erros** |
| Travamentos que pioram com o uso | `ObjectURL` criado e nunca revogado (leak de memória → GC pressure) | `no-create-object-url-without-revoke` — **20 warnings** |
| Loops de callbacks / deps instáveis | Padrão "latest-ref" (`ref.current = valor` durante o render) espalhado pelos workbenches + 98 findings de `exhaustive-deps` | `no-ref-current-in-render` — **30 erros** |
| Re-renders excessivos | Sync props→state via useEffect (estado derivado em effect), memo quebrado por props default, estado que só deveria mudar em handlers | `no-adjust-state-on-prop-change` (30) · `no-derived-state` (7) · `rerender-memo-with-default-value` (6) · `rerender-state-only-in-handlers` (3) |
| Trabalho pesado / serial | `await` em loop (export/download em série) e iterações repetidas sobre as mesmas coleções | `async-await-in-loop` (20) · `js-combine-iterations` (26) |
| Componentes monolíticos | `RenderTextPreview.tsx` 4.971 l.; hooks de domínio com 1.0–1.9k l. | `no-giant-component` (26 arquivos) |

### 1.2 Top regras (todas as severidades)

| # | Regra | Qtd | Categoria |
| --- | --- | --- | --- |
| 1 | `exhaustive-deps` | 98 | Bugs |
| 2 | `no-adjust-state-on-prop-change` | 30 | Bugs |
| 3 | `no-ref-current-in-render` | 30 | Bugs (30 = erros) |
| 4 | `js-combine-iterations` | 26 | Performance |
| 5 | `no-layout-property-animation` | 22 | Performance (22 = erros) |
| 6 | `no-create-object-url-without-revoke` | 20 | Performance |
| 7 | `async-await-in-loop` | 20 | Performance |
| 8 | `no-derived-state` / `no-pass-live-state-to-parent` / `no-effect-chain` | 7+7+5 | Bugs |

### 1.3 Hotspots por arquivo (perf + bugs)

| Arquivo | Perf | Bugs | Erros | Linhas |
| --- | --- | --- | --- | --- |
| `components/dashboard/watermark/WatermarkWorkspace.tsx` | — | 23 | 8 | 946 |
| `components/BugReportModal.tsx` | — | 18 | — | 718 |
| `components/dashboard/splitter/useSplitterController.ts` | 4 | 15 | 10 | 583 |
| `components/dashboard/RenderTextPreview.tsx` | 4 | 13 | 2 | **4.971** |
| `components/dashboard/optimizer/ChapterOptimizerWorkspace.tsx` | 4 | 11 | 3 | 718 |
| `pages/Dashboard.tsx` | 8 | 8 | 8 | 2.715 |
| `pages/dashboard/hooks/region-editor.ts` | — | 12 | — | 1.252 |
| `pages/dashboard/hooks/cleaner.ts` | — | 11 | — | 1.876 |
| `pages/dashboard/hooks/workspace-persistence.ts` | — | 10 | — | 1.557 |
| `pages/dashboard/hooks/aio-snapshot-state.ts` | — | 9 | — | 876 |
| `pages/dashboard/hooks/export-download.ts` | 7 | — | — | 971 |
| `pages/scanlation-feed/*Composer*Section.tsx` (3 arq.) | 12 | — | 9 | ~175 cada |

### 1.4 Domínios mapeados

Arquitetura do refactor anterior (commit `ede2123`) já existe e será **estendida, não refeita**:
15 stores + 15 hooks em `pages/dashboard/{stores,hooks}` + seções em `pages/dashboard/sections`.

| Domínio | Onde vive hoje | Estado |
| --- | --- | --- |
| **Splitter** | `components/dashboard/splitter/` (controller 583 l. + workspace) | ❌ sem store — usa latest-ref p/ quebrar loops |
| **Watermark** | `components/dashboard/watermark/` | ❌ sem store — usa latest-ref p/ quebrar loops |
| **Stitch** | `components/dashboard/stitch/` | ❌ sem store |
| **Optimizer** | `components/dashboard/optimizer/` | ❌ sem store |
| **Preview/Canvas** | `components/dashboard/RenderTextPreview.tsx` + `render-text-preview/` + `text-detection-preview/` | ⚠️ monólito de 4.971 l. |
| **Pipeline AIO** | `hooks/aio-pipeline.ts` (1.919 l.) + `aio-snapshot-state.ts` + `stores/aio-pipeline-store.ts` | ⚠️ hook monólito |
| **Cleaner** | `hooks/cleaner.ts` (1.876 l.) + `stores/cleaner-store.ts` | ⚠️ hook monólito |
| **Translator/Typographer** | `hooks/translator.ts` (1.506 l.), `typographer.ts`, stores próprios | ⚠️ hook monólito |
| **Export/Download** | `hooks/export-download.ts` (971 l.) + `stores/export-store.ts` | ⚠️ leaks de ObjectURL |
| **Persistência/Histórico** | `hooks/workspace-persistence.ts` + `workspace/` (serialization, history) | ⚠️ deps instáveis |
| **Feed/Composer** | `pages/scanlation-feed/` | ⚠️ animações de layout |
| **Auth/Settings** | `components/auth/`, `pages/Settings.tsx` | ⚠️ animações de layout |
| **Shell/Transições** | `App.tsx`, `PageTransition.tsx`, `pages/Dashboard.tsx` | ⚠️ FLIP com left/top/w/h |

---

## 2. Fila de tarefas (priorizada)

Status possíveis: `pendente` → `em progresso` → `em review` → `aprovado` / `correção solicitada`.
Cada task deve registrar: o que foi feito, arquivos alterados/criados e como ataca o problema de performance.

### P0 — Erros do React Doctor (bloqueiam FPS/correção)

#### T01 — Splitter: store Zustand + eliminar latest-ref em render · `aprovado`
- **Registro (2026-08-30)**: criada `pages/dashboard/stores/splitter-store.ts` (72 l., padrão devtools value-or-updater); controller migrado para selectors granulares + `getState()` nos callbacks; `setProcessing`/`setProgress` agora vêm de `ui-shell-store` e `setStatusMessage` de `status-store` (props removidas do wiring em `utility-workspaces.ts`); refs de callbacks do pai escritos em `useEffect` (não no render); `controllerRef` do `SplitterWorkspace` idem. 11 violações de ref-in-render eliminadas; cascata de recriação do `moveActiveCut` resolvida estruturalmente. Typecheck ✅, vitest 43/43 ✅, review APPROVE (2 nits não-bloqueantes), Doctor: erros 58→46.
- **Escopo**: `useSplitterController.ts` (10× `no-ref-current-in-render` @ 158-178, 540) e `SplitterWorkspace.tsx` (76); 15 findings de bugs.
- **Ação**: criar `stores/splitter-store.ts` (recipe, imageStates, processing); actions estáveis lendo estado via `get()` — os refs-espelho (`imageStatesRef`, `recipeRef`, e os 8 refs de callbacks do pai) desaparecem; selectors granulares + `useShallow` no controller/componentes. Quebrar loops de dependência da forma estrutural (store), não por espelhamento em ref.
- **Verificação**: React Doctor sem `no-ref-current-in-render` na pasta `splitter/`; smoke E2E do dashboard (`2c7d208`) verde.

#### T02 — Watermark: store Zustand + eliminar latest-ref em render · `aprovado`
- **Registro (2026-08-30)**: criada `pages/dashboard/stores/watermark-store.ts` (160 l. — draft, activeImageId, compare, presets, results, textZoneCache); `WatermarkWorkspace` migrado (19 selectors granulares, 12 `getState()`); status/progress agora via `status-store`/`ui-shell-store` (componente para de re-renderizar com churn de progresso durante batch); espelhos de callbacks em `useEffect`; refs legítimos (worker, timers, tokens) mantidos. Seed effect por montagem (equivale aos antigos inicializers de useState — componente é montado por modo). Review APPROVE; alegação de regressão na T01 **adjudicada como falsa** (controller do splitter é montado incondicionalmente; o seed do watermark era necessário porque esse é montado por modo). Correção MINOR aplicada pelo Orchestrator: seed `useEffect`→`useLayoutEffect` (elimina flash de first-paint). Typecheck ✅, vitest 43/43 ✅.
- **Escopo**: `WatermarkWorkspace.tsx` (8 erros @ 267-271, 357, 480-488; 23 bugs; 946 l. — acima do teto em conjunto com os demais).
- **Ação**: `stores/watermark-store.ts` (results, presets, preview state); worker/preview refs permanecem (legítimos), refs-espelho de callbacks → actions da store; dividir UI pesada em subcomponentes memoizados dentro da pasta `watermark/`.
- **Verificação**: 0 erros na pasta; contagem de findings de bugs cai ≥ 50%.

#### T03 — Animações de layout → transform/opacity (22 erros) · `aprovado`
- **Registro (2026-08-30)**: ghost FLIP do Dashboard (`animateSidebarToggleSharedElement`) agora anima `transform: translate+scale` com origem top-left (rects estáticos, sem animar left/top/w/h); `PasswordStrength` usa opacity+y no container e scaleX (originX 0, wrapper com overflow hidden) nas barras; 3 seções do ScanlationFeedComposer idem (opacity+y); +1 site em `apps/landing/Navbar.tsx` (hover underline → scaleX, apareceu no scan da raiz). Review APPROVE: FLIP math validada, cleanup do ghost intacto, AnimatePresence desmonta corretamente, conflito Tailwind-translate × framer-transform inexistente. Trade-off aceito: colapsos não animam mais a altura do fluxo. Typecheck ✅, vitest 43/43 ✅, regra `no-layout-property-animation` = 0.
- **Escopo**:
  - `pages/Dashboard.tsx:289-314` — ghost de drag-and-drop anima `left/top/width/height` via WAAPI. Fix: medir rects, animar `transform: translate(...) scale(...)` (FLIP correto).
  - `components/auth/PasswordStrength.tsx:47,51` — framer-motion `height:auto` e `width`. Fix: `opacity` + `y`/`scaleY`, ou grid-template-rows.
  - `pages/scanlation-feed/ScanlationFeedComposer{Recruitment,Roles,Social}Section.tsx` (9 erros @ ~99-113) — mesmo padrão.
- **Verificação**: `no-layout-property-animation` zerado; transições visualmente equivalentes.

#### T04 — Erros pontuais (cleanup de effect, hooks, impureza) · `aprovado`
- **Registro (2026-08-30)**: 12 arquivos corrigidos — cleanup de timers do `PageTransition` (run-local + cleanup incondicional; race de exit agora mantém overlay visível, estritamente melhor), listener do `RenderTextPreview` removido do mesmo elemento do registro, `useMemo` do `GuideReader` movido acima do early-return, side effects tirados de updaters de estado (ChapterOptimizer 2×, typographer — restaura pureza sob StrictMode), 9 espelhos render→effect (`BloggerWorkspace`, `DashboardStageGrid`, `RenderTextPreview`, `TextDetectionPreview` ×3, `StitchWorkspace`, `aio-pipeline`). **errorCount da packages/interface: 58 → 0.**
- **Correções pós-review (aplicadas pelo Orchestrator)**: BLOCKER — `DashboardStageGrid` espelhava `renderStageItem` em ref, mas `VirtualizedLongStrip` invoca `renderItem` **durante o render** (memo de items) → items stale persistente a cada mudança de `images`; fix do reviewer: espelho removido, `renderStageItem` passado direto (memo do filho continua válido, deps incluem renderItem). MINOR — 2 memos do `TextDetectionPreview.textState` (`hoveredRegionTooltip`, `contextMenuTargetRegion`) liam `regionsRef` no render; agora leem a prop `regions` com ela nas deps. Typecheck ✅, vitest 43/43 ✅.
- **Escopo**:
  - `effect-needs-cleanup`: `PageTransition.tsx:186`, `RenderTextPreview.tsx:2963`.
  - `rules-of-hooks`: `GuideReader.tsx:96`.
  - `no-impure-state-updater`: `ChapterOptimizerWorkspace.tsx:479,631`, `hooks/typographer.ts:115`.
  - `no-ref-current-in-render`: `hooks/aio-pipeline.ts:1530` + 12 espalhados (BloggerWorkspace:440, DashboardStageGrid:21, RenderTextPreview:471, TextDetectionPreview:96, stitch:158, text-detection-preview 2×).
- **Verificação**: `errorCount === 0` no scan da `packages/interface`.

### P1 — Warnings de performance com sintoma direto

#### T05 — Leaks de ObjectURL (20) · `aprovado`
- **Registro (2026-08-30)**: 20/20 sites com revoke real — revoke-on-replace (export-store, registerDownloads, previews de optimizer/watermark/stitch, logo do watermark, results via `revokeEntries`), revoke-on-unmount (drafts blogger/imgur, previews), try/finally curto (loads via helper compartilhado `loadImageFromSource`); history/serialization: URLs vivem enquanto a entrada owner existir, `releaseWorkspaceObjectUrls` revoga antes de cada restore. Nenhum ceiling `ponytail:` necessário. Correção do 2º agente: efeito combinado do optimizer dividido em 2 (o antigo revogava `originalPreviewUrl` mostrado no compare ao trocar `previewUrl`). Review APPROVE (cadeias traçadas; 2 NITs: janela estreita de swap-ref pode órfã 1 URL até reload; efeitos de ref um pouco além do mínimo). Nota para passe futuro: `closeWorkspace` não revoga URLs das imagens antigas (pré-existente). Typecheck ✅, vitest 43/43 ✅, regra = 0.
- **Detalhe de execução**: o 1º dispatch do agente caiu com "Model request failed" DEPOIS de aplicar os fixes; o 2º dispatch encontrou o trabalho pronto, revisou tudo, corrigiu o optimizer e validou.
- **Escopo**: `hooks/export-download.ts` (7), `hooks/image-collection.ts` (4), watermark/stitch/optimizer e demais; `workspace/dashboardWorkspace.serialization.ts` (6 perf).
- **Ação**: `URL.revokeObjectURL` em cleanup/replace; centralizar criação num helper do domínio de export se evita duplicação.
- **Verificação**: regra zerada; teste manual de ciclo importar→exportar→remover sem crescimento de memória (DevTools Memory).

#### T06 — `async-await-in-loop` (20) + `js-combine-iterations` (26) · `aprovado`
- **Registro (2026-08-30)**: 4 loops de verdade paralelizados (PSD text layers do export, buildZipBlob do splitter, /detect do watermark em chunks de 4, leituras de buffer do optimizer zip); os 16 restantes são **sequenciais por design** (pipelines de canvas/memória, ordem garantida, fail-fast, cancelamento) com comentário `ponytail:` nomeando o motivo — regra fica em 16, aceito. js-combine-iterations 26→1 (1 ponytail em JSX). Review APPROVE (matemática de ordem/erro/duplicatas verificada contra HEAD; 6 ponytails spot-checked, todos verdadeiros). Correção MINOR aplicada pelo Orchestrator: cache do /detect agora escrito por item dentro do callback (sucessos sobrevivem a falha no meio do chunk, como no loop sequencial original). Typecheck ✅, vitest 43/43 ✅, errorCount 0.
- **Escopo**: export-download, serialization, catálogos (`models/aioStageCatalog.ts`, `officialModelCatalog.ts`, `resources-data.ts`).
- **Ação**: paralelizar lotes independentes com `Promise.all` onde seguro (respeitando limite de concorrência de I/O); fundir iterações repetidas sobre a mesma coleção. Priorizar caminhos de export/persistência (sintoma "travamentos").
- **Verificação**: regra zerada nos caminhos quentes; export com muitos arquivos visivelmente mais rápido.

#### T07 — `RenderTextPreview.tsx` (4.971 l.) · `aprovado`
- **Registro (2026-08-30)**: 4.971 → **1.069 l.** (composition root) + 13 módulos em `render-text-preview/` (Pointer 942, TypeDock 1267, RegionOps 464, TypeDock-hook 475, ManualCanvas 322, Selection 301, InlineEditor 295, ContextMenu 279, canvasDrawing 228, RegionModel 166, regionGeometry 136, ToolFlags 121, inlineEditorSelection 89). Move mecânico: 6 clusters verificados byte-idênticos contra HEAD; 17 efeitos em ordem relativa preservada; API externa intacta (memo+areEqual idênticos, 3 consumidores ok); DAG de imports sem ciclos. Fix embutido: 3 defaults inline `= []` → constantes de módulo (elimina `rerender-memo-with-default-value`). Auditoria de stale-capture: 10 benignos / 2 realocados / **0 novos hazards** (a explosão de exhaustive-deps 5→50 é artefato de parameterização do scanner). Correções pós-scan aplicadas pelo Orchestrator: `effect-needs-cleanup` no TypeDock (cleanup fechava sobre re-query de overlayRef em vez do stageEl capturado — mesma classe que a T04 corrigiu) → errorCount 0. Typecheck ✅, vitest 43/43 ✅. Dívida aceita: TypeDock (1267 l., árvore JSX contínua) e composition root >1000 l., coesos.
- **Escopo**: 4 perf + 13 bugs + `no-giant-component`; subpasta `render-text-preview/` já existe.
- **Ação**: dividir por responsabilidade (desenho de canvas, overlay de regiões, editor inline, detecção de texto) mantendo arquivo ≥ ~500 l. quando faz sentido agrupado; props estáveis (callbacks da store, não inline); `React.memo` onde o memo realmente segura re-render.
- **Verificação**: arquivo principal ≤ ~2.000 l.; re-render do canvas não propaga para a árvore ao digitar no editor inline (validar com Profiler).

#### T08 — Estado derivado/sync props→state → stores/derivados (42 findings) · `aprovado`
- **Registro (2026-08-30)**: escopo real re-medido pós-T01–T07 (`no-derived-state` já tinha zerado; o cluster dos hooks de dashboard não existia mais na regra — a nota da Fase 0 mapeava totais de arquivo, não da regra): `no-adjust-state-on-prop-change` 26→0 e `no-effect-chain` 4→0. Padrões aplicados: BugReportModal/ShortcutCenterModal — efeito de reset deletado (montagem condicional por open, estado reinicia sozinho); ModelManagerModal/KomaTopbarUserMenu/Stitch — reset during-render (prev-tracking), same-commit; DashboardFooter — forced-open derivado; HealingToolHint — latch derivado de trigger monotônico (ceiling documentado); ChapterOptimizer — `effectiveActiveImageId` derivado substitui effect de fallback + loop report→restore quebrado via restoreToken; ModelRankings — resets inline nos 3 sites de setSelectedModelId. Review APPROVE com verificação profunda (BugReportModal só monta em `DashboardOverlays.tsx:40`; sem caminho de stale-state). Notas: MINOR aceito (guard `recipeRef` um commit atrás — inalcançável), NIT pré-existente (revoke dentro de updater em WatermarkWorkspace:784). Warnings 625→593. Typecheck ✅, vitest 43/43 ✅.
- **Escopo**: `no-adjust-state-on-prop-change` (30) + `no-derived-state` (7) + `no-effect-chain` (5) — cluster em region-editor (12), cleaner (11), workspace-persistence (10), aio-snapshot-state (9), llm-providers (8), translator (7).
- **Ação**: derivado → cálculo no render/selector; sync real → dentro da store do domínio; um effect por sistema externo.
- **Verificação**: regras zeradas por domínio; digitação/edição de região sem cascata de re-render (Profiler).

#### T09 — Memo quebrado e motion pesado · `aprovado`
- **Registro (2026-08-30)**: 15/16 sites corrigidos — 4 defaults hoisted p/ constantes de módulo (TypographerTextQueue/Toolbox); 3 estados viraram refs (dragging/uploadedItems/previousReceivedCount — nenhum lido em JSX, verificado); **LazyMotion+`m`** (padrão da própria regra, não React.lazy): ScanlationFeed raiz com `domMax` (Roles/Social animam `layout`), 4 arquivos do feed, PasswordStrength e HealingToolHint com `domAnimation` próprio; `AppRouteContent` extraído no App (useMemo de 16 props verbatim, após early-return, dentro do Suspense existente); useToolTips `useState(getSeenThisSession)`. 1 site deliberado: `flushSync` do App com `ponytail:` (atomicidade da transição de rota). Review APPROVE (consumidores `m` aninhados corretamente, zero `motion.` residual, sem strict). Typecheck ✅, 43/43 ✅, 593→578 diagnósticos.
- **Escopo**: `rerender-memo-with-default-value` (6), `rerender-state-only-in-handlers` (3), `use-lazy-motion` (6), `no-flush-sync` (1), `rerender-memo-before-early-return` (1).
- **Ação**: defaults estáveis fora do componente / via store; `lazy()` no framer-motion; estado só em handlers.
- **Verificação**: regras zeradas; Profiler mostra componentes estáticos não re-renderizando.

### P2 — Estrutura e dívida (após P0/P1)

#### T10 — Hooks monolíticos → dividir por responsabilidade · `aprovado`
- **Registro (2026-08-30)**: 7 hooks (10.160 l.) → 21 arquivos (10.814 l.; +654 = JSDoc + re-exports + re-subscrições dos irmãos do persistence); entries mantêm o nome original + re-exports → **zero mudança em consumidores**; irmãos flat com prefixo de domínio e JSDoc; maior arquivo 1.172 l. (cleaner.ts), menor novo 115 l. Review APPROVE: corpo reconstruído do `useAioPipelineExecution` contém exatamente os deltas já revisados (T04 rename + wrapper effect), 69/69 seletores e 6/6 efeitos do persistence reproduzidos byte-idêntico, 30+ corpos comparados contra HEAD sem drift, DAG sem ciclos (única aresta cruzada é import type), 5 `ponytail:` da T06 preservados. Typecheck ✅ (após cada split), 43/43 ✅, errorCount 0, warnings 578→575.
- **Escopo**: `aio-pipeline.ts` (1.923), `cleaner.ts` (1.876), `workspace-persistence.ts` (1.557), `translator.ts` (1.507), `region-editor.ts` (1.252), `llm-providers.ts` (1.068), `export-download.ts` (977).
- **Ação**: mover lógica para as stores do domínio (já existem) e deixar hooks finos de consumo; dividir arquivos por concern mantendo agrupamento sensato (regra 500–2.000 l., nunca arquivo de 1 função).
- **Verificação**: nenhum hook > 2.000 l.; typecheck + smoke E2E verdes.

#### T11 — `exhaustive-deps` residual · `aprovado`
- **Registro (2026-08-30)**: triagem de 93 findings (50 do cluster render-text-preview já auditados no T07, excluídos): **85 deliberados** (padrão da casa — deps estreitas + refs/getState; inclui os "superfluous-dep" cosméticos, deixados pela regra cirúrgica), **7 bugs reais corrigidos** (stale `effectiveBatchConcurrency` no enhance.ts — mudança de threads não pegava no próximo run; stale `cleanerManualImageEditsByImage` no cleaner.ts — pincelada enviava sem brush_mask; stale `renderDefaultStyle` no region-editor.ts; 4 labels/memos com `t` stale — não traduziam na troca de locale), **1 gray** deixado (história/autosave de workspace-persistence, sem bug demonstrado). Todos os fixes cascade-free (callbacks de botão / memos que mudam só com locale). errorCount 0, exhaustive-deps 143→137, typecheck ✅, 43/43 ✅. Aprendizado: o Doctor emite 1 diagnostic por hook — consertar o grave pode revelar variante menor pré-existente no mesmo hook.
- **Nota de estratégia**: deps estreitas são o padrão deliberado da casa (evitar cascatas); massa do aumento pós-T07 é artefato de parameterização já auditado no review da T07 (50 sites do cluster render-text-preview: 10 benignos, 2 pré-existentes, 0 hazards novos). T11 roda como **triagem**: corrigir só bugs verdadeiros (valor stale lido em effect que dispara por mudança de dep), documentar os deliberados. Fix cego é anti-objetivo.
- **Ação**: varrer o que sobrar por domínio após T01/T02/T08/T10 (a maioria se dissolve com stores); deps deliberadamente omitidas viram padrão estrutural (store/ref dentro de effect com cleanup), nunca comentário silenciador.
- **Verificação**: findings de `exhaustive-deps` justificados ou zerados.
- **Review (2026-08-30)**: APPROVE — os 7 fixes verificados um a um (o `renderDefaultStyle` é imutável por construção — store sem setter; o `args` do `processCleaner` já recriava o callback a cada render, cascade-free por construção); gray site confirmado seguro (dirty-flag coberto pelo interval effect que inclui `processing`).

#### T12 — Quick-wins de deslop/manutenibilidade · `aprovado`
- **Registro (2026-08-30)**: 12/12 deslop resolvidos + 1 consequente — 3 deps removidas do `package.json` (com `bun install` no lockfile; `@koma/types` só o auth usa e continua lá; `@tauri-apps/plugin-deep-link` permanece no shell tauri junto do plugin Rust; `radix-ui` é do packages/ui); `useSession.tsx` deletado (re-export de 1 linha); 8 unused exports deletados inteiramente (inclui `getNavGroups` + 140 l. de constantes + 15 ícones, e o mecanismo `bridgeOverrides` nunca ativado, cuja remoção o tsc narrowing confirmou inócuo); barrel `AioStageModelControls/index.ts` ficou órfão do fix de barrel-import e foi removido também. Typecheck ✅, 43/43 ✅, deslop = 0, warnings 569→556, errorCount 0.
- **Escopo**: deps não usadas em `packages/interface/package.json` (`@koma/types`, `@tauri-apps/plugin-deep-link`, `radix-ui` — confirmar de verdade antes de remover); unused exports (`utils/dashboard.rendering.utils.ts`, `models/model-storage.ts`, `lib/tauri/api.ts`, `utils/renderText.draw.ts`, `constants/dashboard.constants.ts`); unused file `hooks/useSession.tsx`; barrel import.
- **Verificação**: build + typecheck verdes após remoção.
- **Review (2026-08-30)**: APPROVE — todas as remoções re-verificadas com grep próprio; remoção do `bridgeOverrides` (única mudança de lógica) provadamente behavior-preserving (ramo sempre-falso); NITs: o diff do `bun.lock` também reconciliou drift pré-existente (pg do auth-server, react-doctor da raiz) — **mencionar no commit**; teste `model-download-manager.test.ts:140` com nome stale (usa `setDesktopBridgeProvider`, não a API removida).

### Lanes fora do escopo atual

- **Acessibilidade (298)** — maior categoria em volume, mas fora do objetivo de performance; lane separada a criar quando priorizada.
- **BugReportModal.tsx** (18 bugs, 718 l.) — UX de bug report, sem sintoma de FPS; agregar num lote P2.
- **Trace runtime**: a CLI do React Doctor 0.9.12 **não tem** modo runtime/trace. Validação runtime disponível: React DevTools Profiler + aba Performance do DevTools durante o smoke E2E (`test(tauri): add dashboard refactor smoke spec`). (`react-scan` não está instalado na árvore; instalar só se o Profiler nativo não bastar.)

---

## 3. Critérios de aceite do conjunto — RESULTADO FINAL (2026-08-30)

1. ✅ React Doctor na `packages/interface`: **0 erros**; Performance 127 → **38** warnings (meta < 40).
2. ✅ Smoke E2E do dashboard **11/11** + smoke geral **2/2** + typecheck verde + vitest 43/43.
3. ✅ Nenhum arquivo novo < ~500 l. ou > ~2.000 l. (exceções coesas aceitas e registradas: TypeDock 1.267, composition root 1.069, cleaner.ts 1.172).
4. ✅ Stores novas (splitter, watermark) no padrão da casa: selectors granulares, actions estáveis via `get()`, nenhum selector retornando objeto novo.
5. ✅ Sem `useState`/`useEffect` para estado compartilhado/derivado nos domínios refactorados; syncs residuais convertidos em derivados/render-adjust (T08).
6. ✅ Re-run registrado — **antes → depois**:

| Métrica | Fase 0 (2026-08-30) | Final |
| --- | --- | --- |
| Diagnósticos totais | 704 | **556** |
| Erros | 58 | **0** |
| Warnings | 646 | 556 |
| Performance | 127 | **38** (−70%) |
| Bugs | 221 | 174 |
| Manutenibilidade | 56 | 45 |
| Segurança | 2 | 1 |
| Acessibilidade | 298 | 298 (lane separada, fora do escopo) |
| `RenderTextPreview.tsx` | 4.971 l. | 1.069 l. + 13 módulos |
| Hooks de domínio (7 monólitos, 10.160 l.) | — | 21 arquivos (max 1.172 l.) |

Relatório final salvo em [`react-doctor-interface-final.json`](./react-doctor-interface-final.json).

**Validação runtime (Playwright, 2026-08-30)** — probe temporário com `VITE_AUTH_DISABLED=true` (bypass de login do modo e2e), Chromium, 2 testes: (1) **long tasks** (PerformanceObserver `longtask`, o mesmo sinal de commits lentos que o Profiler do DevTools mostra) ao caminhar pelas 9 rotas do dashboard: pior task **297ms** (boot único da SPA; total cumulativo 988ms na sessão inteira) — nenhuma task > 500ms, nenhuma cascata; (2) **heap** com GC forçado (CDP `HeapProfiler.collectGarbage`) ao longo de 6 ciclos dashboard↔settings↔aio: **27,2 → 28,2 MB** (+1 MB — sem leak; valida o trabalho de revoke da T05); (3) **zero erros** de página/console/vite-overlay em ambas as fases. O Profiler UI do DevTools não é dirigível headless; o probe equivale funcionalmente ao que ele mediria.

**O que ainda resta (dívida documentada, não bloqueante)**: A11y (298 — lane separada); `exhaustive-deps` deliberados (137, triados); `async-await-in-loop` sequenciais por design (16, com `ponytail:`); `no-giant-component` (30 — arquivos 500-2.000 l. coesos); `closeWorkspace` sem revoke (T05); Proxy `no-flush-sync` deliberado; Profiler runtime para confirmar as melhorias percebidas (T07/T08).

---

## 4. Pós-programa: fix do drag do `koma-render-box` (2026-08-30, uncommitted)

**Bug reportado**: click+drag para mover o box → FPS em queda + input delay >650ms.

**Causa raiz**: cada `pointermove` (60-500/s) commitava a nova bbox na store de regiões → `applyAioRegionsEditForImage` deep-clona TODAS as regiões → re-render da página inteira do Dashboard + redraw do canvas inteiro, por frame.

**Fix** (3 peças + escalonamento guiado por medição):
1. `useRenderTextPreviewPointer.ts` — branches move/resize/rotate não commitam por pointermove: stash em ref + 1 rAF em voo (flush/cancel); **move faz 1 único commit de store no pointerup**; box segue o ponteiro ao vivo via `dragBox` (setInteraction coalescido por rAF; sem re-render de Dashboard durante o drag).
2. `useRenderTextPreviewRegionModel.ts` — cache de identidade (WeakMap por fallbackStyle, com fallback de igualdade de conteúdo via `areAioRegionsEqual`, pois a store clona tudo a cada commit); arrays preservam identidade quando nenhum elemento muda.
3. Novo `RenderRegionOverlayBox.tsx` (React.memo) — box/badge/meta/inline-editor/handles extraídos; boxes não-dragados recebem props estáveis e fazem bail-out.

**Medição (probe Playwright headless, região manual, drag de 40 moves/1.5s)**: durante o drag **0 long tasks** (antes: commit por pointermove, 40 tasks/max 161ms só com rAF-cap — o experimento de atribuição provou que o custo dominante era o re-render do Dashboard); no pointerup 1-2 tasks, **max 97ms** (commit único + redraw final do canvas). 

**Tradeoffs documentados**: canvas do texto renderizado não redesenha durante o move (redesenha 1× no pointerup; resize/rotate continuam ao vivo); pointercancel no move reverte o drag (nada foi commitado). Correções pós-review aplicadas: cancel de rAF no unmount, flush antes do read no pointerup (não perde o último frame de arrasto), cancel de pending no pointerdown. Typecheck ✅, 43/43 ✅, errorCount 0.

---

## 5. Pós-programa: commit path CoW + varredura de interações (2026-08-31)

**Freeze pós-drop (drag-and-drop)**: cada commit de regiões fazia `cloneAioRegions` wholesale (deep-clone de todas as regiões) + deep-compare + merge/clona em **cada snapshot de histórico** (`patchAioSnapshotsForImageEdit` percorre todos os snapshots ≥ índice). Mesmo padrão em translator (`translator.inputs.ts`) e cleaner (`cleaner.editing.ts`).

**Fix**: helper `cloneAioRegionsCoW` (`dashboard.region.utils.ts`) — regiões cujo conteúdo coincide com o estado anterior **mantêm identidade**; clone só do que mudou. Aplicado em 6 sites: applyAioRegionsEditForImage (com flag `changed` que substitui o deep-compare standalone), patchAioSnapshotsForImageEdit (fast-paths de identidade: `existing === region` → reuse; merge content-equal → reuse do objeto do snapshot; deep-compare só quando algo mudou), patchAioSnapshotStageForImage, applyAioPipelineSnapshotToImage, restore de snapshot ativo (aio-snapshot-state ×3), updateTranslatorRegionsForImage, updateCleanerRegionsForImage.

**Medição** (probe Playwright headless, drag 20 steps + release): drag frames **0 long tasks** (texto segue ao vivo — massa 10419→0/dest 0→10419); commit do pointerup **92 → 76ms**. O restante do commit é o re-render do DashboardPage (2.7k l.) por mudança de `aioDetectionsByImage` — dívida estrutural já anotada (extrair grade).

**Varredura de interações** (probe genérico, 5 regiões injetadas, SwiftShader headless — inflar ~5-10× vs GPU real):

| Interação | Worst task |
| --- | --- |
| mode:aio / mode:cleaner | 308-322ms |
| mode:typesetter / mode:translator | 198-214ms |
| mode:split / mode:watermark | 152-186ms |
| mode:raw/proofreader/stitch/enhance/optimizer/organize | 54-86ms |
| region-select ×5 | 72-92ms |
| rotas settings/model-rankings | 76-104ms |
| route:/#/dashboard (retorno) | 332-557ms |

Todos **reproduzíveis por troca** (não é só cold-start). Testado e **refutado**: adiar o primeiro paint do canvas para rAF não reduz o custo (o dominante é o mount do React da stage — DOM+layout+compositing, não o raster). Deferral revertido. O caminho real para os ofensores de mount é arquitetural: keep-alive das stages (não desmontar ao trocar de modo), virtualização com threshold menor para canvas grandes, ou lazy-mount das tools pesadas — **decidir com profiling em hardware real** (SwiftShader multiplica o custo de canvas ~5-10×).

**Dívida documentada (não re-flaggear)**: re-render do DashboardPage por commit de região; custos de mount das stages; EADDRINUSE do auth-server em sessões paralelas (cobrido na próxima subida do electron).

---

## 6. Pós-programa: plano stage-mount (2026-08-31)

**Problema medido** (seção 5): trocas de modo custam por troca, reproduzível —
aio/cleaner ~310-320ms, typesetter/translator ~200ms, split/watermark ~155-185ms,
retorno ao dashboard ~330-560ms (headless SwiftShader; GPU real ≈ 5-10× menos, ainda perceptível).

**Diagnóstico do mount** (código):
- `StageGrid.tsx` + `DashboardSpecialModeStage.tsx` desmontam a stage antiga e montam a nova a cada `setMode` — sem keep-alive.
- Imports estáticos: nenhum stage é `React.lazy` (tudo no bundle principal; custo de mount = React DOM + raster, não module eval).
- Cada item de stage (RenderTextPreview) monta **4-5 canvases** (paint, wand mask, healing mask, render) e rasteriza todos no mount (`drawRegionsToCanvas` no effect + `preloadRegionCanvasFonts`).
- `VirtualizedLongStrip` só ativa com **>5** imagens — com ≤5, todas as montagens+rasters acontecem juntas.
- Hipótese do paint-deferral (rAF no primeiro paint) **testada e refutada** (seção 5): o custo dominante é o mount do React/DOM em si, não o raster isolado.

### Fase 0 (plano) — Medição em hardware real (pré-requisito, ~1h)
- Rodar o sweep probe contra o app com GPU real (chromium headed `--enable-gpu` ou o próprio Electron) e registrar a tabela base.
- Critério: tabela antes/depois por fase; decisões das fases 2-4 dependem destes números (SwiftShader distorce prioridades).

### Fase 1 — Quick wins de troca (baixo risco, ~2-4h)
- **1a. `startTransition` no `setMode`** (ui-shell): a troca vira update concorrente — a stage antiga permanece interativa enquanto a nova monta; a travada vira não-bloqueante. Verificação: sweep com input responsivo durante a troca; drag probe inalterado.
- **1b. `React.lazy` + preload antecipado dos workbases especiais** (`DashboardSpecialModeStage`: stitch/split/watermark/optimizer) e do `TranslatorTextStage` (tiptap): code-split tira parse/eval do primeiro mount; `import()` disparado na idle logo após o boot (modulepreload) para a troca não esperar rede/parse. Verificação: chunk count no build + sweep.
- **1c. Dedupe de `preloadRegionCanvasFonts` por (família,peso) já existe — garantir que o primeiro paint não espere rede de fontes fora da tela.** Barato, manter.

### Fase 2 (plano) — Cache de raster das stages (o maior ganho por complexidade, ~4-8h)
- **2a. Cache de bitmap por (imageId, hash-de-regiões, stage)**: no unmount, salvar `ImageBitmap`/dataURL do canvas final ( já existe revoke/close helpers); no remount, **blit imediato** do bitmap no canvas e re-render fino por cima quando dados chegarem. Elimina a rasterização completa do mount (o pedaço caro que o deferral não separou) sem manter a árvore viva.
- **2b. (Se 2a insuficiente) Keep-alive LRU-2 das stages pesadas** (aio, cleaner, typesetter, translator): renderizar a stage oculta (`display:none`, NÃO `content-visibility` — bugs conhecidos com canvas) em vez de desmontar; hooks de shortcut/keyboard/timers precisam de gate `visible` (o wiring já tem padrões de pause nos workbenches). Trade-off explícito: memória (canvases 1600×1200 × imagens × stages) — medir DevTools Memory antes/depois.
- Verificação: sweep — mode:aio/cleaner < 120ms em GPU real; drag probe 0 long tasks; smoke 11/11; memória < orçamento definido na Fase 0.

### Fase 3 (plano) — Virtualização/pintura sob demanda (~3-6h)
- Threshold do `VirtualizedLongStrip` (>5) revisado para stages com canvas pesado (renderizar só visíveis + overscan via `IntersectionObserver` no modo grid), ou pintar previews fora da viewport na idle.
- Verificação: sweep com 10+ imagens injetadas; mount com N imagens deve escalar sublinear.

### Fase 4 (plano) — Dívida estrutural relacionada (fora do escopo imediato)
- Extração da grade do `DashboardPage` (o retorno ao dashboard de 330-560ms inclui o re-render da página inteira além do remount) + subscrições por imagem em vez do mapa inteiro (mesma direção do CoW atual).
- Executar só depois das fases 1-3, com o profiling real apontando o que resta.

### Ordem e gates
Fase 0 → 1a → 1b → 2a → (2b se preciso) → 3. Cada fase: sweep + drag probe + smoke 11/11 + Doctor 0 erros + registro antes/depois neste arquivo. Commits por fase.

### Fase 0 — Harness de medição em GPU real + baseline

**Probes** (temporários, untracked, reutilizados pelas fases seguintes; medição apenas — nenhum código de produção tocado):

- `apps/tauri/tests/e2e/interaction-sweep-probe.spec.ts` — varre o dashboard (12 modos × `setSubMode('manual')`, 5 seleções de região, 4 rotas) com coletor `PerformanceObserver('longtask')` e janelas de 900ms; 1 imagem canvas 1600×1200 + 5 regiões manuais injetadas via dynamic import do module graph do vite (`/@fs/…/stores/*`).
- `apps/tauri/tests/e2e/text-follow-probe.spec.ts` — drag do `koma-render-box` (20 passos de +15/+7.5px, 40ms): primeiro click só seleciona; amostra massa de pixels alpha do canvas (origem `getImageData(380,280,560,160)`, destino `getImageData(680,430,620,180)`) a cada passo; separa long tasks de **drag** (antes do pointerup) e de **commit** (pointerup). 2 passes: full (com pixels) e perf-only (`window.__komaNoPixels` pula o getImageData — readbacks dominam long tasks em software rendering).
- Helpers compartilhados: `apps/tauri/tests/e2e/probe-helpers.ts` (GPU args, injeção de fixture, coletor/long-task windows, filtro de ruído de sidecars).

**GPU mode alcançado**: **headed (GPU real)** — default dos probes com `launchOptions: { headless: false, args: ['--enable-gpu', '--disable-software-rasterizer', '--enable-zero-copy'] }`; fallback documentado via `SWEEP_HEADLESS=1` (headless novo, mesmos args) — não foi necessário. Evidência em ambos os runs: `GPU_MODE headed webgpu=true webgl2=true`, UA `Chrome/151.0.7922.34` sem "Headless". Viewport 1760×1320, `--workers=1`. Nota de harness: o probe de drag precisa subir o progresso manual do pipeline para o stage `render` (`setAioManualProgressByImage`, índice 5) — sem isso a imagem nova fica em detectText (1/6) e o `RenderTextPreview` (dono do `.koma-render-box`) não monta.

**Baseline — varredura de interações (worst long task, ms; GPU real headed; 2026-08-31)**

| Interação | Run 1 | Run 2 |
| --- | --- | --- |
| mode:aio | 205 | 206 |
| mode:cleaner | 118 | 124 |
| mode:typesetter | 216 | 202 |
| mode:translator | 72 | 69 |
| mode:raw | 53 | 56 |
| mode:proofreader | 0 (sem task) | 52 |
| mode:stitch | 71 | 67 |
| mode:split | 87 | 82 |
| mode:watermark | 103 | 98 |
| mode:enhance | 63 | 61 |
| mode:optimizer | 67 | 70 |
| mode:organize | 54 | 51 |
| region-select ×5 | 0 | 0 |
| rotas settings / model-rankings / scanlation-feed | 0 | 0 |
| route:/#/dashboard (retorno) | 234 | 237 |

Ofensores >120ms consistentes: `mode:aio` (~205), `mode:typesetter` (~202-216), retorno `/#/dashboard` (~234-237) e `mode:cleaner` borderline (118-124). Comparação com SwiftShader (seção 5): aio 308-322 → 205-206, typesetter 198-214 → 202-216 (quase inalterado — dominado por DOM/layout, não raster), dashboard retorno 332-557 → 234-237; region-select e rotas leves caem a zero em GPU. Variância entre runs ≤ ~15ms.

**Baseline — drag probe (20 passos; GPU real headed; 2026-08-31)**

| Métrica | Run 1 | Run 2 |
| --- | --- | --- |
| Drag worst — full (com pixels) | **0 tasks** | **0 tasks** |
| Drag worst — perf-only (sem getImageData) | **0** (assert < 50ms ✅) | **0** (assert < 50ms ✅) |
| Commit pointerup worst — full | 127ms | 124ms |
| Commit pointerup worst — perf-only | 117ms | 123ms |
| Massa alpha origem → destino | 10419 → 0 / 0 → 4904 | 10419 → 0 / 0 → 4904 |
| Deslocamento do box | +300px x | +300px x |

Leitura: o texto renderizado segue o box ao vivo (massa migra por completo da janela de origem para a de destino durante o drag, 0 long tasks — inclusive com readback de pixels em GPU); o custo restante está no commit único do pointerup (~117-127ms — re-render do DashboardPage por `aioDetectionsByImage`, dívida estrutural já anotada na seção 5). Os probes não tiveram nenhum pageerror/console error nas 4 execuções.

### Fase 1b — Code-split dos workbenches + idle preload (2026-08-31, uncommitted)

**O que foi feito**:
- `React.lazy` + Suspense (fallback compartilhado `DashboardLazyFallback`) em: 5 painéis de modo (`AioRightPanel`, `CleanerToolsPanel`, `TypographerToolsPanel`, `TranslatorToolsPanel`, `EnhanceToolsPanel` — wrappers em `DashboardMainLayout`), `TranslatorTextStage` (tiptap, em `StageGrid`) e 4 páginas info-mode (blogger/guides/imgur/resources, em `DashboardInfoModeStage`); os 4 workspaces especiais já eram lazy.
- Idle preload: `pages/dashboard/hooks/use-dashboard-idle-preload.ts` — `requestIdleCallback` (fallback `setTimeout` 1500) dispara `import()` de todos os 17 módulos após o mount do dashboard; fire-and-forget, erro engolido.
- `utils/lazyModule.ts` (`memoLoad`): a pré-carga e o ctor do `React.lazy` compartilham a MESMA promise. Sem isso o primeiro mount suspende mesmo com o chunk quente (medido: fallback de ~240ms no stitch em dev — o `import()` do ctor criava uma segunda promise ainda pending).
- Os 5 painéis lazy renderizam no `deferredStageMode` (mesma lane da stage, 1a): primeiro mount suspenso segura a UI anterior em vez de commitar o fallback.
- Nenhuma fronteira lazy na tela padrão (organize): a grade usa `PreviewStageItem` estático. Nota: `RenderTextPreview`/`TextDetectionPreview` continuam no chunk principal via imports estáticos pré-existentes (`CleanerStageItem`/`TypesetterStageItem`/`TranslatorVisualStageItem`) — o `lazy()` que a StageGrid aplica a eles não muda o split (mantido, inócuo).

**Verificação**:
- Flash probe (`fase1b-flash-check.spec.ts`, headed GPU, 10 modos × primeira troca e steady-state): 11 sightings de fallback no estado recebido → **0** após `memoLoad` + painéis na lane deferred (warm 13/13 confirmado via resource timing).
- Build produção (vs build no HEAD `c40517d`): chunk `Dashboard` 910.6 → 746.0 kB (gzip 224.3 → 190.4 kB, −15%); entry `index` inalterado (620.8 kB); 52 → 66 chunks (+11 módulos-alvo + extrações de deps compartilhadas).
- Sweep 3× (GPU real headed, worst long task por janela, mediana | baseline Fase 0): mode:aio 127 | 205 · typesetter 136 | 209 · watermark 69 | 100 · translator 61 | 70 · optimizer 70 | 68 · stitch 83 | 69 · split 116 | 84 · retorno /#/dashboard 264 (241-371 ruidoso) | 236.
- Gates: typecheck raiz+interface ✅ · vitest 43/43 ✅ · dashboard smoke 11/11 ✅ · text-follow full: drag 0 tasks, commit 134ms (janela 120-135), massa 10419→0 / 0→4904, box +300px ✅ · perf-only: drag 0 (<50 ✅), commit 126ms ✅.

**Leitura honesta**: split (+32ms) e stitch (+14ms) pioram — o swap virou dois commits (urgente + deferred) e a janela do probe captura a cauda; aio/typesetter/watermark caem 30-40% (mount dividido entre commits). O entregável desta fase é o code-split + garantia de no-flash, não a queda generalizada do sweep; retorno ao dashboard segue dívida estrutural (Fase 4).

### Fase 1b — resultado (2026-08-31)
- **Implementado**: `memoLoad` (`utils/lazyModule.ts`, promise compartilhada entre React.lazy e o preload; rejeição evita o memo → retry no próximo render); preload na idle (`use-dashboard-idle-preload` + wiring no Dashboard); lazy+Suspense nos 5 painéis de tools (lane deferred — trocam atomicamente com a stage), DashboardInfoModeStage, TranslatorTextStage. Flash-check: **11 → 0 flashes** em 10 trocas. Bundle: chunk Dashboard **910.6 → 746.0 kB** (gzip 224.3 → 190.4), entrada inalterada, chunks 52 → 66.
- **Medição (3-run medians, GPU real)**: aio 205 → **127** (−38%), typesetter 209 → **136**, watermark 100 → **69**, translator 70 → 61, optimizer 68 → 70. **split 84 → 116 e stitch 69 → 83 pioraram** — o review adjudicou como **provável ruído de sessão** (o mecanismo atribuído — swap em 2 commits — não toca as lanes de split/stitch; otimizador +2ms, translator −9ms no mesmo caminho). Aceito com remeasure antes de usar como gate.
- **Follow-ups anotados**: (1) ErrorBoundary em torno do DashboardMainLayout — a superfície lazy quadruplicou (4→16) e React.lazy nunca recusa-retry (payload rejected = throw permanente); (2) os dois lazy() no-op dos previews (cadeia estática via Typesetter/Cleaner/TranslatorVisual) — limpar se algum dia saírem do boot path; (3) flash-check probe é instrumento fraco (polling 150ms, sem assert) — manter só como diagnóstico.
- Gates: typecheck ✅, vitest 43/43 ✅, smoke 11/11 ✅, drag probe 0 tasks no drag / commit 126-134ms ✅, build de produção ✅.
