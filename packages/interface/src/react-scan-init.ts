// Dev-only react-scan bootstrap. MUST stay the first import of main.tsx: the
// top-level await below blocks main.tsx's body, so scan() attaches before the
// first render. Never name this file react-scan.ts — the tsconfigs use
// baseUrl "." and the filename would shadow the npm package (TS2459). The
// dynamic import is dead-code-eliminated in production builds, so react-scan
// never reaches the prod bundle.
//
// Render events are mirrored to window.__komaReactScan for the e2e audit
// probes (apps/tauri/tests/e2e/react-scan-audit.spec.ts); normal dev sessions
// just get the outline overlay + toolbar.

interface KomaReactScanEvent {
  t: number;
  name: string | null;
  count: number;
  time: number;
  unnecessary: boolean | null;
  changes: number;
}

declare global {
  interface Window {
    __komaReactScan?: {
      mark: (label: string) => void;
      events: () => KomaReactScanEvent[];
      clear: () => void;
    };
  }
}

if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
  const { scan } = await import("react-scan");

  // Bounds the buffer so long audit sessions can't grow it unbounded; drops
  // only once full (oldest keep = boot, which is the interesting window).
  const MAX_EVENTS = 12_000;
  const events: KomaReactScanEvent[] = [];

  scan({
    enabled: true,
    log: false,
    trackUnnecessaryRenders: true,
    onRender: (_fiber, renders) => {
      if (events.length >= MAX_EVENTS) return;
      for (const render of renders) {
        events.push({
          t: performance.now(),
          name: render.componentName,
          count: render.count,
          time: render.time ?? 0,
          unnecessary: render.unnecessary,
          changes: render.changes.length,
        });
      }
    },
  });

  window.__komaReactScan = {
    mark: (label) => {
      if (events.length >= MAX_EVENTS) return;
      events.push({
        t: performance.now(),
        name: `MARK:${label}`,
        count: 0,
        time: 0,
        unnecessary: null,
        changes: 0,
      });
    },
    events: () => [...events],
    clear: () => {
      events.length = 0;
    },
  };
}

export {};
