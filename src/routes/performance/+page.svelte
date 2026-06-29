<script lang="ts">
  // INK search-performance dashboard. Real-traffic telemetry from search_events
  // (SearchMetrics): latency percentiles + trend, the keyword/semantic/hybridize
  // phase split, zero-result rate, and top/slowest/zero-result query tables.
  import { createQuery } from "@tanstack/svelte-query";
  import { derived, writable } from "svelte/store";
  import { inkApi, type SearchPerfRange } from "$lib/services/ink-api";
  import { Activity, Timer, Gauge, SearchX, Layers, X } from "lucide-svelte";

  // Latency target reference line (ms). The fast numbers reading "well under
  // target" is the point — a deliberate contrast with the slow legacy HSDL.
  const TARGET_MS = 250;

  const RANGES: { key: SearchPerfRange; label: string }[] = [
    { key: "24h", label: "24h" },
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
  ];

  let range = $state<SearchPerfRange>("7d");
  let showHelp = $state(false);

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

<svelte:window onkeydown={(e) => { if (e.key === "Escape") showHelp = false; }} />

<div class="p-4 sm:p-6 max-w-6xl mx-auto">
  <!-- Header + range selector -->
  <div class="flex items-center justify-between flex-wrap gap-3 mb-5">
    <div class="flex items-center gap-2">
      <Activity size={22} class="text-interactive" />
      <h1 class="text-xl font-bold text-text-theme-primary">Search Performance</h1>
      <button
        onclick={() => (showHelp = true)}
        aria-label="How to read this page"
        title="How to read this page"
        class="w-5 h-5 inline-flex items-center justify-center rounded-full border border-theme text-text-theme-tertiary hover:text-text-theme-primary hover:border-interactive text-xs font-semibold leading-none transition-colors"
      >
        ?
      </button>
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
        <div class="text-2xl font-bold text-green-700 dark:text-green-400">{ms(summary.p50_ms)}</div>
      </div>
      <div class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-emerald-500 p-3">
        <div class="text-xs font-medium text-text-theme-secondary mb-1">p95 latency</div>
        <div class="text-2xl font-bold text-sky-700 dark:text-sky-400">{ms(summary.p95_ms)}</div>
      </div>
      <div class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-teal-500 p-3">
        <div class="text-xs font-medium text-text-theme-secondary mb-1">p99 latency</div>
        <div class="text-2xl font-bold text-teal-700 dark:text-teal-400">{ms(summary.p99_ms)}</div>
      </div>
      <div class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-amber-500 p-3">
        <div class="text-xs font-medium text-text-theme-secondary mb-1">Zero-result rate</div>
        <div class="text-2xl font-bold text-amber-700 dark:text-amber-400">{pct(summary.zero_result_rate)}</div>
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
            <span class="inline-block w-2.5 h-0.5 align-middle" style="background: var(--chart-p50)"></span> p50
            <span class="inline-block w-2.5 h-0.5 align-middle ml-2" style="background: var(--chart-p95)"></span> p95
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
              style="stroke: var(--chart-target)" stroke-width="0.3" stroke-dasharray="1.5 1.5" opacity="0.6" />
            <polyline points={linePoints("p95_ms")} fill="none" style="stroke: var(--chart-p95)"
              stroke-width="0.8" stroke-linejoin="round" stroke-linecap="round" />
            <polyline points={linePoints("p50_ms")} fill="none" style="stroke: var(--chart-p50)"
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

  <!-- How-to-read overlay -->
  {#if showHelp}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onclick={() => (showHelp = false)}
      onkeydown={() => {}}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="bg-surface-elevated rounded-lg shadow-xl border border-theme max-w-lg w-full max-h-[80vh] overflow-y-auto p-5"
        onclick={(e) => e.stopPropagation()}
        onkeydown={() => {}}
      >
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-text-theme-primary">How to read this page</h2>
          <button onclick={() => (showHelp = false)} class="text-text-theme-tertiary hover:text-text-theme-primary" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p class="text-xs text-text-theme-secondary mb-4">
          Every search run on HSDL is recorded. This page summarizes real traffic
          for the selected window (24 hours, 7 days, or 30 days) — there's no
          sampling, it's every search.
        </p>

        <div class="space-y-3 text-xs leading-relaxed">
          <div>
            <div class="font-semibold text-text-theme-primary mb-0.5">Latency — p50 / p95 / p99</div>
            <p class="text-text-theme-secondary">
              How long the <em>server</em> took to run the search, in milliseconds
              (lower is better). These are <strong>percentiles</strong>, not averages:
              <strong>p50</strong> is the median — half of searches finished faster.
              <strong>p95</strong> means 95% finished faster (the occasional slow one
              most users still hit sometimes). <strong>p99</strong> is the worst 1%.
              The dashed line on the trend chart is our {TARGET_MS}ms target.
            </p>
          </div>
          <div>
            <div class="font-semibold text-text-theme-primary mb-0.5">Zero-result rate</div>
            <p class="text-text-theme-secondary">
              Share of searches (that had a query) returning <strong>no results</strong> —
              the clearest signal of a relevance gap. The <em>Zero-result queries</em>
              table lists exactly what people searched that found nothing, so we can fix it.
            </p>
          </div>
          <div>
            <div class="font-semibold text-text-theme-primary mb-0.5">Avg results</div>
            <p class="text-text-theme-secondary">Average number of matching documents per search.</p>
          </div>
          <div>
            <div class="font-semibold text-text-theme-primary mb-0.5">Phase split — keyword / semantic / hybridize</div>
            <p class="text-text-theme-secondary">
              A hybrid search runs two retrievals in parallel —
              <strong>keyword</strong> (exact word matches) and <strong>semantic</strong>
              (meaning, via embeddings) — then <strong>hybridizes</strong>: fuses the two
              lists, applies ranking boosts, and collapses duplicate editions. The bars
              show where the server spends its time.
            </p>
          </div>
          <div>
            <div class="font-semibold text-text-theme-primary mb-0.5">By search mode</div>
            <p class="text-text-theme-secondary">
              <strong>Hybrid</strong> (the default), <strong>Keyword</strong> only,
              <strong>Semantic</strong> only, or <strong>Browse</strong> (no query — just
              filters or the full collection).
            </p>
          </div>
          <div>
            <div class="font-semibold text-text-theme-primary mb-0.5">The tables</div>
            <p class="text-text-theme-secondary">
              <strong>Slowest searches</strong> are optimization targets.
              <strong>Top queries</strong> are what people look for most.
              <strong>Zero-result queries</strong> are the relevance gaps to close.
            </p>
          </div>
          <p class="text-text-theme-tertiary border-t border-theme pt-3">
            Note: latency here is server compute time only — it excludes the network
            and browser time the user also waits, so what they experience is a bit
            higher.
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>
