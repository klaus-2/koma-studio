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
