<script lang="ts">
  import { progress, logs } from "$lib/stores";

  let logContainer: HTMLDivElement;
  let autoScroll = $state(true);
  let pctVal = $state(0);

  $effect(() => { pctVal = $progress; });

  $effect(() => {
    if (autoScroll && logContainer) {
      requestAnimationFrame(() => {
        logContainer.scrollTop = logContainer.scrollHeight;
      });
    }
  });
</script>

<div class="flex h-full flex-col">
  <!-- Progress bar + controls -->
  <div class="flex items-center gap-4 border-b border-white/5 px-4 py-2">
    <div class="flex-1">
      {#if pctVal > 0}
        <div class="progress-track">
          <div class="progress-fill" style="width: {pctVal > 0 ? pctVal : 5}%"></div>
        </div>
      {:else}
        <div class="h-1 bg-white/5"></div>
      {/if}
    </div>
    <span class="font-mono text-[10px] text-paper-dim/60">
      {#if pctVal > 0}{Math.round(pctVal)}%{:else}--{/if}
    </span>
    <label class="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-paper-dim/60 hover:text-paper-dim">
      <input type="checkbox" checked={autoScroll} onchange={() => autoScroll = !autoScroll} class="!h-3 !w-3" />
      scroll
    </label>
    <button
      class="font-mono text-[10px] uppercase tracking-wider text-paper-dim/60 hover:text-crimson"
      onclick={() => logs.set([])}
    >
      clear
    </button>
  </div>

  <!-- Log lines -->
  <div
    bind:this={logContainer}
    class="log-scroll flex-1 overflow-y-auto px-4 py-2 font-mono text-[11px] leading-6"
  >
    {#if $logs.length === 0}
      <p class="text-paper-dim/30">// waiting for command output …</p>
    {/if}
    {#each $logs as entry, i}
      <div class={entry.is_error ? "text-crimson" : entry.is_warn ? "text-gold" : "text-paper-dim/70"}>
        {#if entry.phase && i > 0 && $logs[i-1].phase !== entry.phase && entry.phase !== $logs[i-1]?.phase}
          <div class="kicker mt-2 mb-0.5 block">[{entry.phase}]</div>
        {/if}
        <span>{entry.message}</span>
      </div>
    {/each}
  </div>
</div>
