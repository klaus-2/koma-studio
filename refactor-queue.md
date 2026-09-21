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

### Fase 2a — resultado (2026-08-31): resultado negativo honesto, REVERTIDA
- **Implementado e verificado**: cache de bitmap LRU-8 (createImageBitmap, evict com close()), fingerprint estável (imageId+dims+stage+font+per-region bbox/text-length/identity-hint), blit síncrono no hit, drag-safe (save skip durante move; fingerprint muda por frame), blank-canvas nunca cacheado. 11 blits/2 saves por sessão, pixel-exatos, invalidação correta via drag real. Vitest chegou a 51/51 com 8 testes novos de fingerprint.
- **Medição**: medians de switch **indistinguiveis** com/s sem cache (aio remount 174-260 vs 176-262; typesetter hit 154-235 vs 165-239) — o raster custa **2-15ms** (abaixo do threshold de long task); o switch de 127-230ms é o **mount React/DOM** em si. Consistente com a refutação do deferral (Fase 0/5) e com o ganho por lanes (Fase 1a). **Revertida** → árvore idêntica a 27385bb; probe A/B de remontagem mantido (`fase2a-bitmap-cache-check.spec.ts`, untracked) como instrumento pronto para avaliar 2b.
- **Descoberta de instrumentação**: writes crus de `setAioDetectionsByImage` no modo aio+manual são revertidos em ~100ms por `syncActiveManualStageSnapshot` — só edições via `onRegionsChange` persistem. Probes de invalidação precisam de drag real.

### DECISÃO DE ENCERRAMENTO do plano de mounts (2026-08-31, revisada pelo Review Agent)
O gate "mode:aio/cleaner < 120ms" foi calibrado para o modelo mental de custo dominado por raster — **refutado pela Fase 2a**. O gap restante (aio 127 vs 120; cleaner já passa em ~101-107) está dentro da variância de sessão documentada (±15ms). **Fase 2b (keep-alive) rejeitada**: 4-8h de mudança de alto risco (gates de timer/shortcut em 4 stages + custo de memória de bitmaps) para um custo que a Fase 1a já tornou não-bloqueante e que está bem abaixo do sintoma original (205-320ms). **Fase 3 inaplicável** ao workload medido (≤5 imagens; virtualização só ativa >5). Programa encerrado com sucesso nas Fases 0, 1a, 1b; se o jank de switch voltar a ser reportado, reabrir pela **Fase 4** (retorno ao dashboard ~236-264ms e commit do pointerup ~126-134ms são os maiores custos restantes, ambos estruturais) — a Fase 2b só se os switches voltarem a incomodar, e o probe A/B está pronto.

---

## 7. Fase 4 — REABERTURA (2026-09-01): dívida estrutural + exploração interativa completa

Objetivo declarado do usuário: interface estável — zero re-renders *desnecessários* (medidos por razão de fan-out no react-scan), zero jank acima dos thresholds conhecidos, sem deixar nada para depois. Instrumento: probe react-scan-audit + buffer `window.__komaReactScan` + long tasks. Disciplina inalterada: MEDIR → causa raiz → menor fix arquitetural suficiente → medir → review. Commits por tarefa após review.

### Baseline na reabertura (HEAD c312877, headed GPU real)
- Global (1 sessão de auditoria): DashboardPage 45r/~305ms; KomaTopbar 50r/~222ms; Tooltip-família ~2500r (pós-fix de memo: 76-285r por janela, antes 116-522).
- Long tasks (histórico do programa, a reconfirmar no T4.1): retorno ao dashboard ~236-264ms (bloqueante, sem lane); commit do pointerup ~126-134ms; drag 0 tasks.
- Janela route:dashboard (última auditoria): AioRightPanel 7r/203ms, DashboardFooter 7r/85ms, DashboardPage 7r/71ms.
- Gatilho conhecido: seleção/edição de região re-renderiza a página inteira (subscrições largas do DashboardPage) — causa raiz documentada tanto do retorno caro quanto do commit do pointerup.

### Tarefas (uma por vez; agente de execução → agente de review → próxima)
- **T4.1 — Exploração interativa + census** (somente medição): dirigir o Dashboard como usuário real com react-scan espelhando renders — todos os 12 modos, sub-modos, dock completo (sliders, cores, wand), sidebar esquerda/direita, footer, topbar (menus, downloads, PSD), zoom/rotate, adicionar/remover imagem, editor inline de região (duplo clique + digitação), páginas info, settings/rankings/feed, shortcuts, empty stage, tour. Census P0/P1/P2 com evidência (razão de render, long task, tempo). Inclui reconfirmar o baseline de long tasks em mediana de 3 runs. → **resultado abaixo (2026-09-01)**.
- **T4.2 — DashboardPage: subscrições por imagem + extração da grade** (a dívida central): a página não pode re-renderizar em seleção/edição/commit de região; cada card/grade assina seu próprio slice. Targets: retorno ao dashboard ≤ ~180ms (mediana 3), DashboardPage 0-1 render por region-select, commit pointerup ≤ ~100ms. Gates: typecheck, vitest 43/43, smoke 11/11, sweep sem regressão de long task, drag probe green.
- **T4.3 — AioRightPanel/sections**: narrowing dos drivers que sobreviverem ao T4.2 (target: ≤2 renders no retorno, custo ≤ ~60ms).
- **T4.4 — Hotspots residuais do census T4.1**: um agente por item, na ordem de custo medido; honestidade clause (revertir se mediana não melhorar).
- **Fecho**: React Doctor (0 erros mantido), todos os probes green, relatório consolidado com before/after.

### T4.1 — census (2026-09-01)

**Execução**: baseline re-confirmado (audit ×3, sweep ×3, text-follow ×1) + probe novo
`apps/tauri/tests/e2e/react-scan-census.spec.ts` (untracked) — 75 janelas cobrindo os 12 modos,
sub-modos (aio/typesetter), dock completo (config, slider, 7 tools, seg brush/eraser no stage
segmentText e no cleaner), editor inline (duplo clique + digitação + Escape + delete), zoom,
rotate ×2, view-mode, threads (enable/input/disable), sidebars, menus (download/PSD, user,
shortcuts), 2ª imagem (add/switch/remove), 4 info-modes, digitação no translator text stage,
4 rotas + retorno, empty stage, e drawer mobile (viewport 390px em runtime). Artefatos:
`.artifacts/react-scan-census.json` + `react-scan-census-mobile.json` (cópias em
`tests/e2e/probe-out/`). Probe 2/2 green, zero pageerrors/console errors.

**Aviso de instrumento**: o react-scan dev-instrument (HEAD c312877) está sempre ativo no dev
server e NÃO estava nos baselines da Fase 0/1b — todo render empurra um evento num array JS, e o
custo é proporcional ao fan-out (o commit de região re-renderiza ~48 tooltips). Os números
absolutos abaixo estão inflados vs o histórico; comparações relativas dentro do T4.x são válidas
(instrumento constante). Recalibrar gates com A/B (react-scan on/off) no T4.2 se necessário.

#### Baseline de long tasks — mediana de 3 runs (headed GPU, worst task por janela, ms)

| Janela | Run 1 | Run 2 | Run 3 | **Mediana** | Histórico (pré-react-scan) |
| --- | --- | --- | --- | --- | --- |
| mode:aio | 383 | 367 | 216 | **367** | 205-206 / 127 (Fase 1b) |
| mode:cleaner | 250 | 229 | 159 | **229** | 118-124 / ~101-107 |
| mode:typesetter | 249 | 252 | 240 | **249** | 202-216 / 136 |
| mode:translator | 140 | 141 | 110 | **140** | 69-72 / 61 |
| mode:raw | 133 | 197 | 118 | **133** | 53-56 |
| mode:proofreader | 97 | 93 | 69 | **93** | 0-52 |
| mode:stitch | 146 | 144 | 136 | **144** | 67-71 / 83 |
| mode:split | 140 | 157 | 134 | **140** | 82-87 / 116 |
| mode:watermark | 167 | 123 | 127 | **127** | 98-103 / 69 |
| mode:enhance | 264 | 243 | 273 | **264** | 61-63 |
| mode:optimizer | 147 | 149 | 122 | **147** | 67-70 |
| mode:organize | 169 | 111 | 119 | **119** | 51-54 |
| region-select ×5 (worst) | 83-133 | 75-130 | 61-76 | **~76-130** | 0 |
| route:/#/model-rankings | 141 | 77 | 77 | **77** | 76-104 |
| route:/#/dashboard (retorno) | 615 | 558 | 433 | **558** | 234-237 / 236-264 |
| drag (text-follow, 20 passos) | — | — | — | **0 tasks** (2 passes) | 0 |
| commit pointerup (text-follow) | — | — | — | **183 / 198ms** (full/perf-only) | 117-127 / 126-134 |

Leitura honesta: a direção dos números é consistente com o histórico (aio/typesetter/retorno
dominam; drag segue live com 0 tasks; commit ~130-200), mas tudo piorou em absoluto — atribuição
principal: instrumento react-scan agora ativo (custo proporcional ao fan-out) + variância de
sessão. **O retorno ao dashboard segue o maior custo do app (433-615ms) e é o gate central do T4.2.**

#### Baseline de renders — audit ×3, medianas das janelas-chave (react-scan)

| Janela | Componentes (mediana) |
| --- | --- |
| boot | DashboardPage 6r/~107ms · KomaTopbar2 6r/~52ms · Tooltip 204r · DashboardLeftSidebar 6r |
| fixture (5 regiões + render stage) | DashboardPage 10r/~64ms · Tooltip 404r · RenderTextPreview 5r |
| drag (20 passos) | RenderTextPreview 29r/~94ms · RenderRegionOverlayBox 27r/~19ms · DashboardPage 2r/~17ms |
| region-select:1 | AioRightPanel 2r/~27ms · DashboardPage 2r/~24ms · Tooltip 76r |
| region-select:5 | 1r em todo o chrome (seleção já ativa) |
| route:dashboard (retorno) | AioRightPanel 8r/~89ms · DashboardPage 8r/~53ms · KomaTopbar2 8r/~45ms · Tooltip 321r |

#### Census — agregado de sessão (75 janelas, react-scan)

Top por COUNT de render: Tooltip/TooltipTrigger 6.683r cada · TooltipProvider 4.869r ·
Popper/PopperProvider/PopperAnchor/Primitive.*/TooltipPortal ×5-8 famílias 3.375r cada ·
TooltipContent 3.308r · ChevronDown 1.606r · **ModelManagerModal 1.176r (62 janelas — 6 modais
sempre montados com `open={false}`)** · AioSection 736r · KomaNavGroupDropdown 516r.

Top por TEMPO de render: **AioRightPanel 85r/1.030ms** · **KomaTopbar2 172r/1.002ms** ·
**DashboardPage 158r/1.002ms** · **DashboardLeftSidebar 196r/730ms** · DashboardMainLayout
196r/468ms · DashboardFooter 196r/413ms · RenderTextPreview 169r/403ms · DashboardManualDock
101r/315ms.

**Padrão estrutural confirmado**: em TODAS as janelas medidas, os 5 chrome components
(DashboardPage + KomaTopbar2 + DashboardLeftSidebar + DashboardMainLayout + DashboardFooter)
re-renderizam JUNTOS, em qualquer interação (tool toggle, slider, tecla, menu, zoom). Causa raiz:
`pages/Dashboard.tsx` (2.718 l.) tem **107 subscrições `useStore`** na raiz da página — qualquer
mutação de qualquer store re-renderiza a página inteira e a árvore abaixo (incl. os ~48 tooltips
do topbar/dock e os 6 modais fechados).

#### P0 — bloqueios >150ms atribuíveis (census, 1 imagem + 5 regiões, GPU real)

| # | Interação | Worst (tasks) | Causa raiz (código) | Fix mínimo |
| --- | --- | --- | --- | --- |
| P0-1 | Retorno `/#/dashboard` | **434ms** census / **558ms** mediana sweep (8/3 tasks) | Remount total: hash-route desmonta DashboardPage → StageGrid remonta RenderTextPreview (4-5 canvases + raster) + chrome + painéis lazy. Render mirado é pequeno (DP 7r/53ms) — o task é DOM/layout/raster do mount | Dívida central já planejada (grade extraída + subscrições por imagem; keep-alive/LRU descartado na Fase 2a). T4.2 |
| P0-2 | **Digitação no editor inline** (10 chars) | **262ms** e **13 long tasks em 10 keystrokes** | `useRenderTextPreviewInlineEditor.handleInlineEditorInput` chama `updateRegionText` **a cada tecla** → `updateRegions` → commit na store (`aioDetectionsByImage`) → DashboardPage (107 subs) + AioRightPanel (subscribes a snapshots/progress) + RenderTextPreview 34r/107ms + cascata de tooltips (380r) | O editor JÁ mantém draft local (`inlineEditor.value`, `isDirty`, `originalValue` + save/cancel) — parar de commitar por tecla: commit só em save/blur/Escape (saveInlineEditor já existe). **Maior ratio custo/benefício do census** |
| P0-3 | **Digitação no translator text stage** (26 chars) | worst 104-133ms mas **17 tasks** + DashboardPage 26r/126ms + 884 Tooltip renders | Cada tecla do tiptap escreve no estado do translator que vive na página → mesma cascata | Estado de digitação local ao estágio; commit no submit/blur. Mesma classe do P0-2 (verificação T08 ainda não cumprida em runtime) |
| P0-4 | **Rotate 90°** (topbar ou sidebar) | **392ms** (×2 janelas) | `rotateImage` substitui o array `images` → página inteira re-renderiza + canvas re-rasteriza na rotação + thumbs da sidebar | Subscrições por imagem (T4.2) cobrem o lado render; raster é local ao stage |
| P0-5 | **Toggle de ferramenta de segmento** (aio@segmentText e cleaner): seg-brush 298/270ms, seg-eraser 277/310ms, stage:segmentText 304ms | ~270-310ms por toggle | `manual-tools-store` update → re-render da página inteira + switch de modo do overlay de segmento (canvas) | Consumidores do manual-tools-store deveriam ser só dock + overlay (T4.4) |
| P0-6 | **ShortcutCenterModal open/close** | **278/265ms** | Modal monta ~90 linhas de atalhos de uma vez (ícones re-renderizam 50×+ — Trash2 54r, RotateCcw 53r) | Montar linhas sob demanda/virtualizar; ou dividir por grupo |
| P0-7 | **Add/remove imagem** (2ª imagem) | **269/237ms** | `addImages`/`removeImageById` substituem o array da collection → página inteira + PreviewStageItem do item novo (decode+draw) | Subscrições por imagem + card isolado (T4.2) |
| P0-8 | **Sub-mode manual** (aio) | **262ms** | `handleAioSubModeChange` normaliza TODOS os snapshots + reescreve `aioManualProgressByImage` para todas as imagens numa passada | Normalizar só a imagem ativa; lazy para as demais |
| P0-9 | **Empty stage** (clear-all na sidebar) | **353ms** | Botão real limpa ~15 mapas cross-domain + desmonta todas as stages + revoke | Transação única de store (menos commits intermediários); custo de unmount é inerente — prioridade menor |

Modos (switch): enhance 235ms, cleaner-2 221ms, typesetter 216ms, stitch 177ms, optimizer 133ms,
split 147ms, watermark 140ms — montagem de stage, já documentado na Fase 4; re-medidos e piores
com o instrumento ligado. Sidebar toggles 121-192ms; threads-input (digitação no number input)
189ms; viewmode-paginated 191ms — todos da mesma raiz (chrome-wide re-render).

#### P1 — hotspots de render provados (custo por render alto ou cascata)

| # | Componente | Evidência | Causa raiz | Fix |
| --- | --- | --- | --- | --- |
| P1-1 | **AioRightPanel** | 85r/**1.030ms** sessão; 10r/127ms durante digitação; re-renderiza com toda interação do painel | 1.609 l.; subscreve `aioPipelineSnapshots`, `aioPipelineSnapshotIndex`, `aioManualProgressByImage` (mapas inteiros), `llmSettings`, ~40 props da página; não é memo eficaz | T4.3: selectors por imagem/slice; dividir painel em seções memoizadas |
| P1-2 | **Família radix Tooltip** | 6.683r Tooltip+Trigger; 3.375r ×5 primitives; fan-out até **108:1** vs DashboardPage (dock:seg-slider-drag) | Multiplicador: cada re-render do topbar/dock/painéis re-renderiza todos os tooltips fechados (Provider + Popper + Portal + Content por tooltip) | Depois do T4.2 a cascata encolhe proporcionalmente; se ainda quente, memo no wrapper do tooltip / montar só o aberto |
| P1-3 | **KomaTopbar2** | 172r/1.002ms; 26r/91ms durante digitação no translator | Recebe dezenas de props da página (subscrições largas do DashboardPage vazam por props) | T4.2/T4.3: isolar subscrições próprias do topbar |
| P1-4 | **DashboardLeftSidebar/MainLayout/Footer** | 196r cada / 730+468+413ms — co-renderizam em TODAS as janelas | Mesma raiz (props da página) | T4.2 |
| P1-5 | **RenderTextPreview** | 34r/107ms durante digitação (esperado), 29r/~94ms no drag (boxes seguem ao vivo — correto) | Composição ok no drag; a digitação re-renderiza por commit de store (ver P0-2) | P0-2 resolve |
| P1-6 | **ModelManagerModal ×6** | 1.176r em 62 janelas — sempre montados com `open={false}` | `DashboardModelManagers` monta os 6 modais incondicionalmente (gating só pela prop `open`) | Montagem condicional (só quando `modalOpen`) |
| P1-7 | **AioSection / AioTimelineStep** | 736r/224ms; 104r/17ms numa janela de digitação | Re-renderizam com o painel a cada mutação de store do pipeline | T4.3 |

#### P2 — relevante mas menor

- Ícones lucide inline re-renderizam com os pais: ChevronDown 1.606r, Zap 818r, X 614r,
  Layers 605r, ChevronRight/Left ~530r cada, Paintbrush 520r, Languages/Trash2/RotateCcw ~54r por
  janela de modal — custo ~0,01ms/r; some com T4.2/memo.
- KlSlider 27r/7ms no drag do slider (com AioTimelineStep 54r/16ms) — o drag do slider re-renderiza
  o painel por frame (onValueChange → store) — aceitável, mas pegaria um memo por slide.
- Zoom in/out (92/99ms; 71-142 tooltip renders por clique), threads enable/disable (71/59ms),
  user menu open/close (106/56ms), download menu (62-129ms incl. PSD section 129ms) — single
  digits de ms de render, long tasks só por causa da cascata de página.
- Info modes: resources 74ms/imgur 89ms/blogger 106ms (BloggerWorkspace 22ms render) — saudáveis;
  guides 229ms (monta conteúdo longo).

#### Janelas limpas (zero findings)

`mode:aio` (0 tasks quando a stage já está montada — o custo do switch é o MOUNT, confirmado de
novo), `images:switch-active`/`images:switch-back` (0ms/0 tasks — troca de imagem ativa é barata),
`route:settings` (0ms), `route:model-rankings` (69ms), `route:scanlation-feed` (74ms),
`topbar:zoom-in` (92ms), `topbar:viewmode-longstrip` (102ms), `topbar:threads-disable` (59ms),
`topbar:user-menu-close` (56ms), `info:resources` (74ms). Sidebar esquerda/direita, modais e
menus são de 50-190ms — todos descem para trivial quando a cascata de página morrer.

#### Cenários SKIPPED (com motivo, não falsificados)

- **sub-mode cleaner**: não existe — `MODES_WITH_SUBMODE = ["aio","typesetter"]`
  (`constants/dashboard.constants.ts`). Registrado no probe.
- **Mobile drawer em viewport desktop**: gatilho só renderiza ≤1100px
  (`TOOLS_PANEL_COMPACT_BREAKPOINT`) — coberto via shrink de viewport em runtime (drawer aberto +
  item "Cleaner/RD" clicado: 77/101ms, saudável).
- **PSD section**: primeira tentativa fechou o menu (trigger é toggle) — corrigido no fluxo do
  probe; seção medida (129ms).
- **Editor inline exigiu área ativa**: dblclick só abre com a ferramenta "Select area" ativa e
  stage render (`useRenderTextPreviewPointer.ts` gate `areaSelectionEnabled`) — fluxo do probe
  reordenado; medido.
- **Seg tools no cleaner exigem detecções do cleaner** — detecções injetadas via
  `cleaner-store.ts` (não `region-editor-store.ts`); medido.

#### Problemas de infra do probe (resolvidos, para histórico)

1. Playwright limpa `outputDir` (`.artifacts`) no início de CADA run — os JSONs das runs 1-2 do
   audit se perderam (console logs retidos); agora os artefatos são copiados para
   `tests/e2e/probe-out/` imediatamente após cada run.
2. `test.use({launchOptions})` não pode ficar em describe (força worker novo) — viewport mobile
   feito com `setViewportSize` em runtime.
3. `locator.click()` travou 10min em actionability ("waiting for element to be stable") no botão
   de zoom — todos os cliques do probe migraram para mouse cru no centro do bounding box com
   timeout limitado (nunca mais trava; falha vira SKIPPED logado).
4. Uma ocorrência de EBUSY no watcher do vite (lock do video.webm de run morta) — transitória.
5. `region-editor-store` não tem `setCleanerDetectionsByImage` (está no `cleaner-store`) —
   descoberto pelo probe, corrigido.

#### Ordem de fix recomendada (T4.2+)

1. **T4.2 (como planejado)** — DashboardPage: subscrições por imagem + extração da grade. Mata a
   raiz que multiplica tudo (co-render dos 5 chrome components em 100% das janelas, tooltips
   108:1, modais fechados 1.176r). Esperado derrubar também: rotate, add/remove imagem, threads,
   sidebars, menus.
2. **T4.2b (novo, barato, alto ganho)** — editor inline: parar de commitar `updateRegionText`
   por tecla (commit em save/blur/Escape; o draft local já existe). Mesma classe para o translator
   text stage. É a verificação "digitação sem cascata" da T08 que o runtime mostra não cumprida.
3. **T4.3** — AioRightPanel: selectors por slice/imagem (snapshots, progress, llmSettings), seções
   memoizadas.
4. **T4.4 (ordem de custo medido)** — (a) shortcut center: montagem sob demanda das ~90 linhas;
   (b) sub-mode manual: normalizar só a imagem ativa; (c) toggle de ferramenta de segmento:
   consumidores narrowed (dock + overlay); (d) ModelManagerModal: montagem condicional;
   (e) clear-all: transação única.
5. Re-medir com o MESMO probe (census + sweep + drag) após cada item; comparar contra as medianas
   desta seção (não contra os números pré-react-scan).

### T4.2b — review (2026-09-01, Review Agent)

**Veredito: ISSUES** — ciclo de flush correto nos caminhos principais e gates green, mas 1
regressão de comportamento com perda de dados num gesto comum + 1 dead-click de UX precisam de fix
antes do commit. Os 5 arquivos de produção modificados conferem com o declarado (mais
refactor-queue.md e probes untracked).

**Verificação estática (código)**
- Flush lifecycle correto: `pendingDraftRef` setado em `handleInlineEditorInput`; commit único em
  save (blur/Ctrl+Enter), Escape (descarta draft + re-committa originalValue — igual ao estado
  líquido pré-mudança), pointerdown-away/pointercancel (`closeInlineEditor` = flush + close,
  preservando o texto que os commits por tecla mantinham), reopen em outra região, switch de
  tool/stage (effect), região deletada (descarta — texto morre com a região, como antes) e
  dirty-unmount. `updateRegionTextRef` (latest-ref) evita stale closure; `commitPending` esvazia o
  ref antes de escrever → sem double-commit no blur duplo. `RenderRegionOverlayBox` usa
  `setState` só no close não-dirty do blur (inócuo). Type dock não insere texto (só estilo) —
  nenhum caminho bypassa o draft.
- Translator: sync-effect não entra em loop (guarda `pending === null` / comparação contra
  `pending`; echo do próprio flush vira no-op); Clear limpa o draft antes de zerar a store;
  `setTranslatorDraftText`/`setTranslatorTextDirty` são actions estáveis do zustand → o effect de
  unmount não re-dispara no meio da digitação. `translator.execution.ts`: `translatorDraftText`
  era consumido só dentro de `runTranslatorText` (grep em todo o código) → `getState()` na
  execução é equivalente; painel/blur sempre commitam antes do click (blur dispara no mousedown).

**Gates (todos green)**
- `dashboard-refactor-smoke` 11/11 · `text-follow-probe` 2/2 (drag 0 tasks; commit 1 task ~250ms,
  referência pré-existente) · census 2/2 (×2 runs, sem assertion failure) · typecheck clean ·
  vitest 43/43.
- A/B census T4.1 baseline vs T4.2b (janelas de digitação, mesmo instrumento):
  - `region:type-10-chars`: 13 tasks/worst 262 → **3-5 tasks/worst 150-311**; DashboardPage 10r → 0,
    Tooltip 380r → 0, KomaTopbar2 10r → 0 (cascata de página eliminada; RenderTextPreview 20-21r
    é o estado local do editor, esperado). Claim "13→~2" confirmado dentro da variância.
  - `translator:type`: 17 tasks → **12-16 tasks** (worst 104 → 141-156); DashboardPage 26r/126ms → 0,
    Tooltip 884r → 0, TranslatorToolsPanel 26r → 0 — a cascata morreu, mas o claim "~2 per window"
    NÃO se confirmou: resta um bloqueador residual de ~60-155ms por ~2 keystrokes, presente com a
    mesma magnitude no baseline (57-104ms) → pré-existente, NÃO introduzido por T4.2b (a mudança
    só reduziu trabalho por tecla), mas também não resolvido. Requer atribuição (follow-up T4.4).
- Notas de instrumento: tasks individuais ficaram ~30-60% maiores nesta sessão em todo o census
  (escape-editor 187→240-262, dblclick 240→308-329) — variância de sessão documentada no T4.1.

**Findings (números referem-se ao working tree de 2026-09-01)**
1. **ALTO — reabertura da MESMA região no meio da edição perde o texto digitado.**
   `useRenderTextPreviewInlineEditor.ts` (`openInlineEditorForRegion`): `initialText` é lido do
   snapshot pré-flush; o dblclick delegado no overlay (`RenderTextPreview.tsx` onDoubleClick →
   `useRenderTextPreviewPointer.handleRegionDoubleClickDelegated`) borbulha do contentEditable, então
   double-click para selecionar palavra DURANTE a edição reabre a mesma região: o flush comita o
   draft, mas o `useLayoutEffect` reescreve `node.textContent` com o texto pré-digitação; se o
   usuário digitar mais e salvar (ou der Escape — `originalValue` também ficou stale), o texto
   digitado se perde. Pré-mudança era seguro (commits por tecla mantinham o snapshot atual).
   **Fix:** capturar o valor do draft pendente como `initialText` quando
   `pendingDraftRef.current?.regionId === region.id` antes do flush.
2. **MÉDIO — botão Translate do TranslatorToolsPanel vira dead click enquanto digita.**
   `TranslatorToolsPanel.tsx` (~linha 492): `disabled` lê `translatorDraftText` da store; com o
   commit adiado, segue desabilitado durante a digitação (store vazia), e botão disabled engole o
   mousedown — a textarea não perde o foco, não há blur → não há flush → clique morto. Pré-mudança
   habilitava por tecla. **Fix (escolher):** (a) espelhar o estado "pending" da stage para o painel
   via slice mínimo da store (sem subscrição por tecla em componentes pesados), ou (b) o painel
   habilita só por `processing` e o guard vazio de `runTranslatorText` mostra a mensagem de status.
3. **BAIXO — draft residual no close não-dirty.** `RenderRegionOverlayBox.tsx` blur não-dirty chama
   `setState(null)` sem limpar `pendingDraftRef`; o draft (== originalValue) pode sobreviver à
   sessão e um flush posterior reescreve `originalValue` na região — inócuo hoje, mas se outra
   feature reescrever o texto da região no meio-tempo (ex. refine por IA), o flush tardio reverte.
   **Fix:** limpar `pendingDraftRef` quando `nextValue === originalValue` em
   `handleInlineEditorInput` (ou no close não-dirty).

**Follow-ups (não bloqueiam):** (a) atribuir o bloqueador residual de ~60-155ms/keystroke no
translator textarea (presente no baseline; render é ~2-3ms/tecla — não é o caminho da store);
(b) capture/history de workspace durante digitação lê o último commit (getState) — texto não
commitado só entra em blur/unmount; aceitável sob o design, registrar na documentação do T4.2a;
(c) painel Translate com lag de habilitação após flush — resolvido pelo finding 2.

### T4.2b — correction (2026-09-01, Correction Agent)

Os 3 findings do review foram corrigidos no working tree (sem commit). Spec throwaway
`tests/e2e/t42b-correction-check.spec.ts` cobriu os 2 gestos (RED contra o código pré-fix,
GREEN pós-fix) e foi deletada após a verificação.

1. **ALTO (perda de dados no reopen da mesma região) — corrigido.**
   `useRenderTextPreviewInlineEditor.ts` (`openInlineEditorForRegion`): quando
   `pendingDraftRef.current?.regionId === region.id`, o draft pendente é capturado ANTES do flush
   e usado como `initialText`/`originalValue` do editor reaberto (o flush segue — a store recebe
   o texto digitado; o `useLayoutEffect` de reescrita do contentEditable vira no-op porque o valor
   já é igual). Reopen de OUTRA região preserva o flush-before-open (draft antigo commita, editor
   novo semeia o snapshot da nova região). Escape pós-reopen agora reverte para o texto digitado
   (originalValue consistente), sem double-commit.
2. **MÉDIO (dead click no Translate do painel) — corrigido pela opção (a) do review.** Slice
   booleano `translatorTextPending` no `translator-store` ("existe draft não-commitado não-vazio";
   setado em `handleDraftInput`, limpo em flush/clear/replace-externo/unmount) espelhado pela
   `useTranslatorTextDraft` (`TranslatorTextStage.tsx`). `TranslatorToolsPanel.tsx` lê o slice via
   section wrapper: `disabled = processing || (store vazio && !pending)`. Booleano → zustand só
   notifica na virada, digitação dentro do mesmo estado continua sem cascata; empty-sem-pending
   segue desabilitado (affordance preservada); habilita por tecla sem blur, o mousedown do click
   blur→flush→executa (`runTranslatorText` lê o texto commitado no `getState()`).
3. **BAIXO (draft residual no close não-dirty) — corrigido.** `handleInlineEditorInput` limpa
   `pendingDraftRef` quando `nextValue === originalValue` (reverter ao original descarta o draft);
   `isDirty` do ref virou campo morto e foi removido — ref não-nulo ⟺ dirty, então o close
   não-dirty do blur (`setState(null)`) não pode mais vazar draft que um flush tardio
   reescreveria sobre escritas externas (ex. refine por IA).

**Gates pós-correção (todos green):** spec dos gestos RED→GREEN conforme acima ·
`dashboard-refactor-smoke` 11/11 · `text-follow-probe` 2/2 (drag 0 tasks; commit 1 task ~178-195ms,
referência pré-existente) · typecheck clean · vitest 43/43.

### T4.2 — execution (2026-09-01, Agente de Execução)

**Status honesto: ESTRUTURA PRONTA, GATE PARCIAL.** A cirurgia de subscrições foi executada
(107 subs mapeadas; 14 removidas da página; 6 hooks de domínio dessubscritos dos mapas; interlock
de persistência migrado de render-effect para store.subscribe), typecheck/vitest/smoke/probes
green — mas o gate central (DashboardPage 0-1 render por region-select com chrome co-render
morto) **não foi atingido**: region-select mantém DP 2r (select:1-4) / 1r (select:5), igual ao
baseline T4.1, porque `useActiveAioRegionState` + `useTypographerActiveState` continuam no corpo
da página alimentando dock/painel/keyboard. Causa raiz restante mapeada e registrada abaixo.

#### 1. Mapa das 107 subs (classificação a/b/c)

Ações zustand (setX — identidade estável, zero re-render): 58 das 107. **Slices de valor
(49)** — classificação por consumidor real:
- **(a) consumido só em callback/event-time → getState() no callback (14 slices movidas):**
  `aioDetectionsByImage` (mapa), `aioSelectedRegionByImage` (mapa), `aioManualProgressByImage`
  (só entrada ativa fica reativa), `aioPipelineSnapshots` (array), `aioImageSnapshotIndexById`,
  `aioAutoHistoryAvailable` (effect→getState), `downloadItems` (renderToBlob/bundle/getters),
  `cleanerDetectionsByImage`, `translatorDetectionsByImage`, `cleanerProcessedBaseByImage`,
  `translatorProcessedBaseByImage`, `cleanerManualImageEditsByImage`, `aioManualImageEditsByImage`,
  `manualImageWandTolerance`, `renderDefaultStyle` (hook), `cleanerMode` (mantido, raro).
- **(b) multi-consumidor de página → mantido (33):** mode, subMode, processing, images, activeId,
  aioStageSelection/Options, aioSrcLang/TgtLang, maskDilation/HD* (args do handleClean),
  llmSettings (arg do handleClean), srcLang/tgtLang, translatorWorkspaceMode, tool scalars
  (segmentEditTool/manualImageTool/configOpen/areaSelectionCreateMode — P0-5 é T4.4c),
  typographerQueueSelectedId/SelectedSnapshotId (effect de validação), statusMessage (effect de
  tone), emptyPreviewTipIndex, workspaceRestoreToken, user, batchThreads* (persistência
  localStorage), cleanerAiModelKey/AdditionalInstructions (fallback effects), translatorSfxCleanModelKey.
- **(c) derivados multi-store → verificados; sem selector de mapa onde basta entrada
  (2 corrigidos):** `activeManualProgress` (entrada por imagem no aio-snapshot-state),
  `activeImageDetections/activeSelectedRegionId` (entradas por imagem no region-editor.render,
  cleaner.editing, translator.inputs).

#### 2. Mudanças por arquivo (resumo)

| Arquivo | Mudança |
| --- | --- |
| `stores/typographer-store.ts` | +`typographerSessionsByImage` +action (value-or-updater) |
| `hooks/typographer.ts` | Workspace stateless em render: hidratação/salvo-debounce via `store.subscribe` (fora do React); `saveSnapshot/restoreSnapshot` via getState; `useTypographerActiveState` subscreve a **sessão da imagem ativa** (slice único) em vez do mapa |
| `hooks/region-editor.snapshot.ts` | `useAioRegionSnapshotSync`: leituras de detecções/seleção/progresso → getState (só setters subscrevem) |
| `hooks/aio-snapshot-state.ts` | Getters `getAioImageSnapshotIndex/Meta/resolveAioStageKey` + rewind/forward/handleAioSubModeChange/apply/patch/normalize → getState; render-level = slices por imagem (progresso da imagem ativa, índice global, comprimento) |
| `hooks/region-editor.render.ts` | `useActiveAioRegionState`: slices por imagem (`?? EMPTY_REGIONS`); `useAioRegionRenderToBlob`: downloadItems via getState (arg removida) |
| `hooks/cleaner.editing.ts` | `useActiveCleanerRegionState` por imagem; `useCleanerManualEdits`/`useCleanerRegionEditing`/wand tolerance → getState |
| `hooks/translator.inputs.ts` | `useActiveTranslatorRegionState` por imagem |
| `hooks/manual-tools.ts` | `useAioManualEdits`/`useAioWandHealing` → getState (mapa + tolerância) |
| `hooks/image-collection.ts` | `getPreviewSrc` → getState (5 mapas); args de mapas removidas |
| `hooks/cleaner.ts` | `useCleanerActions`: leitura de `cleanerManualImageEditsByImage` no run → getState (arg removida) |
| `hooks/typographer.ts` (controls) | `activeRegions`/sessão lidos no evento (args removidas) |
| `workspace-persistence.capture.ts` / `.ts` | **Interlock de histórico/autosave: render-effect de ~50 deps → `store.subscribe`** (13 stores de domínio); builder de captura 100% getState; espelho de captura idem. Mesmo conjunto de gatilhos, zero re-render da página pela persistência |
| `sections/StageGrid.tsx` | **Grade auto-subscrita**: 27 slices (mapas aio/cleaner/translator/typographer, tools, snapshots, steps, edits/preview bases, downloadItems) |
| `sections/DashboardMainLayout.tsx` | Remove as 27 subs de encaminhamento da grade + props de estado ativo dos painéis |
| `sections/AioRightPanel.tsx` / `CleanerToolsPanel.tsx` / `TranslatorToolsPanel.tsx` | Auto-subscrição do estado ativo (`useActive*RegionState` no painel); props de página removidas |
| `pages/Dashboard.tsx` | 2718 → 2660 l.; 107 → 97 subs; effect de normalização manual com deps estreitas + getState |

#### 3. Region-select: medição (audit probe, 3 runs, headed GPU)

| Janela | T4.1 baseline | T4.2 pós | Delta |
| --- | --- | --- | --- |
| region-select:1 | DP 2r/~24ms · chrome 2r · Tooltip 76r | DP **2r**/~10ms · chrome 2r · Tooltip 72r | renders **iguais**, ms −58% |
| region-select:5 | 1r | DP **1r**/4ms | igual |
| route:dashboard | DP 7-9r/~53ms · AioRP 8r/89ms | DP **8r**/40ms · AioRP 8r/68ms | ~igual |
| boot / drag / fixture | 6r / 2r / 10r | 6r / 2r / 10-11r | igual |

**Gate NÃO batido** (2r > 0-1 em select:1-4; chrome continua co-renderizando 1:1 — unnec 0, todas
as renders prop-driven). **Causa raiz restante (mapeada, não executada por falta de orçamento da
sessão):** `useActiveAioRegionState` (slices de detecção+seleção da imagem ativa) e
`useTypographerActiveState` (sessão da imagem ativa — seleção escreve `session.selectedRegionId`)
rodam no corpo de `DashboardPage` e alimentam: `canEditActiveRenderStage`/`activeSelectedRegion`
(dock + painel), `activeDockRegionsCount`, args event-time do keyboard/region-editing/controls.
**Caminho documentado para 0r:** dock auto-subscribe seleção+contagem; painel já se auto-subscribe
(falta `canEditActiveRenderStage` computado no painel); keyboard/region-editing/controls leem
seleção via getState no evento (padrão já aplicado aos mapas); `useTypographerActiveState` passa a
subscrever identidades de `queue`/`snapshots`/`activePresetId` em vez da sessão inteira (draft
deixa de re-renderizar a página no typesetter).

#### 4. Gates

| Gate | Resultado |
| --- | --- |
| typecheck (interface + raiz + tauri) | ✅ 0 erros |
| vitest | ✅ 43/43 |
| smoke dashboard | ✅ 11/11 |
| text-follow probe | ✅ 2/2 — drag **0 tasks**; commit **169/153ms** (T4.1: 183/198; T4.2b: 178-195); massa 10419→0/0→4904; boxDx 300px |
| react-scan audit | ✅ (sem assertion) — 3 runs, medianas acima |
| react-scan census | ✅ 2/2 (1 re-run: flake EBUSY/ERR_CONNECTION_REFUSED do vite — infra documentada no T4.1) |

Census (1 run, comparado à mediana T4.1 — **não reivindicado como melhora sem 3 runs**): 
mode:cleaner 116 (vs 229) · typesetter 181 (vs 249) · translator 82 (vs 140) ·
retorno dashboard **442** (vs 558) com DP 6r/31ms (vs 8r/53ms) · translator:type worst 58ms/1 task
(vs 17 tasks) · region:type-10-chars 0 tasks · images:add/remove 351/417 (vs 269/237 — pior, sessão
ruidosa). Direção consistente com a queda de trabalho por commit, mas exige mediana de 3 antes de
qualquer claim.

#### 5. O que permanece estrutural e por quê

1. **Seleção da imagem ativa ainda re-renderiza a página** (2r) — raiz e caminho na seção 3 acima.
2. **Retorno ao dashboard (~440ms)** — dominado pelo remount da stage (DOM/raster, Fase 2a provou);
a queda de 8r→6r/53→31ms no espelho de render ajuda pouco o task bloqueante.
3. **Add/remove imagem (351/417ms)** — `images` é sub legítima da página (efeitos de poda,
activeImage, hooks); precisa da transação única de store (T4.4e) + isolamento do card.
4. **Drag-commit window (169/153ms)** — restante é redraw do canvas do stage + re-render do painel
(T4.3), não cascata de página.
5. **Toggle de ferramenta (P0-5)** — mantido na página por design nesta fase (T4.4c).

#### 6. Follow-ups (T4.3)

1. Mover o consumo de seleção/sessão para fora de `DashboardPage` (dock auto-subscribe +
keyboard/edit/controls via getState + `useTypographerActiveState` por identidades de
`queue`/`snapshots`/`activePresetId`) → alvo 0-1r em region-select e chrome co-render morto.
2. `canEditActiveRenderStage` computado no AioRightPanel (painel já tem os slices).
3. Mediana de 3 do census para os deltas da seção 4 antes de usar como gate.
4. Dock: `activeDockRegionsCount` via slice próprio.

### T4.2 — execution II (2026-09-01, Agente de Execução — continuação)

**Status: GATE CENTRAL BATIDO.** Continuação direta da execução anterior (mesma sessão de
trabalho, working tree sem commit): o caminho documentado na seção 3 acima foi executado por
completo. Region-select caiu de **DP 2r + chrome 2r** (T4.1 baseline e 1ª execução) para
**DP 1r (0r no re-select/no-op) + chrome co-render morto**. Nos caminhos de usuário do census
(clique na região sobre a stage), a página inteira — DP, topbar, sidebars, footer, tooltips —
fica em **0 renders e 0 long tasks**. O 1r residual do audit (escrita crua de
`setAioSelectedRegionByImage`) ficou **por atribuir**: nenhum selector de valor da página
reage ao mapa de seleção nos greps exaustivos, e o re-select (nova escrita, valor já igual à
seleção anterior na sequência do probe) mostra 0r — o render só ocorre quando o VALOR da
seleção muda de verdade. 1r está dentro do gate (0-1); ver seção 5.

#### 1. Mapa — fechamento da classificação (101 → 89 subs de valor na página)

Da 1ª execução restaram 49 slices de valor + 58 actions. Nesta continuação, os multi-consumidor
(b) que ainda vazavam seleção/sessão pela página foram resolvidos:

- **(a) → event-time getState (novos 12 slices movidos):** `aioDetectionsByImage` +
  `aioSelectedRegionByImage` (args do useAioManualExecution → getState em
  useAioManualProgressControls/useAioManualStageExecutor), `aioManualProgressByImage` +
  `aioImageSnapshotIndexById` (progress controls/executor/skip), `aioPipelineSnapshots`
  (getAioRegionsFromSnapshot), active selection/region/preset (keyboard, region-editing,
  typographer controls — helpers `readActive*` em region-editor.render.ts),
  `activeTranslatorSelectedRegionId` (translator visual/retranslate), mapas do bundle/PSD
  (export-download.ts/.actions.ts), `cleanerProcessedBaseByImage` (bundle).
- **(b) → auto-subscrição no consumidor (8 props de página removidas):** seleção ativa +
  contagem de regiões (dock), `canEditActiveRenderStage` (AioRightPanel), sessão/preset/
  multi-seleção da imagem ativa + listas de preset/swatches (StageGrid), sessão + 2 efeitos de
  validação de queue/snapshot (TypographerToolsPanel), `activePsdAioRegionCount` como slice
  primitivo (export availability).
- **(c) → derivados verificados:** `syncActiveManualStageSnapshot` migrou de render-effect para
  `store.subscribe` (region+pipeline) com guarda de reentrância — a versão sem guarda recursava
  até stack overflow (apanhado pelo text-follow probe, não por typecheck).

#### 2. Mudanças por arquivo (delta desta continuação)

| Arquivo | Mudança |
| --- | --- |
| `hooks/region-editor.render.ts` | +4 helpers event-time (`readActiveAioSelectedRegion(Id)`, `readActiveSelectedRegionIdForMode`, `readActiveTypographerPreset`) |
| `hooks/region-editor.ts` | `useAioRegionEditing` 100% event-time: seleção/region/preset/imagem lidos via getState dentro dos callbacks; args de página removidos (7) |
| `hooks/typographer.ts` | `useTypographerControls` event-time (args de página removidos: 6); `useTypographerActiveState` **deletado** (órfão — os slices foram para o TypographerToolsPanel) |
| `hooks/use-dashboard-keyboard.ts` | seleção via `readActive*` no event-time; `aioSteps.render` via getState no handler; args removidos (3) |
| `hooks/manual-tools.ts` | `useManualToolToggles` recebe contagem primitiva (`activeCleanerDetectionsCount`) em vez do array |
| `hooks/useAioManualProgressControls.ts` (+ executor/skip) | mapas → getState; `getAioRegionsFromSnapshot` sem subscrição; sync com guarda de reentrância |
| `hooks/aio-pipeline.manual-execution.ts` | args de mapas removidos; sync dispara via `store.subscribe` (mesmo gatilho do efeito baseline) |
| `hooks/translator.ts` / `translator.execution.ts` | `activeTranslatorSelectedRegionId` → getState no event-time (args removidos) |
| `hooks/export-download.ts` / `.actions.ts` / `.availability.ts` | mapas do bundle/PSD → getState; `hasAioRenderRegionsForPsd` via slice de contagem da imagem ativa |
| `sections/ManualToolsDock.tsx` | auto-subscribe seleção ativa + contagens (aio/cleaner) — 2 props removidas |
| `sections/AioRightPanel.tsx` | `canEditActiveRenderStage` computado no painel — prop removida |
| `sections/StageGrid.tsx` | auto-subscribe `textFillSwatchState`/`typographyPresetState` + mesmos memos da página — 3 props removidas |
| `sections/TypographerToolsPanel.tsx` | auto-subscribe sessão/multi-seleção/regions; herda os 2 efeitos de fallback de preset/queue/snapshot da página (mesmos inputs de store) — 4 props removidas |
| `sections/DashboardMainLayout.tsx` | encaminhamento das props removidas limpo |
| `pages/Dashboard.tsx` | 2660 → **2527 l.**; subs de valor 97 → **89** (todas as restantes são multi-consumidor legítimo: mode/subMode/processing/images/activeId/args de execução/status/downloadItems) |

#### 3. Region-select: medição final (audit probe, headed GPU)

| Janela | T4.1 baseline | 1ª execução | **Esta execução (mediana de 3+)** |
| --- | --- | --- | --- |
| region-select:1-4 | DP 2r/~24ms · chrome 2r · Tooltip 76r | DP 2r | **DP 1r/~4ms · chrome 1r · Tooltip 36r** |
| region-select:5 (re-select/no-op) | 1r | DP 1r | **DP 0r (só DashboardStageSection 1r)** |
| drag (20 passos) | DP 2r | DP 2r | **DP 2r** (igual — selection é escrita real no commit) |
| route:dashboard | DP 7-9r/53ms | DP 8r/40ms | **DP 8r/~30ms · AioRP 8r/68ms** (remount, inalterado) |
| census region:select (clique usuário) | — | — | **DP 0r · Topbar 0r · Tooltip 0r · 0 tasks** (×3 runs) |
| census region:type-10-chars | 13 tasks/262ms | — | **0 tasks** (×3 runs) |

Chrome co-render em region-select caiu de "1:1 com a página" para **0 nos selects de usuário**
e 1r-igual-Página no audit (a página só passa 1× por mudança real de seleção; DashboardMainLayout
não é memoizado, então o chrome co-renderiza com essa única passada — memoização do layout +
estabilização de identidade de props é o passo seguinte se 0r absoluto for exigido).

#### 4. Gates

| Gate | Resultado |
| --- | --- |
| typecheck (interface ×3 durante a sessão + raiz) | ✅ 0 erros |
| vitest | ✅ 43/43 |
| smoke dashboard | ✅ 11/11 (×2 runs) |
| text-follow probe | ✅ 2/2 ×3 runs — drag **0 tasks**; commit **120/111/123ms** full (T4.1: 183/198; 1ª exec: 169/153); massa 10419→0 / 0→4904; boxDx 300px |
| react-scan audit | ✅ sem assertion; medianas na seção 3 (4 runs salvos em `tests/e2e/probe-out/react-scan-audit-t42-run*.json`) |
| react-scan census | ✅ 2/2 ×3 runs, sem assertion failure; artefatos em `tests/e2e/probe-out/react-scan-census-t42-run*.json` |

Census (mediana de 3): mode:cleaner 110 (T4.1: 229) · typesetter 77 (249) · translator 69 (140)
· watermark 162 (127 — dentro da variância de sessão) · retorno dashboard 336/339/327ms com
**DP 6r/19ms** (T4.1: 558ms, 8r/53ms) · images:add/remove 205/183 (269/237) · region:type 0
tasks (13) · translator:type 0 tasks (17). Todos os deltas de long task compartilham a sessão
ruidosa documentada no T4.1 — a queda dos caminhos de seleção é a única reivindicação forte
(mesmo instrumento, mesmo dia, mecanismo atribuído).

#### 5. O que permanece estrutural e por quê

1. **1r residual no audit region-select — por atribuir.** Ocorre só quando o VALOR da seleção
   muda (re-select = 0r); os greps exaustivos não encontram selector de valor da página reagindo
   ao mapa de seleção. Candidatos a investigar com Profiler/por eliminação: efeito de página com
   setState derivado de seleção ou subscrição indireta. Está dentro do gate (0-1r) e o caminho
   de usuário (census) já está em 0r.
2. **Chrome co-render 1:1 com a passada restante da página** — `DashboardMainLayout` não é
   memoizado; memoizá-lo exige estabilizar `STAGE_TABS` (recriado a cada render da página) e os
   elementos de seção (`translationFreeProviderManagerSection` etc.).
3. **`downloadItems`/`lastActionScope` na página** — sub legítima hoje (getters de download);
   event-time na outra metade dos consumidores a abriria.
2. **Retorno ao dashboard 327-339ms** — remount da stage (DOM/raster), provado dominante na
   Fase 2a; o espelho de render da página caiu 8r→6r/53→19ms, mas o task é mount.
3. **images add/remove ~180-210ms** — `images` é sub legítima da página (efeitos de poda,
   activeImage, hooks); precisa da transação única (T4.4e) + isolamento do card.
4. **mode:watermark 160-173ms** — piorou vs T4.1 dentro da variância; sem mudança atribuível.
5. **drag-commit 111-123ms** — redraw do canvas + re-render do painel (T4.3), não cascata.

#### 6. Follow-ups (T4.3+)

1. Atribuir o 1r residual do audit region-select (Profiler/eliminação a partir dos candidatos da
   seção 5.1) e memoizar `DashboardMainLayout` + estabilizar `STAGE_TABS`/elementos de seção se
   0r absoluto + chrome morto no audit forem exigidos.
2. AioRightPanel: selectors por slice dos mapas de snapshots/progress (subscribes inteiras que
   restam no painel) — T4.3 como planejado.
3. T4.4 na ordem de custo: (a) shortcut center sob demanda; (b) sub-mode manual normalizando
   só a imagem ativa; (c) toggle de ferramenta de segmento narrowed; (d) ModelManagerModal
   montagem condicional; (e) clear-all transação única.
4. `downloadItems`/`lastActionScope` → event-time na metade restante dos consumidores de
   download (getters já existem) — remove a subscrição da página.
5. Reabrir retorno-dashboard apenas se o jank voltar a ser reportado (Fase 2a adjudicou o custo
   como mount; keep-alive rejeitado).

### T4.2 — review (2026-09-01, Review Agent)

**VERDICT: ISSUES (1 must-fix, pequeno; todo o resto aprovado).** A cirurgia de subscrições da
continuação (execution II) foi auditada linha a linha no eixo stale-read. As conversões
render-time → event-time são consistentemente MAIS frescas que o baseline (leitura no call time
vs valor capturado no último render), e não encontrei nenhum caminho que aja sobre seleção/região/
preset/imagem anteriores. O achado único está na migração do interlock de persistência
(execution I): o gatilho de hidratação foi perdido.

#### 1. Achados

1. **[MUST-FIX antes do commit] `workspaceChangeSignal` não dispara na conclusão da hidratação**
   — `packages/interface/src/pages/dashboard/hooks/workspace-persistence.ts:469-491` (lista de
   13 stores) e `:340-380` (efeito de hidratação). O efeito baseline tinha `workspaceHydrated`
   como dep e re-semeava o baseline de histórico na virada false→true; a versão store.subscribe
   não inclui `useWorkspacePersistenceStore` e o componente não assina mais `workspaceHydrated`
   (leitura via `getState()`). Consequência: a PRIMEIRA mudança de domínio pós-hidratação (e
   pós undo/redo restore, `:113` também reseta `workspaceHistoryReady` sem re-gatilho) cai no
   ramo `!workspaceHistoryReady` (`:412-419`) e apenas semeia assinaturas — não comita histórico
   nem marca `workspaceAutosaveDirty`. Delta visível: primeira ação do usuário após abrir o app
   não é undoable, e uma única edição quitada antes do intervalo de autosave não é marcada
   suja. Converge da segunda mudança em diante. **Fix (1 linha):** adicionar
   `useWorkspacePersistenceStore` à lista `stores` do efeito do sinal (`:469`) — o write de
   `setWorkspaceHydrated(true)` então dispara o sinal na hidratação (as escritas do próprio
   sinal são mutação direta + convergem; sem loop). Alternativa: chamar
   `workspaceChangeSignal()` logo após cada `setWorkspaceHydrated(true)` dos 4 ramos da
   hidratação.
2. **[Não-bloqueante, medição] mode:watermark +28% vs mediana T4.1** — 160/162/173ms (mediana
   162) vs 127ms. Dentro do spread do próprio T4.1 (123-167; run 1 foi 167) e o render-path
   MELHOROU nessa janela (audit: DP 2r/7ms; census DP 4-5r/17-19ms) — o long task é
   raster/entrada de modo, sem mudança atribuível no diff. Registrado para investigação no
   T4.3/T4.4 (re-medianar se persistir).
3. **[Não-bloqueante, notas de auditoria]** (a) efeitos de validação de queue/snapshot do
   typographer migraram da página (todos os modos) para dentro de `TypographerToolsPanel`
   (montado só com `deferredStageMode === 'typesetter'`): o escopo estreitou, mas os únicos
   consumidores reativos fora do painel eram os próprios efeitos — os demais
   (`workspace-persistence.capture.ts:148-151`, `typographer.ts:544/678`) são event-time
   getState; o estado converge no mount do painel. (b) `applyQueueTextToActiveRegion` agora
   escreve `queueIndex: -1` (findIndex em fila vazia) onde o baseline escrevia `null` quando a
   sessão não existia — inalcançável na prática (o queueItem vem da sessão). (c) Tree contém 31
   arquivos modificados sob packages/interface/src = execution I + II sem commit (a claim "16
   production files" cobre só o delta da execution II; consistente com as tabelas do registro).

#### 2. Stale-read audit (resumo por área)

- **Manual execution** (`useAioManualProgressControls/StageExecutor/StageSkip`): progress/
  detections/índice lidos via getState no topo de cada callback — estritamente mais fresco que o
  baseline (que usava valores do último render). O executor assíncrono captura `progress` no
  início do run, igual ao baseline (comportamento pré-existente, não regressado). Sync
  `syncActiveManualStageSnapshot`: mesmo conjunto de gatilhos do efeito baseline (as 5 fatias
  viviam em 2 stores; subscribe nos 2 stores é superconjunto seguro — cada chamada valida
  drift via `shouldSync`). Guarda de reentrância (`isSyncingActiveManualStage`, closure do
  useCallback) cobre exatamente a recursão síncrona apply→subscribe→sync; escritas pós-await
  re-disparam o sync sem guarda — sem lost update (apanhado e provado pelo text-follow probe
  durante a execução).
- **Keyboard/region-editing/typographer controls**: todos os `readActive*` resolvem no
  call-time; `activeId` permanece dep de callback/efeito (subscrição legítima da página).
  Edge-cases de seleção vazia preservados (`if (!region) return false/void`). Nenhum caminho
  age na seleção anterior.
- **Export download bundle/PSD**: leituras de mapas/`downloadItems` dentro dos callbacks de
  build (clique) — não há serialização de estado capturado; menu aberto + imagens mudando não
  produz dados per-image velhos.
- **Helpers `readActive*` (region-editor.render.ts:39-96)**: leituras puras (sem subscribe),
  fallbacks equivalentes aos memos do baseline (`?? EMPTY_REGIONS`, session-preset → mode-preset,
  `resolveRenderTextMode` com os mesmos defaults 'auto'/'text_bubble').
- **Props → sections (8 props + self-subscriptions)**: `canEditActiveRenderStage` recomputado no
  AioRightPanel com a mesma expressão; `activeDockRegionsCount` no dock com `mode` próprio;
  slices por imagem (`?? null`/length) idênticos aos memos da página. Nada dependia de
  re-render do pai: os 2 efeitos movidos para TypographerToolsPanel têm os mesmos inputs de
  store (ver nota 3a acima). `StageGrid` assina todas as 5 fatias que `getPreviewSrc` lê — os
  previews da grade ficam frescos; `getListPreviewSrc` permanece sem consumidores (pré-existente).
- **`useTypographerActiveState`**: 0 referências no repo (grep em packages/ e apps/) — órfão
  confirmado, deleção correta.
- **Dashboard.tsx**: diff é só remoção de subscrições/props + mudança dos 2 efeitos + deps
  estreitas do efeito de normalização manual (leitura getState no corpo; os gatilhos removidos
  voltam via `aioAutoHistoryAvailable`, ainda subscrito pela página via `aio-snapshot-state.ts:73`
  → identidade de `initializeManualProgressFromSnapshots`). Nenhuma mudança de JSX/lógica além
  dos movimentos documentados.

#### 3. Gates (re-executados pelo review)

| Gate | Resultado |
| --- | --- |
| typecheck interface + raiz (turbo) | ✅ 0 erros |
| vitest (interface) | ✅ 43/43 |
| smoke dashboard-refactor (headed, --workers=1) | ✅ 11/11 |
| text-follow probe | ✅ 2/2 — drag **0 tasks**; commit 115/125ms (full/perf-only); massa 10419→0 / 0→4904; boxDx 300px |
| react-scan census | ✅ 2/2 |
| react-scan audit | ✅ 1 run — region-select:1-4 DP **1r**/~3-5ms (Tooltip 36r), select:5 **DP 0r** (só DashboardStageSection 1r), drag DP 2r (igual), route:dashboard DP 8r/~28ms, boot DP 6r/64ms, fixture 8r |

#### 4. Medição — comparação janela a janela (census mediana de 3 vs T4.1 mediana)

13 de 14 janelas comparáveis melhoraram: mode:cleaner 103 (229) · typesetter 76 (249) ·
translator 69 (140) · raw 76 (133) · proofreader 67 (93) · stitch 82 (144) · split 97 (140) ·
enhance 70 (264) · optimizer 83 (147) · organize 77 (119) · rotate-90 223 (392) · retorno
dashboard 336 (558, DP 6r/19-22ms) · images add/remove 205/183 (269/237). Única piora:
mode:watermark 162 (127, +28%) — ver Achado 2. Census region:select / region:type-10-chars /
translator:type = **0 long tasks ×3 runs**. A assinatura central reivindicada (region-select
0-1r, re-select 0r, chrome 0r nos selects de usuário) foi reproduzida pelo review.

**Aceite**: estrutura e caminhos de usuário aprovados; aplicar o fix de 1 linha do Achado 1
antes do commit e re-rodar smoke + um audit. Follow-ups (1r residual do audit,
DashboardMainLayout memoization, custo de stage-remount do retorno) permanecem T4.3+.
