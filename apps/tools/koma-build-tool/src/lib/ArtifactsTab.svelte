<script lang="ts">
  import { isRunning, clearLogs } from "$lib/stores";
  import { invoke } from "@tauri-apps/api/core";
  import type { BuildResult, ProfileInfo } from "$lib/types";

  let busy = $state(false);
  let result = $state<BuildResult | null>(null);
  let profiles = $state<ProfileInfo[]>([]);
  let loaded = $state(false);

  function toggleProfile(id: string) {
    profiles = profiles.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p);
  }

  async function loadProfiles() {
    profiles = await invoke<ProfileInfo[]>("list_profiles");
    loaded = true;
  }
  $effect(() => { if (!loaded) loadProfiles(); });

  async function build() {
    busy = true; result = null;
    clearLogs();
    isRunning.set(true);
    try {
      const selected = profiles.filter((p) => p.enabled).map((p) => p.id);
      result = await invoke<BuildResult>("build_artifacts", { profiles: selected });
    } catch (e) {
      result = { success: false, summary: String(e), log_path: "", duration_secs: 0 };
    } finally {
      busy = false; isRunning.set(false);
    }
  }

  async function deploy() {
    busy = true; result = null;
    clearLogs();
    isRunning.set(true);
    try {
      result = await invoke<BuildResult>("deploy_artifacts");
    } catch (e) {
      result = { success: false, summary: String(e), log_path: "", duration_secs: 0 };
    } finally {
      busy = false; isRunning.set(false);
    }
  }
</script>

<div>
  <div class="mb-6">
    <span class="kicker">// runtime</span>
    <h2 class="font-display text-xl font-black uppercase tracking-tight text-paper">
      Profiles
      <span class="font-accent italic text-crimson">artifacts</span>
    </h2>
    <p class="mt-1 font-mono text-xs text-paper-dim">
      Hardened zips de cada acelerador + upload VPS.
    </p>
  </div>

  <div class="card p-5">
    <!-- Profile list -->
    <div class="mb-5">
      <span class="kicker mb-2 block">select</span>
      <div class="grid gap-1.5">
        {#each profiles as profile}
          <label class="flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-xs transition-colors hover:bg-white/5">
            <input type="checkbox" checked={profile.enabled} onchange={() => toggleProfile(profile.id)} />
            <span class="font-display text-sm font-black uppercase tracking-wide text-paper">
              {profile.label}
            </span>
            <span class="font-mono text-[9px] uppercase tracking-widest text-paper-dim/50">
              ({profile.id})
            </span>
          </label>
        {/each}
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-3">
      <button class="btn-primary" disabled={busy || profiles.filter((p) => p.enabled).length === 0} onclick={build}>
        {busy ? "Building…" : "Gerar Profiles"}
        <span>📦</span>
      </button>
      <button class="btn-ghost" disabled={busy} onclick={deploy}>
        {busy ? "Uploading…" : "Upload VPS"}
        <span>↑</span>
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
