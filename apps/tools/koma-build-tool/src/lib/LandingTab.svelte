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
      result = await invoke<BuildResult>("deploy_landing");
    } catch (e) {
      result = { success: false, summary: String(e), log_path: "", duration_secs: 0 };
    } finally {
      busy = false; isRunning.set(false);
    }
  }
</script>

<div>
  <div class="mb-6">
    <span class="kicker">// web</span>
    <h2 class="font-display text-xl font-black uppercase tracking-tight text-paper">
      Landing
      <span class="font-accent italic text-crimson">deploy</span>
    </h2>
    <p class="mt-1 font-mono text-xs text-paper-dim">
      Build + replace completo em /var/www/koma-studio.site.
    </p>
  </div>

  <div class="card p-5">
    <div class="flex items-center justify-between">
      <div>
        <span class="font-display text-sm font-black uppercase tracking-wide text-paper">Landing Page</span>
        <div class="mt-1 flex items-center gap-2">
          <span class="stamp">next.js</span>
          <span class="font-mono text-[10px] text-paper-dim">bun run build -> tar -> scp -> ssh replace</span>
        </div>
      </div>
      <button class="btn-primary" disabled={busy} onclick={run}>
        {busy ? "Deploying…" : "Build + Deploy"}
        <span>{busy ? "⏳" : "🌐"}</span>
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
