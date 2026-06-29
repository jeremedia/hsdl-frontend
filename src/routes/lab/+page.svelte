<script lang="ts">
  import {
    createQuery,
    createMutation,
    useQueryClient,
  } from "@tanstack/svelte-query";
  import { derived, writable } from "svelte/store";
  import { inkApi } from "$lib/services/ink-api";
  import type {
    SearchConfigDetail,
    PreviewResponse,
  } from "$lib/services/ink-api";
  import { Check } from "lucide-svelte";

  import ConfigSelector from "$lib/components/lab/ConfigSelector.svelte";
  import AccordionSection from "$lib/components/lab/AccordionSection.svelte";
  import ParameterSlider from "$lib/components/lab/ParameterSlider.svelte";
  import ParameterToggle from "$lib/components/lab/ParameterToggle.svelte";
  import SynonymEditor from "$lib/components/lab/SynonymEditor.svelte";
  import ExcludedTermEditor from "$lib/components/lab/ExcludedTermEditor.svelte";
  import PreviewPanel from "$lib/components/lab/PreviewPanel.svelte";

  const queryClient = useQueryClient();
  type PublisherTier = { weight: number; publishers: string[] };
  type PublisherTiers = Record<string, PublisherTier>;

  // --- Config list query ---
  const configsQuery = createQuery({
    queryKey: ["ink", "search_configs"],
    queryFn: () => inkApi.getSearchConfigs(),
  });

  // --- Selected config ---
  let selectedId = $state<string | null>(null);

  $effect(() => {
    if (!selectedId && $configsQuery.data?.length) {
      selectedId = $configsQuery.data[0].id;
    }
  });

  // Detail query (TanStack uses stores, not runes -- must wrap in derived)
  const selectedIdStore = writable<string | null>(null);
  $effect(() => {
    selectedIdStore.set(selectedId);
  });

  const detailQuery = createQuery(
    derived(selectedIdStore, ($id) => ({
      queryKey: ["ink", "search_config", $id] as const,
      queryFn: () =>
        $id ? inkApi.getSearchConfig($id) : Promise.reject("no id"),
      enabled: !!$id,
    })),
  );

  let config = $derived($detailQuery.data);

  // --- Dirty state ---
  let dirtyHybrid = $state<Record<string, unknown>>({});
  let dirtySynonyms = $state<Record<string, string[]> | null>(null);
  let dirtyExcluded = $state<string[] | null>(null);
  let publisherTierInputs = $state<Record<string, string>>({});

  let isDirty = $derived(
    Object.keys(dirtyHybrid).length > 0 ||
      dirtySynonyms !== null ||
      dirtyExcluded !== null,
  );

  function hp(
    key: keyof SearchConfigDetail["hybrid_params"],
  ): number | boolean | string | undefined {
    if (key in dirtyHybrid) return dirtyHybrid[key] as number | boolean | string;
    return config?.hybrid_params?.[key] as number | boolean | string | undefined;
  }

  function currentSynonyms(): Record<string, string[]> {
    return dirtySynonyms ?? config?.synonyms ?? {};
  }

  function currentExcluded(): string[] {
    return dirtyExcluded ?? config?.excluded_terms ?? [];
  }

  function currentPublisherTiers(): PublisherTiers {
    return (
      (dirtyHybrid.publisher_authority_tiers as PublisherTiers | undefined) ??
      config?.hybrid_params?.publisher_authority_tiers ??
      {}
    );
  }

  function publisherTierEntries(): Array<[string, PublisherTier]> {
    return Object.entries(currentPublisherTiers()).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  }

  function clonePublisherTiers(): PublisherTiers {
    const tiers: PublisherTiers = {};
    for (const [key, tier] of Object.entries(currentPublisherTiers())) {
      tiers[key] = {
        weight: Number(tier.weight) || 0,
        publishers: [...(tier.publishers ?? [])],
      };
    }
    return tiers;
  }

  function setPublisherTiers(tiers: PublisherTiers) {
    dirtyHybrid = { ...dirtyHybrid, publisher_authority_tiers: tiers };
  }

  function formatTierLabel(key: string): string {
    return key
      .replace(/^tier_/, "Tier ")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function updatePublisherTierWeight(key: string, weight: number) {
    const tiers = clonePublisherTiers();
    if (!tiers[key]) return;
    tiers[key] = { ...tiers[key], weight };
    setPublisherTiers(tiers);
  }

  function addPublisherToTier(key: string) {
    const name = (publisherTierInputs[key] ?? "").trim();
    if (!name) return;
    const tiers = clonePublisherTiers();
    const tier = tiers[key] ?? { weight: 0, publishers: [] };
    if (
      !tier.publishers.some(
        (publisher) => publisher.toLowerCase() === name.toLowerCase(),
      )
    ) {
      tier.publishers = [...tier.publishers, name].sort((a, b) =>
        a.localeCompare(b),
      );
    }
    tiers[key] = tier;
    setPublisherTiers(tiers);
    publisherTierInputs = { ...publisherTierInputs, [key]: "" };
  }

  function removePublisherFromTier(key: string, publisher: string) {
    const tiers = clonePublisherTiers();
    if (!tiers[key]) return;
    tiers[key] = {
      ...tiers[key],
      publishers: tiers[key].publishers.filter((name) => name !== publisher),
    };
    setPublisherTiers(tiers);
  }

  function addPublisherTier() {
    const tiers = clonePublisherTiers();
    let index = 1;
    while (`tier_${index}` in tiers) index += 1;
    tiers[`tier_${index}`] = { weight: 0.25, publishers: [] };
    setPublisherTiers(tiers);
  }

  function removePublisherTier(key: string) {
    const tiers = clonePublisherTiers();
    delete tiers[key];
    setPublisherTiers(tiers);
    const { [key]: _removed, ...remainingInputs } = publisherTierInputs;
    publisherTierInputs = remainingInputs;
  }

  function clearDirty() {
    dirtyHybrid = {};
    dirtySynonyms = null;
    dirtyExcluded = null;
    publisherTierInputs = {};
  }

  function selectConfig(id: string) {
    if (id !== selectedId) {
      clearDirty();
      selectedId = id;
    }
  }

  let recencyActive = $derived((hp("recency_boost_weight") as number) > 0);
  let synCount = $derived(Object.keys(currentSynonyms()).length);
  let excludedCount = $derived(currentExcluded().length);

  // --- Mutations ---
  const saveMutation = createMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      const data: Record<string, unknown> = {};
      if (Object.keys(dirtyHybrid).length > 0) {
        data.hybrid_params = {
          ...(config?.hybrid_params || {}),
          ...dirtyHybrid,
        };
      }
      if (dirtySynonyms !== null) data.synonyms = dirtySynonyms;
      if (dirtyExcluded !== null) data.excluded_terms = dirtyExcluded;
      return inkApi.updateSearchConfig(
        selectedId,
        data as Partial<SearchConfigDetail>,
      );
    },
    onSuccess: () => {
      clearDirty();
      queryClient.invalidateQueries({
        queryKey: ["ink", "search_config", selectedId],
      });
      queryClient.invalidateQueries({ queryKey: ["ink", "search_configs"] });
      showSaveToast("Configuration saved", "success");
    },
    onError: (err: Error) => {
      showSaveToast(`Save failed: ${err.message}`, "error");
    },
  });

  const activateMutation = createMutation({
    mutationFn: (id: string) => inkApi.activateSearchConfig(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ink", "search_configs"] });
      queryClient.invalidateQueries({ queryKey: ["ink", "search_config"] });
    },
  });

  const deleteMutation = createMutation({
    mutationFn: (id: string) => inkApi.deleteSearchConfig(id),
    onSuccess: () => {
      selectedId = null;
      queryClient.invalidateQueries({ queryKey: ["ink", "search_configs"] });
    },
  });

  async function handleCreate(name: string) {
    try {
      const result = await inkApi.createSearchConfig({ name });
      selectedId = result.id;
      queryClient.invalidateQueries({ queryKey: ["ink", "search_configs"] });
    } catch {
      // handled by UI
    }
  }

  async function handleClone(sourceId: string, name: string) {
    try {
      const result = await inkApi.cloneSearchConfig(sourceId, { name });
      selectedId = result.id;
      queryClient.invalidateQueries({ queryKey: ["ink", "search_configs"] });
    } catch {
      // handled by UI
    }
  }

  async function handleRename(id: string, name: string) {
    try {
      await inkApi.updateSearchConfig(id, {
        name,
      } as Partial<SearchConfigDetail>);
      queryClient.invalidateQueries({ queryKey: ["ink", "search_configs"] });
      queryClient.invalidateQueries({ queryKey: ["ink", "search_config", id] });
    } catch {
      showSaveToast("Rename failed", "error");
    }
  }

  // --- Preview ---
  const STORAGE_KEY = "ink-lab-preview-query";
  let previewQuery = $state(
    typeof localStorage !== "undefined"
      ? (localStorage.getItem(STORAGE_KEY) ?? "")
      : "",
  );

  // Persist query to localStorage
  $effect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, previewQuery);
    }
  });
  let activePreview = $state<PreviewResponse | null>(null);
  let experimentalPreview = $state<PreviewResponse | null>(null);
  let previewing = $state(false);
  let previewError = $state<string | null>(null);
  let autoPreviewPending = $state(false);
  let previewGeneration = 0;

  async function runPreview() {
    if (!previewQuery.trim()) return;
    const gen = ++previewGeneration;
    previewing = true;
    previewError = null;
    try {
      // Build config override for experimental call only
      const configOverride: Record<string, unknown> = {};
      if (Object.keys(dirtyHybrid).length > 0) {
        configOverride.hybrid_params = {
          ...(config?.hybrid_params || {}),
          ...dirtyHybrid,
        };
      }
      if (dirtySynonyms !== null) configOverride.synonyms = dirtySynonyms;
      if (dirtyExcluded !== null) configOverride.excluded_terms = dirtyExcluded;

      const [active, experimental] = await Promise.all([
        // Active baseline: NO overrides
        inkApi.previewSearch({ query: previewQuery }),
        // Experimental: selected config + dirty overrides
        inkApi.previewSearch({
          query: previewQuery,
          config_id: selectedId || undefined,
          config:
            Object.keys(configOverride).length > 0
              ? (configOverride as Partial<SearchConfigDetail>)
              : undefined,
        }),
      ]);
      if (gen !== previewGeneration) return; // discard stale response
      activePreview = active;
      experimentalPreview = experimental;
    } catch (e: unknown) {
      if (gen !== previewGeneration) return;
      const msg = e instanceof Error ? e.message : String(e);
      previewError = `Preview failed: ${msg}. Try again.`;
      activePreview = null;
      experimentalPreview = null;
    } finally {
      if (gen === previewGeneration) previewing = false;
    }
  }

  // Run preview on load if a saved query exists and config is ready
  let initialPreviewDone = false;
  $effect(() => {
    if (!initialPreviewDone && config && previewQuery.trim()) {
      initialPreviewDone = true;
      runPreview();
    }
  });

  // Auto-preview debounce
  let dirtyFingerprint = $derived(
    JSON.stringify({ h: dirtyHybrid, s: dirtySynonyms, e: dirtyExcluded }),
  );

  $effect(() => {
    const _fp = dirtyFingerprint;
    const _q = previewQuery;
    if (!isDirty || !_q.trim()) {
      autoPreviewPending = false;
      return;
    }
    autoPreviewPending = true;
    const timer = setTimeout(() => {
      autoPreviewPending = false;
      runPreview();
    }, 500);
    return () => {
      clearTimeout(timer);
      autoPreviewPending = false;
    };
  });

  // --- Toast ---
  let saveToastMessage = $state("");
  let saveToastType = $state<"success" | "error">("success");
  let saveToastVisible = $state(false);
  let saveToastTimer: ReturnType<typeof setTimeout> | null = null;

  function showSaveToast(message: string, type: "success" | "error") {
    if (saveToastTimer) clearTimeout(saveToastTimer);
    saveToastMessage = message;
    saveToastType = type;
    saveToastVisible = true;
    saveToastTimer = setTimeout(() => {
      saveToastVisible = false;
    }, 3000);
  }

  // --- Keyboard shortcuts ---
  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      if (isDirty && !$saveMutation.isPending && !config?.locked)
        $saveMutation.mutate();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runPreview();
    }
  }

  // --- Synonym/Excluded callbacks ---
  function handleAddSynonym(term: string, expansions: string[]) {
    const syns = { ...currentSynonyms() };
    syns[term.toLowerCase()] = expansions;
    dirtySynonyms = syns;
  }

  function handleRemoveSynonym(term: string) {
    const syns = { ...currentSynonyms() };
    delete syns[term];
    dirtySynonyms = syns;
  }

  function handleAddExcluded(term: string) {
    dirtyExcluded = [...currentExcluded(), term];
  }

  function handleRemoveExcluded(term: string) {
    dirtyExcluded = currentExcluded().filter((t) => t !== term);
  }
</script>

<svelte:head>
  <title>Search Lab | INK</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<!-- Header -->
<div class="flex items-center justify-between mb-3">
  <div>
    <h1 class="text-lg font-bold text-text-theme-primary">Search Lab</h1>
    <p class="text-[11px] text-text-theme-tertiary mt-0.5 leading-snug">
      Tune ranking, synonyms, and behavior. Changes go live when you activate a
      config.
    </p>
  </div>
  <div class="flex gap-1.5">
    {#if isDirty && !config?.locked}
      <button
        onclick={() => clearDirty()}
        class="btn btn-outline text-xs py-1 px-2.5">Revert</button
      >
      <button
        onclick={() => $saveMutation.mutate()}
        disabled={$saveMutation.isPending}
        class="btn btn-primary text-xs py-1 px-2.5"
      >
        {$saveMutation.isPending ? "Saving..." : "Save"}
      </button>
    {/if}
  </div>
</div>

<!-- Two-column layout -->
<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <!-- LEFT: Parameters -->
  <div class="space-y-3">
    <ConfigSelector
      configs={$configsQuery.data}
      {selectedId}
      loading={$configsQuery.isPending}
      error={$configsQuery.isError ? $configsQuery.error.message : null}
      onSelect={selectConfig}
      onClone={handleClone}
      onCreate={handleCreate}
      onActivate={(id) => $activateMutation.mutate(id)}
      onDelete={(id) => $deleteMutation.mutate(id)}
      onRename={handleRename}
      onRetry={() => $configsQuery.refetch()}
      configDetail={config}
    />

    {#if config}
      <AccordionSection title="Question Interpretation" open={true}>
        <ParameterToggle
          label="Question Interpretation"
          paramKey="question_interpret_enabled"
          value={(hp("question_interpret_enabled") as boolean) ?? false}
          description="Detect a natural-language question and rewrite it to the topic before searching, so the keyword leg doesn't collapse on framing words."
          detailedDescription="When a posted query reads as a question (interrogative lead or trailing '?'), a small model (default gpt-5.4-nano) rewrites it to the topic the researcher meant — 'Do you have instruction manuals for ship design?' becomes 'ship design'. A deterministic heuristic is the fast fallback when the model is slow or unavailable. Off by default (issue 498c6a2f)."
          disabled={config.locked}
          onchange={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, question_interpret_enabled: v })}
        />
        <div
          class="rounded-lg border border-theme bg-theme-secondary/40 p-3 space-y-1.5"
        >
          <label
            for="qi-model"
            class="block text-sm font-semibold text-text-theme-primary"
          >
            Interpretation Model
          </label>
          <p class="text-[11px] text-text-theme-tertiary">
            Which model rewrites the question. nano is cheapest/fastest; mini and
            the full model trade latency for stronger rewrites.
          </p>
          <select
            id="qi-model"
            class="text-xs bg-surface-elevated border border-theme rounded-md pl-2 pr-8 py-1.5 text-text-theme-primary focus:outline-none focus:ring-1 focus:ring-interactive appearance-none bg-no-repeat bg-[length:16px_16px] bg-[position:right_6px_center] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]"
            disabled={config.locked}
            value={(hp("question_interpret_model") as string) ?? "gpt-5.4-nano"}
            onchange={(e) =>
              (dirtyHybrid = {
                ...dirtyHybrid,
                question_interpret_model: e.currentTarget.value,
              })}
          >
            <option value="gpt-5.4-nano">gpt-5.4-nano (default)</option>
            <option value="gpt-5.4-mini">gpt-5.4-mini</option>
            <option value="gpt-5.4">gpt-5.4</option>
          </select>
        </div>
        <ParameterSlider
          label="Interpretation Timeout"
          paramKey="question_interpret_timeout_ms"
          value={(hp("question_interpret_timeout_ms") as number) ?? 1500}
          min={200}
          max={10000}
          step={100}
          description="How long to wait for the model before falling back to the fast heuristic rewrite."
          detailedDescription="Cold model calls run ~0.9–2.2s; 3000ms avoids most cold-start fallbacks, though the very first call after a period of inactivity may still cold-start and fall back to the heuristic. Lower values favor latency over rewrite quality."
          scaleLabels={["200 (tight)", "3000 (recommended)", "10000 (max)"]}
          disabled={config.locked}
          formatValue={(v) => `${v} ms`}
          oninput={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, question_interpret_timeout_ms: v })}
        />
        <ParameterToggle
          label="Apply Interpreted Year Range"
          paramKey="question_interpret_apply_year_range"
          value={(hp("question_interpret_apply_year_range") as boolean) ?? true}
          description="When the question implies a date range ('since 2020', 'in the last five years'), apply it as a publish-year filter on the rewritten search."
          detailedDescription="The model can extract a year range from the question alongside the topic. When on, that range is applied as a year filter; when off, only the topic rewrite is used."
          disabled={config.locked}
          onchange={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, question_interpret_apply_year_range: v })}
        />
      </AccordionSection>
      <AccordionSection title="What Matters More" open={true}>
        <ParameterSlider
          label="Title Match Boost"
          paramKey="title_boost_weight"
          value={(hp("title_boost_weight") as number) ?? 1.0}
          min={0}
          max={5}
          step={0.1}
          description="Extra weight when a document's title contains the search terms."
          detailedDescription="Title boost adds a bonus RRF rank to documents whose title matches the search query. At 1.0, a title match is equivalent to being ranked #1 in an additional ranking signal. Too high and title-only matches dominate; too low and documents with perfect titles get buried by semantic matches."
          scaleLabels={["0 (off)", "1.0 (default)", "5.0 (strong)"]}
          disabled={config.locked}
          formatValue={(v) => v.toFixed(1)}
          oninput={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, title_boost_weight: v })}
        />
        <ParameterSlider
          label="Subject Heading Boost"
          paramKey="subject_boost_weight"
          value={(hp("subject_boost_weight") as number) ?? 1.0}
          min={0}
          max={5}
          step={0.1}
          description="Extra weight when a document's MARC subject headings match the query."
          detailedDescription="Subject heading boost uses the MARC subject headings assigned by catalogers. 1.17M headings across 285K documents (91.3% coverage). Uses a GIN index for fast matching."
          scaleLabels={["0 (off)", "1.0 (default)", "5.0 (strong)"]}
          disabled={config.locked}
          formatValue={(v) => v.toFixed(1)}
          oninput={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, subject_boost_weight: v })}
        />
        <ParameterSlider
          label="Phrase Title Boost"
          paramKey="phrase_title_boost_weight"
          value={(hp("phrase_title_boost_weight") as number) ?? 2.0}
          min={0}
          max={5}
          step={0.1}
          description="Extra weight when the query appears as an exact phrase in the title."
          detailedDescription="Uses PostgreSQL phraseto_tsquery which requires words to be adjacent and in order. Default 2.0 is intentionally stronger than word-match title boost because phrase matches are much more precise. Only fires for multi-word queries."
          scaleLabels={["0 (off)", "2.0 (default)", "5.0 (strong)"]}
          disabled={config.locked}
          formatValue={(v) => v.toFixed(1)}
          oninput={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, phrase_title_boost_weight: v })}
        />
        <ParameterSlider
          label="Publisher Authority Boost"
          paramKey="publisher_authority_weight"
          value={(hp("publisher_authority_weight") as number) ?? 0}
          min={0}
          max={5}
          step={0.1}
          description="Extra weight for documents from authoritative publishers (DHS, FEMA, CRS, GAO, etc.)."
          detailedDescription="Documents from tiered publishers get a weighted boost. Tier 1 (full weight): DHS, FEMA, DoD, CRS, GAO, CBO, FBI, White House, CDC. Tier 2 (half weight): RAND, NPS, CSIS, CHDS. 88.9% coverage (278K documents). Disabled by default."
          scaleLabels={["0 (off)", "0.5 (suggested)", "5.0 (strong)"]}
          disabled={config.locked}
          formatValue={(v) => v.toFixed(1)}
          oninput={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, publisher_authority_weight: v })}
        />
        <ParameterSlider
          label="Publisher Name Match Boost"
          paramKey="publisher_name_boost_weight"
          value={(hp("publisher_name_boost_weight") as number) ?? 0}
          min={0}
          max={5}
          step={0.1}
          description="When the query NAMES a publisher ('CRS reports', 'Congressional Research Service'), re-rank that publisher's docs and offer a 'Browse all' chip to the full Publisher term-filter."
          detailedDescription="Distinct from Publisher Authority above: that boosts authoritative publishers on every query; this fires only when the query matches a publisher NAME (phrase or acronym via synonyms). Publisher lives only in the controlled vocab, so free text reaches ~2,397 of ~35K CRS docs — this surfaces the publisher's work and links to the full set. Re-rank only, never injects; gated by a doc-count floor so only high-volume publishers qualify. Disabled by default (issue 0b476e21)."
          scaleLabels={["0 (off)", "2.0 (suggested)", "5.0 (strong)"]}
          disabled={config.locked}
          formatValue={(v) => v.toFixed(1)}
          oninput={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, publisher_name_boost_weight: v })}
        />
        <div
          class="rounded-lg border border-theme bg-theme-secondary/40 p-3 space-y-3"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-text-theme-primary">
                Publisher Authority Tiers
              </h3>
              <p class="text-[11px] text-text-theme-tertiary mt-0.5">
                Tier weight multiplies the publisher authority boost.
              </p>
            </div>
            <button
              type="button"
              class="btn btn-outline text-xs py-1 px-2"
              disabled={config.locked}
              onclick={addPublisherTier}
            >
              Add Tier
            </button>
          </div>
          <div class="space-y-3">
            {#each publisherTierEntries() as [tierKey, tier]}
              <div class="rounded-md border border-theme bg-theme-primary p-3">
                <div
                  class="flex flex-wrap items-center justify-between gap-3 mb-2"
                >
                  <div class="flex items-center gap-2">
                    <h4 class="text-xs font-semibold text-text-theme-primary">
                      {formatTierLabel(tierKey)}
                    </h4>
                    <label
                      class="flex items-center gap-1.5 text-[11px] text-text-theme-secondary"
                    >
                      <span>Weight</span>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.05"
                        value={tier.weight}
                        disabled={config.locked}
                        class="w-16 rounded border border-theme bg-theme-secondary px-2 py-1 text-xs text-text-theme-primary"
                        oninput={(event) =>
                          updatePublisherTierWeight(
                            tierKey,
                            Number(
                              (event.currentTarget as HTMLInputElement).value,
                            ),
                          )}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    class="text-[11px] text-red-700 dark:text-red-400 hover:text-red-800 disabled:opacity-50"
                    disabled={config.locked ||
                      publisherTierEntries().length <= 1}
                    onclick={() => removePublisherTier(tierKey)}
                  >
                    Remove tier
                  </button>
                </div>
                <div class="flex flex-wrap gap-1.5 mb-2">
                  {#each tier.publishers as publisher}
                    <span
                      class="inline-flex max-w-full items-center gap-1 rounded border border-theme bg-theme-secondary px-2 py-1 text-[11px] text-text-theme-secondary"
                    >
                      <span class="truncate">{publisher}</span>
                      <button
                        type="button"
                        class="text-text-theme-tertiary hover:text-red-600 disabled:opacity-50"
                        aria-label={`Remove ${publisher}`}
                        disabled={config.locked}
                        onclick={() =>
                          removePublisherFromTier(tierKey, publisher)}
                      >
                        x
                      </button>
                    </span>
                  {/each}
                  {#if tier.publishers.length === 0}
                    <span class="text-[11px] text-text-theme-tertiary"
                      >No publishers in this tier.</span
                    >
                  {/if}
                </div>
                <div class="flex gap-2">
                  <input
                    type="text"
                    placeholder="Publisher name"
                    value={publisherTierInputs[tierKey] ?? ""}
                    disabled={config.locked}
                    class="min-w-0 flex-1 rounded border border-theme bg-theme-secondary px-2 py-1.5 text-xs text-text-theme-primary"
                    oninput={(event) =>
                      (publisherTierInputs = {
                        ...publisherTierInputs,
                        [tierKey]: (event.currentTarget as HTMLInputElement)
                          .value,
                      })}
                    onkeydown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addPublisherToTier(tierKey);
                      }
                    }}
                  />
                  <button
                    type="button"
                    class="btn btn-outline text-xs py-1 px-2"
                    disabled={config.locked ||
                      !(publisherTierInputs[tierKey] ?? "").trim()}
                    onclick={() => addPublisherToTier(tierKey)}
                  >
                    Add
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
        <ParameterSlider
          label="Recency Boost"
          paramKey="recency_boost_weight"
          value={(hp("recency_boost_weight") as number) ?? 0}
          min={0}
          max={5}
          step={0.1}
          description="Newer documents score higher. Uses time-decay so recent docs get a boost without overwhelming relevance."
          detailedDescription="A 2025 document gets full boost. A 2013 document gets ~45%. Documents without publish dates are unaffected. 92% of documents have dates."
          scaleLabels={["0 (off)", "1.0 (gentle)", "5.0 (strong)"]}
          disabled={config.locked}
          formatValue={(v) => v.toFixed(1)}
          oninput={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, recency_boost_weight: v })}
        />
        {#if recencyActive}
          <ParameterSlider
            label="Recency Decay Rate"
            paramKey="recency_decay_rate"
            value={(hp("recency_decay_rate") as number) ?? 0.1}
            min={0.01}
            max={1.0}
            step={0.01}
            description="How fast the recency boost drops with age. Lower = older docs still get meaningful boost."
            detailedDescription="At 0.05: a 20-year-old doc keeps 50% of the boost. At 0.10 (default): 33%. At 0.50: only 9%. Use lower values for collections where older documents remain authoritative."
            scaleLabels={[
              "0.01 (slow decay)",
              "0.10 (default)",
              "1.0 (sharp cutoff)",
            ]}
            disabled={config.locked}
            formatValue={(v) => v.toFixed(2)}
            oninput={(v) =>
              (dirtyHybrid = { ...dirtyHybrid, recency_decay_rate: v })}
          />
        {/if}
        <ParameterSlider
          label="Curated Lists Boost"
          paramKey="lists_boost_weight"
          value={(hp("lists_boost_weight") as number) ?? 0}
          min={0}
          max={5}
          step={0.1}
          description="Extra weight for documents on editorially curated HSDL topic lists (~3,500 documents)."
          detailedDescription="HSDL maintains 102 curated topic lists covering 3,569 documents. Documents placed on these lists have been editorially selected as key resources for that topic."
          scaleLabels={["0 (off)", "1.0", "5.0 (strong)"]}
          disabled={config.locked}
          formatValue={(v) => v.toFixed(1)}
          oninput={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, lists_boost_weight: v })}
        />
        <ParameterSlider
          label="Tab/Section Boost"
          paramKey="tab_section_boost_weight"
          value={(hp("tab_section_boost_weight") as number) ?? 0}
          min={0}
          max={5}
          step={0.1}
          description="Extra weight for documents assigned to an editorial section (~173K documents, 55%)."
          detailedDescription="Tab/Section categorizes documents into editorial sections. 173K documents (55%) have at least one section assignment. This boost gives a mild preference to categorized documents."
          scaleLabels={["0 (off)", "1.0", "5.0 (strong)"]}
          disabled={config.locked}
          formatValue={(v) => v.toFixed(1)}
          oninput={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, tab_section_boost_weight: v })}
        />
      </AccordionSection>

      <AccordionSection title="How Search Behaves" open={true}>
        <ParameterSlider
          label="Ranking Smoothness (RRF K)"
          paramKey="rrf_k"
          value={(hp("rrf_k") as number) ?? 60}
          min={1}
          max={200}
          step={1}
          description="Lower values make the top-ranked results matter more. Higher values flatten the ranking."
          detailedDescription="RRF (Reciprocal Rank Fusion) combines keyword and semantic search scores. At K=1, the #1 result gets 50% of the score. At K=60 (default), the falloff is gentle. Lower K is useful when you trust ranking signals strongly."
          scaleLabels={["1 (sharp)", "60 (default)", "200 (flat)"]}
          disabled={config.locked}
          oninput={(v) => (dirtyHybrid = { ...dirtyHybrid, rrf_k: v })}
        />
        <ParameterToggle
          label="Constant Candidate Pool"
          paramKey="constant_pool_enabled"
          value={(hp("constant_pool_enabled") as boolean) ?? true}
          description="Rank against a fixed-size candidate pool regardless of page size. Makes ranking and counts page-size-invariant."
          detailedDescription="When ON, every request ranks against the same Candidate Pool Size below, so changing 'results per page' can never change the ordering or the totals (issue a0899a1d), and Lab preview ranks identically to the public site. When OFF, the legacy behavior applies: pool = per_page x Legacy Candidate Depth, which made ranking a function of page size."
          disabled={config.locked}
          onchange={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, constant_pool_enabled: v })}
        />
        <ParameterSlider
          label="Candidate Pool Size"
          paramKey="candidate_pool_size"
          value={(hp("candidate_pool_size") as number) ?? 400}
          min={50}
          max={1000}
          step={25}
          description="Fixed number of candidates each search method contributes for re-ranking (when Constant Candidate Pool is ON)."
          detailedDescription="Both the keyword and semantic legs contribute up to this many candidates to RRF fusion. 400 ≈ 2x the old per_page=25 norm; hydration at 400 measured ~147ms cold. Raise for deeper recall, lower for speed."
          scaleLabels={["50 (fast)", "400 (default)", "1000 (deep)"]}
          disabled={config.locked}
          oninput={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, candidate_pool_size: v })}
        />
        <ParameterToggle
          label="Coherent Counts (v2)"
          paramKey="hybrid_counts_v2_enabled"
          value={(hp("hybrid_counts_v2_enabled") as boolean) ?? true}
          description="Total = keyword + semantic (under similarity threshold) + boost extras — the same at every page size, and the header arithmetic adds up."
          detailedDescription="When ON: (1) the hybrid semantic leg only admits documents under the Semantic Similarity Threshold, so dissimilar vector matches stop polluting results and counts; (2) total_count is the sum of three disjoint buckets (keyword matches + semantic-only matches + boost-added docs), identical across modes and page sizes. Fixes the '0 semantic / 14 keyword / 77 hybrid' contradiction (issues 77822a25 / 3f0e9390). When OFF, the legacy max(keyword, ranked-pool) total applies."
          disabled={config.locked}
          onchange={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, hybrid_counts_v2_enabled: v })}
        />
        <ParameterToggle
          label="Surname Author Match"
          paramKey="creator_surname_match_enabled"
          value={(hp("creator_surname_match_enabled") as boolean) ?? true}
          description="A 1–2 word query matching only a few author authorities surfaces those authors' documents."
          detailedDescription="Author names live only in the Creator vocabulary — not in titles/descriptions — so a bare surname search ('marlatt') could never find authored works whose text omits the name (issue 3f0e9390). When the query token matches at most Surname Authority Cap distinct Creator authorities, their documents join the candidate pool via the Author Name Boost. Common surnames ('smith') exceed the cap and are unaffected — the autosuggest picker handles those."
          disabled={config.locked}
          onchange={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, creator_surname_match_enabled: v })}
        />
        <ParameterSlider
          label="Surname Authority Cap"
          paramKey="creator_surname_max_authorities"
          value={(hp("creator_surname_max_authorities") as number) ?? 20}
          min={1}
          max={25}
          step={1}
          description="Maximum distinct author authorities a bare-surname query may match before the surname signal stays quiet."
          detailedDescription="At 20, 'marlatt' (1 authority) and 'garza' (19) fire while 'house' (30), 'martinez' (92), and 'smith' (300+) stay inert — measured break in the authority distribution. Watch the surname_creator log lines before tuning."
          scaleLabels={["1 (strict)", "20 (default)", "25 (loose)"]}
          disabled={config.locked}
          oninput={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, creator_surname_max_authorities: v })}
        />
        <ParameterSlider
          label="Surname Common-Word Cutoff"
          paramKey="creator_surname_max_corpus_freq"
          value={(hp("creator_surname_max_corpus_freq") as number) ?? 500}
          min={0}
          max={5000}
          step={100}
          description="Skip bare-surname author matching for query words this common (corpus doc-frequency), so common nouns don't inject unrelated author/org documents."
          detailedDescription="Real surnames are rare in titles/descriptions ('garza' 42, 'marlatt' 27); common nouns are in the thousands ('ship' 4,718, 'design' 25,036). 'design' leads the authority 'Design Entrepreneurship Institute', so 'ship design' was injecting an unrelated election report via the author signal (issue 498c6a2f). A query word appearing in more than this many documents is skipped for surname matching. 0 disables the guard."
          scaleLabels={["0 (off)", "500 (default)", "5000 (loose)"]}
          disabled={config.locked}
          oninput={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, creator_surname_max_corpus_freq: v })}
        />
        <ParameterSlider
          label="Legacy Candidate Depth"
          paramKey="fetch_size_multiplier"
          value={(hp("fetch_size_multiplier") as number) ?? 3}
          min={1}
          max={10}
          step={1}
          description="LEGACY — used only when Constant Candidate Pool is OFF: candidates per page of results."
          detailedDescription="The pre-2026-06 pool sizing: for a page of 15 results, fetch (15 x multiplier) candidates from each search method. Coupling the pool to page size made ranking change with per_page (issue a0899a1d). Kept as the instant-rollback path; scheduled for removal."
          scaleLabels={["1x (fast)", "3x (default)", "10x (thorough)"]}
          disabled={config.locked}
          formatValue={(v) => `${v}x`}
          oninput={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, fetch_size_multiplier: v })}
        />
        <ParameterToggle
          label="Semantic Search"
          paramKey="semantic_search_enabled"
          value={(hp("semantic_search_enabled") as boolean) ?? true}
          description="Master switch for the embedding (semantic) leg. OFF = keyword-only, no OpenAI calls."
          detailedDescription="When OFF, search runs keyword-only across the whole app and never calls OpenAI to embed the query — a deliberate cost/ops kill-switch (e.g. during an OpenAI quota lapse). This is distinct from automatic degradation: if embeddings are merely unavailable, search already falls back to keyword-only on its own and flags the response as degraded. Turning this OFF is the intentional version of that, with no operator alert. The response reports semantic_search_enabled:false. Default ON (issue 8946756f)."
          disabled={config.locked}
          onchange={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, semantic_search_enabled: v })}
        />
        <ParameterToggle
          label="BM25 Keyword Ranking"
          paramKey="bm25_enabled"
          value={(hp("bm25_enabled") as boolean) ?? true}
          description="Use BM25 scoring instead of ts_rank for keyword search ordering."
          detailedDescription="BM25 adds IDF weighting (rare terms score higher), term frequency saturation, and document length normalization. Dramatically improves ranking for common terms. Example: 'National Defense Strategy' returns the actual NDS document instead of unrelated results. Requires pg_textsearch extension."
          disabled={config.locked}
          onchange={(v) => (dirtyHybrid = { ...dirtyHybrid, bm25_enabled: v })}
        />
        <ParameterToggle
          label="Series Collapse"
          paramKey="series_collapse_enabled"
          value={(hp("series_collapse_enabled") as boolean) ?? false}
          description="Collapse all docs sharing a Series vocab term to one result. OFF by default."
          detailedDescription="When enabled, every document tagged with the same Series term collapses to a single representative. The Series field is overloaded with giant topical lists ('COVID 19 Resources' = 12K docs, 'MMWR' = 1.4K; 456 series have >20 members), so this hides thousands of distinct docs and makes per-term facet counts undercount the result list (issues ccad6dc6 / fb88e583). Kept OFF by default — use Edition Collapse for true reissues."
          disabled={config.locked}
          onchange={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, series_collapse_enabled: v })}
        />
        <ParameterToggle
          label="Edition Collapse"
          paramKey="edition_collapse_enabled"
          value={(hp("edition_collapse_enabled") as boolean) ?? true}
          description="Fold reissued editions (same title, differing only in a trailing [date] bracket) to the newest."
          detailedDescription="Groups documents whose titles are identical except for a trailing bracketed edition marker ('[Updated Feb 2003]', '[June 15, 2020]') and keeps the newest by publish date. True editions share author and subject, so facet counts stay consistent with the result list. ON by default; gated independently of Series Collapse."
          disabled={config.locked}
          onchange={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, edition_collapse_enabled: v })}
        />
        <ParameterSlider
          label="Quality Banner Threshold"
          paramKey="quality_banner_threshold"
          value={(hp("quality_banner_threshold") as number) ?? 0.02}
          min={0}
          max={0.1}
          step={0.001}
          description="RRF score below which the 'no strong matches' banner appears."
          detailedDescription="When the top result's RRF score is below this threshold, users see a 'no strong matches' notice. With RRF K=60, a dual-method rank-0 result scores 0.033 (above default). With K=120, it scores 0.017 (below default). Adjust this when changing RRF K."
          scaleLabels={["0 (off)", "0.020 (default)", "0.100 (strict)"]}
          disabled={config.locked}
          formatValue={(v) => v.toFixed(3)}
          oninput={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, quality_banner_threshold: v })}
        />
        <ParameterSlider
          label="Related Similarity Threshold"
          paramKey="semantic_similarity_threshold"
          value={(hp("semantic_similarity_threshold") as number) ?? 0.55}
          min={0.3}
          max={0.8}
          step={0.01}
          description="Cosine distance cutoff for the Related (N) badge and the mode=semantic result set."
          detailedDescription="Defines what 'semantically related but not keyword-matched' means. The badge counts docs the embedding caught under this distance that are NOT in the keyword set; clicking Related shows exactly those docs. Lower is stricter — fewer, more obviously related results. Higher is broader — more results, looser association. Validated for q='ransomware' at 0.55: catches Crimeware, Malware Threats, Backoff (PoS malware), Coreflood, Rogue Anti-Virus. 0.50 catches only the closest; 0.60 starts pulling in adjacent-but-loose topics."
          scaleLabels={["0.30 (very strict)", "0.55 (default)", "0.80 (loose)"]}
          disabled={config.locked}
          formatValue={(v) => v.toFixed(2)}
          oninput={(v) =>
            (dirtyHybrid = { ...dirtyHybrid, semantic_similarity_threshold: v })}
        />
      </AccordionSection>

      <AccordionSection
        title="Language Rules"
        badge={synCount + excludedCount}
        open={false}
      >
        <SynonymEditor
          synonyms={currentSynonyms()}
          disabled={config.locked}
          onAdd={handleAddSynonym}
          onRemove={handleRemoveSynonym}
        />
        <div class="border-t border-theme my-4"></div>
        <ExcludedTermEditor
          terms={currentExcluded()}
          disabled={config.locked}
          onAdd={handleAddExcluded}
          onRemove={handleRemoveExcluded}
        />
      </AccordionSection>
    {:else if $detailQuery.isPending && selectedId}
      <div class="card p-4">
        <div class="skeleton h-4 w-48 mb-3 rounded"></div>
        <div class="skeleton h-3 w-32 mb-6 rounded"></div>
        <div class="space-y-4">
          {#each Array(3) as _}
            <div>
              <div class="skeleton h-3 w-40 mb-2 rounded"></div>
              <div class="skeleton h-5 w-full rounded"></div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- RIGHT: Preview (sticky) -->
  <div
    class="lg:sticky lg:top-3 lg:self-start lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto"
  >
    <PreviewPanel
      {previewQuery}
      onQueryChange={(q) => (previewQuery = q)}
      onRunPreview={runPreview}
      {activePreview}
      {experimentalPreview}
      {previewing}
      {previewError}
      {autoPreviewPending}
      activeConfigName={$configsQuery.data?.find((c) => c.active)?.name ?? ""}
      comparisonConfigName={config?.name ?? ""}
    />
  </div>
</div>

<!-- Save toast -->
{#if saveToastVisible}
  <div
    class="fixed bottom-6 right-6 z-50 save-toast {saveToastType === 'success'
      ? 'bg-green-600'
      : 'bg-red-600'} text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2"
  >
    {#if saveToastType === "success"}<Check size={14} />{/if}
    {saveToastMessage}
  </div>
{/if}

<style>
  .save-toast {
    animation: toast-in 200ms ease-out;
  }
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
