<script lang="ts">
  import { isRunning, clearLogs } from "$lib/stores";
  import { invoke } from "@tauri-apps/api/core";
  import type { BuildResult } from "$lib/types";

  let busy = $state(false);
  let result = $state<BuildResult | null>(null);

  async function run() {
    busy = true; result = null;
    clearLogs();
    isRunning.set(true);
    try {
      result = await invoke<BuildResult>("build_msi");
    } catch (e) {
      result = { success: false, summary: String(e), log_path: "", duration_secs: 0 };
    } finally {
      busy = false; isRunning.set(false);
    }
  }
</script>

<div>
  <div class="mb-6">
    <span class="kicker">// build</span>
    <h2 class="font-display text-xl font-black uppercase tracking-tight text-paper">
      MSI (thin)
      <span class="font-accent italic text-crimson">runtime</span>
    </h2>
    <p class="mt-1 font-mono text-xs text-paper-dim">
      Gera o instalador sem o mini-backend embutido — download sob demanda.
    </p>
  </div>

  <div class="card p-5">
    <div class="flex items-center justify-between">
      <div>
        <span class="font-display text-sm font-black uppercase tracking-wide text-paper">Hardened MSI</span>
        <div class="mt-1 flex items-center gap-2">
          <span class="stamp">node</span>
          <span class="font-mono text-[10px] text-paper-dim">build-hardened-release.mjs</span>
        </div>
      </div>
      <button class="btn-primary" disabled={busy} onclick={run}>
        {busy ? "Building…" : "Gerar MSI"}
        <span class="font-mono text-xs">{busy ? "⏳" : "→"}</span>
      </button>
    </div>

    {#if result}
      <div class="mt-4 {result.success ? 'result-success' : 'result-fail'} p-3 text-xs font-mono">
        <span class="font-black">{result.success ? "✦ SUCCESS" : "✕ FAILED"}</span>
        <span class="ml-2 opacity-70">{result.summary}</span>
        {#if result.duration_secs > 0}
          <span class="ml-2 text-[10px] opacity-50">({result.duration_secs}s)</span>
        {/if}
      </div>
    {/if}
  </div>
</div>
