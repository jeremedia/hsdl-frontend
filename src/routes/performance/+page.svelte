<script lang="ts">
  // INK search-performance dashboard. Real-traffic telemetry from search_events
  // (SearchMetrics): latency percentiles + trend, the keyword/semantic/hybridize
  // phase split, zero-result rate, and top/slowest/zero-result query tables.
  import { createQuery } from "@tanstack/svelte-query";
  import { derived, writable } from "svelte/store";
  import { inkApi, type SearchPerfRange } from "$lib/services/ink-api";
  import { Activity, Timer, Gauge, SearchX, Layers } from "lucide-svelte";

  // Latency target reference line (ms). The fast numbers reading "well under
  // target" is the point — a deliberate contrast with the slow legacy HSDL.
  const TARGET_MS = 250;

  const RANGES: { key: SearchPerfRange; label: string }[] = [
    { key: "24h", label: "24h" },
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
  ];

  let range = $state<SearchPerfRange>("7d");

  // TanStack Query consumes a store, not a rune — bridge range through writable.
  const rangeStore = writable<SearchPerfRange>("7d");
  $effect(() => rangeStore.set(range));

  const perfQuery = createQuery(
    derived(rangeStore, ($r) => ({
      queryKey: ["ink", "performance", $r] as const,
      queryFn: () => inkApi.getSearchPerformance($r),
    })),
  );

  let data = $derived($perfQuery.data);
  let summary = $derived(data?.summary);
  let series = $derived(data?.latency_series ?? []);

  // ---- formatters ----
  const ms = (v: number | null | undefined) =>
    v == null ? "—" : `${Math.round(v).toLocaleString()} ms`;
  const num = (v: number | null | undefined) =>
    v == null ? "—" : Math.round(v).toLocaleString();
  const pct = (v: number | null | undefined) =>
    v == null ? "—" : `${(v * 100).toFixed(1)}%`;
  const when = (iso: string) => new Date(iso).toLocaleString();

  // ---- latency trend chart (hand-rolled SVG; no charting lib in INK) ----
  let chartMax = $derived(
    Math.max(
      TARGET_MS,
      ...series.flatMap((b) => [b.p50_ms ?? 0, b.p95_ms ?? 0]),
      1,
    ),
  );
  function linePoints(key: "p50_ms" | "p95_ms"): string {
    const n = series.length;
    if (n === 0) return "";
    return series
      .map((b, i) => {
        const x = n === 1 ? 50 : (i / (n - 1)) * 100;
        const y = 49 - ((b[key] ?? 0) / chartMax) * 47;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }
  let targetY = $derived(49 - (TARGET_MS / chartMax) * 47);

  // ---- phase breakdown bars ----
  let phaseMax = $derived(
    Math.max(
      summary?.avg_keyword_ms ?? 0,
      summary?.avg_semantic_ms ?? 0,
      summary?.avg_hybridize_ms ?? 0,
      1,
    ),
  );
  let phases = $derived([
    { label: "Keyword retrieval", value: summary?.avg_keyword_ms, color: "bg-blue-500" },
    { label: "Semantic retrieval", value: summary?.avg_semantic_ms, color: "bg-violet-500" },
    { label: "Hybridize (fusion + boosts + collapse)", value: summary?.avg_hybridize_ms, color: "bg-amber-500" },
  ]);

  let modeMax = $derived(
    Math.max(1, ...(data?.mode_breakdown ?? []).map((m) => m.count)),
  );
</script>

<div class="p-4 sm:p-6 max-w-6xl mx-auto">
  <!-- Header + range selector -->
  <div class="flex items-center justify-between flex-wrap gap-3 mb-5">
    <div class="flex items-center gap-2">
      <Activity size={22} class="text-interactive" />
      <h1 class="text-xl font-bold text-text-theme-primary">Search Performance</h1>
    </div>
    <div class="flex items-center gap-1 bg-surface-secondary rounded-lg p-1">
      {#each RANGES as r}
        <button
          onclick={() => (range = r.key)}
          class="text-xs px-3 py-1.5 rounded-md transition-colors {range === r.key
            ? 'bg-surface-elevated text-text-theme-primary shadow-sm font-medium'
            : 'text-text-theme-tertiary hover:text-text-theme-secondary'}"
        >
          {r.label}
        </button>
      {/each}
    </div>
  </div>

  {#if $perfQuery.isPending}
    <div class="space-y-4">
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {#each Array(6) as _}
          <div class="skeleton h-20 rounded-lg"></div>
        {/each}
      </div>
      <div class="skeleton h-56 rounded-lg"></div>
    </div>
  {:else if $perfQuery.isError}
    <div class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-red-500 p-4 text-sm text-text-theme-secondary">
      Couldn't load performance data. {$perfQuery.error?.message ?? ""}
    </div>
  {:else if summary}
    <!-- Headline tiles -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
      <div class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-slate-400 p-3">
        <div class="text-xs font-medium text-text-theme-secondary mb-1">Searches</div>
        <div class="text-2xl font-bold text-text-theme-primary">{num(summary.total_searches)}</div>
        <div class="text-xs text-text-theme-tertiary mt-1">{num(summary.query_searches)} with a query</div>
      </div>
      <div class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-green-500 p-3">
        <div class="text-xs font-medium text-text-theme-secondary mb-1">p50 latency</div>
        <div class="text-2xl font-bold text-green-600 dark:text-green-400">{ms(summary.p50_ms)}</div>
      </div>
      <div class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-emerald-500 p-3">
        <div class="text-xs font-medium text-text-theme-secondary mb-1">p95 latency</div>
        <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{ms(summary.p95_ms)}</div>
      </div>
      <div class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-teal-500 p-3">
        <div class="text-xs font-medium text-text-theme-secondary mb-1">p99 latency</div>
        <div class="text-2xl font-bold text-teal-600 dark:text-teal-400">{ms(summary.p99_ms)}</div>
      </div>
      <div class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-amber-500 p-3">
        <div class="text-xs font-medium text-text-theme-secondary mb-1">Zero-result rate</div>
        <div class="text-2xl font-bold text-amber-600 dark:text-amber-400">{pct(summary.zero_result_rate)}</div>
        <div class="text-xs text-text-theme-tertiary mt-1">{num(summary.zero_result_count)} searches</div>
      </div>
      <div class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-blue-500 p-3">
        <div class="text-xs font-medium text-text-theme-secondary mb-1">Avg results</div>
        <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{num(summary.avg_results)}</div>
      </div>
    </div>

    <!-- Latency trend + phase breakdown -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
      <div class="bg-surface-elevated rounded-lg border border-theme p-4 lg:col-span-2">
        <div class="flex items-center gap-2 mb-3">
          <Timer size={15} class="text-text-theme-tertiary" />
          <h2 class="text-sm font-semibold text-text-theme-primary">Server latency trend</h2>
          <span class="text-xs text-text-theme-tertiary ml-auto">
            <span class="inline-block w-2.5 h-0.5 align-middle bg-green-500"></span> p50
            <span class="inline-block w-2.5 h-0.5 align-middle bg-emerald-600 ml-2"></span> p95
            <span class="ml-2">target {TARGET_MS}ms</span>
          </span>
        </div>
        {#if series.length}
          <svg viewBox="0 0 100 50" class="w-full h-48" preserveAspectRatio="none">
            {#each [0.25, 0.5, 0.75] as ratio}
              <line x1="0" y1={49 - ratio * 47} x2="100" y2={49 - ratio * 47}
                stroke="currentColor" stroke-width="0.15" class="text-text-theme-tertiary opacity-20" />
            {/each}
            <!-- target reference line -->
            <line x1="0" y1={targetY} x2="100" y2={targetY}
              stroke="#f59e0b" stroke-width="0.3" stroke-dasharray="1.5 1.5" opacity="0.6" />
            <polyline points={linePoints("p95_ms")} fill="none" stroke="#059669"
              stroke-width="0.8" stroke-linejoin="round" stroke-linecap="round" />
            <polyline points={linePoints("p50_ms")} fill="none" stroke="#22c55e"
              stroke-width="0.8" stroke-linejoin="round" stroke-linecap="round" />
          </svg>
          <div class="flex justify-between text-[10px] text-text-theme-tertiary mt-1">
            <span>{when(series[0].bucket)}</span>
            <span>{when(series[series.length - 1].bucket)}</span>
          </div>
        {:else}
          <div class="h-48 flex items-center justify-center text-sm text-text-theme-tertiary">
            No searches recorded in this window yet.
          </div>
        {/if}
      </div>

      <div class="bg-surface-elevated rounded-lg border border-theme p-4">
        <div class="flex items-center gap-2 mb-3">
          <Layers size={15} class="text-text-theme-tertiary" />
          <h2 class="text-sm font-semibold text-text-theme-primary">Avg phase split (hybrid)</h2>
        </div>
        <div class="space-y-3">
          {#each phases as p}
            <div>
              <div class="flex justify-between text-xs mb-1">
                <span class="text-text-theme-secondary">{p.label}</span>
                <span class="text-text-theme-primary font-medium tabular-nums">{ms(p.value)}</span>
              </div>
              <div class="h-2 rounded-full bg-surface-secondary overflow-hidden">
                <div class="h-full {p.color} rounded-full"
                  style="width: {Math.max(2, ((p.value ?? 0) / phaseMax) * 100)}%"></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Mode breakdown -->
    <div class="bg-surface-elevated rounded-lg border border-theme p-4 mb-5">
      <div class="flex items-center gap-2 mb-3">
        <Gauge size={15} class="text-text-theme-tertiary" />
        <h2 class="text-sm font-semibold text-text-theme-primary">By search mode</h2>
      </div>
      <div class="space-y-2">
        {#each data?.mode_breakdown ?? [] as m}
          <div class="flex items-center gap-3">
            <span class="text-xs text-text-theme-secondary w-20 shrink-0">{m.mode}</span>
            <div class="flex-1 h-2 rounded-full bg-surface-secondary overflow-hidden">
              <div class="h-full bg-interactive rounded-full" style="width: {(m.count / modeMax) * 100}%"></div>
            </div>
            <span class="text-xs text-text-theme-primary tabular-nums w-14 text-right">{num(m.count)}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Query tables -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Slowest -->
      <div class="bg-surface-elevated rounded-lg border border-theme overflow-hidden">
        <div class="px-4 py-2.5 border-b border-theme flex items-center gap-2">
          <Timer size={14} class="text-text-theme-tertiary" />
          <h2 class="text-sm font-semibold text-text-theme-primary">Slowest searches</h2>
        </div>
        {#if (data?.slowest ?? []).length}
          <table class="w-full text-xs">
            <thead class="text-text-theme-tertiary border-b border-theme">
              <tr><th class="text-left font-medium px-4 py-2">Query</th><th class="text-left font-medium px-2 py-2">Mode</th><th class="text-right font-medium px-4 py-2">Time</th></tr>
            </thead>
            <tbody>
              {#each data?.slowest ?? [] as row}
                <tr class="border-b border-theme/50 last:border-0">
                  <td class="px-4 py-2 text-text-theme-primary truncate max-w-[16rem]">{row.query ?? "(browse)"}</td>
                  <td class="px-2 py-2 text-text-theme-tertiary">{row.mode}</td>
                  <td class="px-4 py-2 text-right tabular-nums text-text-theme-secondary">{ms(row.elapsed_ms)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="p-4 text-sm text-text-theme-tertiary">No data yet.</div>
        {/if}
      </div>

      <!-- Top queries -->
      <div class="bg-surface-elevated rounded-lg border border-theme overflow-hidden">
        <div class="px-4 py-2.5 border-b border-theme flex items-center gap-2">
          <Activity size={14} class="text-text-theme-tertiary" />
          <h2 class="text-sm font-semibold text-text-theme-primary">Top queries</h2>
        </div>
        {#if (data?.top_queries ?? []).length}
          <table class="w-full text-xs">
            <thead class="text-text-theme-tertiary border-b border-theme">
              <tr><th class="text-left font-medium px-4 py-2">Query</th><th class="text-right font-medium px-2 py-2">Count</th><th class="text-right font-medium px-4 py-2">Avg</th></tr>
            </thead>
            <tbody>
              {#each data?.top_queries ?? [] as row}
                <tr class="border-b border-theme/50 last:border-0">
                  <td class="px-4 py-2 text-text-theme-primary truncate max-w-[16rem]">{row.query}</td>
                  <td class="px-2 py-2 text-right tabular-nums text-text-theme-secondary">{num(row.count)}</td>
                  <td class="px-4 py-2 text-right tabular-nums text-text-theme-secondary">{ms(row.avg_ms)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="p-4 text-sm text-text-theme-tertiary">No data yet.</div>
        {/if}
      </div>

      <!-- Zero-result queries -->
      <div class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-amber-500 overflow-hidden lg:col-span-2">
        <div class="px-4 py-2.5 border-b border-theme flex items-center gap-2">
          <SearchX size={14} class="text-amber-500" />
          <h2 class="text-sm font-semibold text-text-theme-primary">Zero-result queries</h2>
          <span class="text-xs text-text-theme-tertiary ml-2">searches that returned nothing — relevance gaps to fix</span>
        </div>
        {#if (data?.zero_result_queries ?? []).length}
          <table class="w-full text-xs">
            <thead class="text-text-theme-tertiary border-b border-theme">
              <tr><th class="text-left font-medium px-4 py-2">Query</th><th class="text-right font-medium px-2 py-2">Count</th><th class="text-right font-medium px-4 py-2">Last seen</th></tr>
            </thead>
            <tbody>
              {#each data?.zero_result_queries ?? [] as row}
                <tr class="border-b border-theme/50 last:border-0">
                  <td class="px-4 py-2 text-text-theme-primary truncate max-w-[20rem]">{row.query}</td>
                  <td class="px-2 py-2 text-right tabular-nums text-text-theme-secondary">{num(row.count)}</td>
                  <td class="px-4 py-2 text-right text-text-theme-tertiary">{when(row.last_seen)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="p-4 text-sm text-text-theme-tertiary">No zero-result searches in this window. 🎉</div>
        {/if}
      </div>
    </div>
  {/if}
</div>
