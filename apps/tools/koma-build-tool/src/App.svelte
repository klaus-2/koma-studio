<script lang="ts">
  import { isRunning, progressPhase, addLog } from "$lib/stores";
  import { listen } from "@tauri-apps/api/event";
  import type { ProgressEvent, TabId } from "$lib/types";
  import BuildTab from "./lib/BuildTab.svelte";
  import UpdateTab from "./lib/UpdateTab.svelte";
  import ArtifactsTab from "./lib/ArtifactsTab.svelte";
  import LandingTab from "./lib/LandingTab.svelte";
  import LogPanel from "./lib/LogPanel.svelte";

  let running = $state(false);
  let phaseText = $state("");

  $effect(() => {
    const unlisten = listen<ProgressEvent>("build-progress", (e) => addLog(e.payload));
    return () => { unlisten.then((f) => f()); };
  });
  $effect(() => { running = $isRunning; });
  $effect(() => { phaseText = $progressPhase; });

  const items = [
    { id: "build" as TabId, icon: "01", label: "Build MSI" },
    { id: "update" as TabId, icon: "02", label: "Update" },
    { id: "artifacts" as TabId, icon: "03", label: "Artifacts" },
    { id: "landing" as TabId, icon: "04", label: "Landing" },
  ];

  let currentTab = $state<TabId>("build");
</script>

<div class="flex h-screen flex-col">
  <!-- HEADER -->
  <header class="glass flex items-center justify-between border-b border-white/5 px-6 py-3">
    <div class="flex items-center gap-4">
      <div class="stamp">KBT</div>
      <div>
        <h1 class="font-display text-sm font-black uppercase tracking-tight text-paper">
          KOMA Build Tool
        </h1>
        <p class="font-mono text-[10px] uppercase tracking-widest text-paper-dim">
          v1.0.0 // editorial manga noir
        </p>
      </div>
    </div>
    <div class="flex items-center gap-4">
      {#if running}
        <div class="stamp">
          <span class="inline-block h-2 w-2 animate-blink bg-crimson"></span>
          Running
        </div>
      {/if}
      {#if phaseText}
        <span class="font-mono text-[10px] uppercase tracking-widest text-paper-dim">
          {phaseText}
        </span>
      {/if}
    </div>
  </header>

  <!-- BODY -->
  <div class="flex flex-1 overflow-hidden">
    <!-- SIDEBAR -->
    <nav class="flex w-44 flex-col gap-1 border-r border-white/5 bg-ink-2 p-2">
      {#each items as item}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button
          class="panel-cut-sm flex items-center gap-3 px-3 py-3 text-left text-xs uppercase tracking-widest transition-all duration-200 {currentTab !== item.id ? 'text-paper-dim hover:bg-white/5' : ''}"
          class:bg-crimson={currentTab === item.id}
          class:text-ink={currentTab === item.id}
          class:font-black={currentTab === item.id}
          onclick={() => currentTab = item.id}
        >
          <span class="font-mono text-[10px] opacity-40">{item.icon}</span>
          <span class="font-display">{item.label}</span>
        </button>
      {/each}
      <div class="mt-auto border-t border-white/5 pt-3">
        <p class="px-3 font-mono text-[9px] uppercase tracking-widest text-paper-dim/40">
          // KOMA Studio
        </p>
      </div>
    </nav>

    <!-- CONTENT -->
    <main class="flex flex-1 flex-col overflow-hidden bg-ink">
      <div class="flex-1 overflow-y-auto p-6">
        {#if currentTab === "build"}
          <BuildTab />
        {:else if currentTab === "update"}
          <UpdateTab />
        {:else if currentTab === "artifacts"}
          <ArtifactsTab />
        {:else if currentTab === "landing"}
          <LandingTab />
        {/if}
      </div>
      <div class="h-48 border-t border-white/5 bg-ink-2">
        <LogPanel />
      </div>
    </main>
  </div>
</div>
