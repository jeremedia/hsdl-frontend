<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { derived, writable } from 'svelte/store';
	import { inkApi } from '$lib/services/ink-api';
	import type { SearchConfigDetail, PreviewResponse } from '$lib/services/ink-api';
	import { Check } from 'lucide-svelte';

	import ConfigSelector from '$lib/components/lab/ConfigSelector.svelte';
	import AccordionSection from '$lib/components/lab/AccordionSection.svelte';
	import ParameterSlider from '$lib/components/lab/ParameterSlider.svelte';
	import ParameterToggle from '$lib/components/lab/ParameterToggle.svelte';
	import SynonymEditor from '$lib/components/lab/SynonymEditor.svelte';
	import ExcludedTermEditor from '$lib/components/lab/ExcludedTermEditor.svelte';
	import PreviewPanel from '$lib/components/lab/PreviewPanel.svelte';

	const queryClient = useQueryClient();

	// --- Config list query ---
	const configsQuery = createQuery({
		queryKey: ['ink', 'search_configs'],
		queryFn: () => inkApi.getSearchConfigs()
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
	$effect(() => { selectedIdStore.set(selectedId); });

	const detailQuery = createQuery(
		derived(selectedIdStore, ($id) => ({
			queryKey: ['ink', 'search_config', $id] as const,
			queryFn: () => $id ? inkApi.getSearchConfig($id) : Promise.reject('no id'),
			enabled: !!$id
		}))
	);

	let config = $derived($detailQuery.data);

	// --- Dirty state ---
	let dirtyHybrid = $state<Record<string, unknown>>({});
	let dirtySynonyms = $state<Record<string, string[]> | null>(null);
	let dirtyExcluded = $state<string[] | null>(null);

	let isDirty = $derived(Object.keys(dirtyHybrid).length > 0 || dirtySynonyms !== null || dirtyExcluded !== null);

	function hp(key: keyof SearchConfigDetail['hybrid_params']): number | boolean | undefined {
		if (key in dirtyHybrid) return dirtyHybrid[key] as number | boolean;
		return config?.hybrid_params?.[key] as number | boolean | undefined;
	}

	function currentSynonyms(): Record<string, string[]> {
		return dirtySynonyms ?? config?.synonyms ?? {};
	}

	function currentExcluded(): string[] {
		return dirtyExcluded ?? config?.excluded_terms ?? [];
	}

	function clearDirty() {
		dirtyHybrid = {};
		dirtySynonyms = null;
		dirtyExcluded = null;
	}

	function selectConfig(id: string) {
		if (id !== selectedId) {
			clearDirty();
			selectedId = id;
		}
	}

	let recencyActive = $derived((hp('recency_boost_weight') as number) > 0);
	let synCount = $derived(Object.keys(currentSynonyms()).length);
	let excludedCount = $derived(currentExcluded().length);

	// --- Mutations ---
	const saveMutation = createMutation({
		mutationFn: async () => {
			if (!selectedId) return;
			const data: Record<string, unknown> = {};
			if (Object.keys(dirtyHybrid).length > 0) {
				data.hybrid_params = { ...(config?.hybrid_params || {}), ...dirtyHybrid };
			}
			if (dirtySynonyms !== null) data.synonyms = dirtySynonyms;
			if (dirtyExcluded !== null) data.excluded_terms = dirtyExcluded;
			return inkApi.updateSearchConfig(selectedId, data as Partial<SearchConfigDetail>);
		},
		onSuccess: () => {
			clearDirty();
			queryClient.invalidateQueries({ queryKey: ['ink', 'search_config', selectedId] });
			queryClient.invalidateQueries({ queryKey: ['ink', 'search_configs'] });
			showSaveToast('Configuration saved', 'success');
		},
		onError: (err: Error) => {
			showSaveToast(`Save failed: ${err.message}`, 'error');
		}
	});

	const activateMutation = createMutation({
		mutationFn: (id: string) => inkApi.activateSearchConfig(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['ink', 'search_configs'] });
			queryClient.invalidateQueries({ queryKey: ['ink', 'search_config'] });
		}
	});

	const deleteMutation = createMutation({
		mutationFn: (id: string) => inkApi.deleteSearchConfig(id),
		onSuccess: () => {
			selectedId = null;
			queryClient.invalidateQueries({ queryKey: ['ink', 'search_configs'] });
		}
	});

	async function handleCreate(name: string) {
		try {
			const result = await inkApi.createSearchConfig({ name });
			selectedId = result.id;
			queryClient.invalidateQueries({ queryKey: ['ink', 'search_configs'] });
		} catch {
			// handled by UI
		}
	}

	async function handleClone(sourceId: string, name: string) {
		try {
			const result = await inkApi.cloneSearchConfig(sourceId, { name });
			selectedId = result.id;
			queryClient.invalidateQueries({ queryKey: ['ink', 'search_configs'] });
		} catch {
			// handled by UI
		}
	}

	async function handleRename(id: string, name: string) {
		try {
			await inkApi.updateSearchConfig(id, { name } as Partial<SearchConfigDetail>);
			queryClient.invalidateQueries({ queryKey: ['ink', 'search_configs'] });
			queryClient.invalidateQueries({ queryKey: ['ink', 'search_config', id] });
		} catch {
			showSaveToast('Rename failed', 'error');
		}
	}

	// --- Preview ---
	const STORAGE_KEY = 'ink-lab-preview-query';
	let previewQuery = $state(
		typeof localStorage !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) ?? '') : ''
	);

	// Persist query to localStorage
	$effect(() => {
		if (typeof localStorage !== 'undefined') {
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
				configOverride.hybrid_params = { ...(config?.hybrid_params || {}), ...dirtyHybrid };
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
					config: Object.keys(configOverride).length > 0 ? configOverride as Partial<SearchConfigDetail> : undefined
				})
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
	let dirtyFingerprint = $derived(JSON.stringify({ h: dirtyHybrid, s: dirtySynonyms, e: dirtyExcluded }));

	$effect(() => {
		const _fp = dirtyFingerprint;
		const _q = previewQuery;
		if (!isDirty || !_q.trim()) {
			autoPreviewPending = false;
			return;
		}
		autoPreviewPending = true;
		const timer = setTimeout(() => { autoPreviewPending = false; runPreview(); }, 500);
		return () => { clearTimeout(timer); autoPreviewPending = false; };
	});

	// --- Toast ---
	let saveToastMessage = $state('');
	let saveToastType = $state<'success' | 'error'>('success');
	let saveToastVisible = $state(false);
	let saveToastTimer: ReturnType<typeof setTimeout> | null = null;

	function showSaveToast(message: string, type: 'success' | 'error') {
		if (saveToastTimer) clearTimeout(saveToastTimer);
		saveToastMessage = message;
		saveToastType = type;
		saveToastVisible = true;
		saveToastTimer = setTimeout(() => { saveToastVisible = false; }, 3000);
	}

	// --- Keyboard shortcuts ---
	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			if (isDirty && !$saveMutation.isPending && !config?.locked) $saveMutation.mutate();
		}
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
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
		dirtyExcluded = currentExcluded().filter(t => t !== term);
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
		<p class="text-[11px] text-text-theme-tertiary mt-0.5 leading-snug">Tune ranking, synonyms, and behavior. Changes go live when you activate a config.</p>
	</div>
	<div class="flex gap-1.5">
		{#if isDirty && !config?.locked}
			<button onclick={() => clearDirty()} class="btn btn-outline text-xs py-1 px-2.5">Revert</button>
			<button onclick={() => $saveMutation.mutate()} disabled={$saveMutation.isPending} class="btn btn-primary text-xs py-1 px-2.5">
				{$saveMutation.isPending ? 'Saving...' : 'Save'}
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
			<AccordionSection title="What Matters More" open={true}>
				<ParameterSlider
					label="Title Match Boost" paramKey="title_boost_weight"
					value={hp('title_boost_weight') as number ?? 1.0}
					min={0} max={5} step={0.1}
					description="Extra weight when a document's title contains the search terms."
					detailedDescription="Title boost adds a bonus RRF rank to documents whose title matches the search query. At 1.0, a title match is equivalent to being ranked #1 in an additional ranking signal. Too high and title-only matches dominate; too low and documents with perfect titles get buried by semantic matches."
					scaleLabels={['0 (off)', '1.0 (default)', '5.0 (strong)']}
					disabled={config.locked}
					formatValue={(v) => v.toFixed(1)}
					oninput={(v) => dirtyHybrid = { ...dirtyHybrid, title_boost_weight: v }}
				/>
				<ParameterSlider
					label="Subject Heading Boost" paramKey="subject_boost_weight"
					value={hp('subject_boost_weight') as number ?? 1.0}
					min={0} max={5} step={0.1}
					description="Extra weight when a document's MARC subject headings match the query."
					detailedDescription="Subject heading boost uses the MARC subject headings assigned by catalogers. 1.17M headings across 285K documents (91.3% coverage). Uses a GIN index for fast matching."
					scaleLabels={['0 (off)', '1.0 (default)', '5.0 (strong)']}
					disabled={config.locked}
					formatValue={(v) => v.toFixed(1)}
					oninput={(v) => dirtyHybrid = { ...dirtyHybrid, subject_boost_weight: v }}
				/>
				<ParameterSlider
					label="Phrase Title Boost" paramKey="phrase_title_boost_weight"
					value={hp('phrase_title_boost_weight') as number ?? 2.0}
					min={0} max={5} step={0.1}
					description="Extra weight when the query appears as an exact phrase in the title."
					detailedDescription="Uses PostgreSQL phraseto_tsquery which requires words to be adjacent and in order. Default 2.0 is intentionally stronger than word-match title boost because phrase matches are much more precise. Only fires for multi-word queries."
					scaleLabels={['0 (off)', '2.0 (default)', '5.0 (strong)']}
					disabled={config.locked}
					formatValue={(v) => v.toFixed(1)}
					oninput={(v) => dirtyHybrid = { ...dirtyHybrid, phrase_title_boost_weight: v }}
				/>
				<ParameterSlider
					label="Publisher Authority Boost" paramKey="publisher_authority_weight"
					value={hp('publisher_authority_weight') as number ?? 0}
					min={0} max={5} step={0.1}
					description="Extra weight for documents from authoritative publishers (DHS, FEMA, CRS, GAO, etc.)."
					detailedDescription="Documents from tiered publishers get a weighted boost. Tier 1 (full weight): DHS, FEMA, DoD, CRS, GAO, CBO, FBI, White House, CDC. Tier 2 (half weight): RAND, NPS, CSIS, CHDS. 88.9% coverage (278K documents). Disabled by default."
					scaleLabels={['0 (off)', '0.5 (suggested)', '5.0 (strong)']}
					disabled={config.locked}
					formatValue={(v) => v.toFixed(1)}
					oninput={(v) => dirtyHybrid = { ...dirtyHybrid, publisher_authority_weight: v }}
				/>
				<ParameterSlider
					label="Recency Boost" paramKey="recency_boost_weight"
					value={hp('recency_boost_weight') as number ?? 0}
					min={0} max={5} step={0.1}
					description="Newer documents score higher. Uses time-decay so recent docs get a boost without overwhelming relevance."
					detailedDescription="A 2025 document gets full boost. A 2013 document gets ~45%. Documents without publish dates are unaffected. 92% of documents have dates."
					scaleLabels={['0 (off)', '1.0 (gentle)', '5.0 (strong)']}
					disabled={config.locked}
					formatValue={(v) => v.toFixed(1)}
					oninput={(v) => dirtyHybrid = { ...dirtyHybrid, recency_boost_weight: v }}
				/>
				{#if recencyActive}
					<ParameterSlider
						label="Recency Decay Rate" paramKey="recency_decay_rate"
						value={hp('recency_decay_rate') as number ?? 0.1}
						min={0.01} max={1.0} step={0.01}
						description="How fast the recency boost drops with age. Lower = older docs still get meaningful boost."
						detailedDescription="At 0.05: a 20-year-old doc keeps 50% of the boost. At 0.10 (default): 33%. At 0.50: only 9%. Use lower values for collections where older documents remain authoritative."
						scaleLabels={['0.01 (slow decay)', '0.10 (default)', '1.0 (sharp cutoff)']}
						disabled={config.locked}
						formatValue={(v) => v.toFixed(2)}
						oninput={(v) => dirtyHybrid = { ...dirtyHybrid, recency_decay_rate: v }}
					/>
				{/if}
				<ParameterSlider
					label="Curated Lists Boost" paramKey="lists_boost_weight"
					value={hp('lists_boost_weight') as number ?? 0}
					min={0} max={5} step={0.1}
					description="Extra weight for documents on editorially curated HSDL topic lists (~3,500 documents)."
					detailedDescription="HSDL maintains 102 curated topic lists covering 3,569 documents. Documents placed on these lists have been editorially selected as key resources for that topic."
					scaleLabels={['0 (off)', '1.0', '5.0 (strong)']}
					disabled={config.locked}
					formatValue={(v) => v.toFixed(1)}
					oninput={(v) => dirtyHybrid = { ...dirtyHybrid, lists_boost_weight: v }}
				/>
				<ParameterSlider
					label="Tab/Section Boost" paramKey="tab_section_boost_weight"
					value={hp('tab_section_boost_weight') as number ?? 0}
					min={0} max={5} step={0.1}
					description="Extra weight for documents assigned to an editorial section (~173K documents, 55%)."
					detailedDescription="Tab/Section categorizes documents into editorial sections. 173K documents (55%) have at least one section assignment. This boost gives a mild preference to categorized documents."
					scaleLabels={['0 (off)', '1.0', '5.0 (strong)']}
					disabled={config.locked}
					formatValue={(v) => v.toFixed(1)}
					oninput={(v) => dirtyHybrid = { ...dirtyHybrid, tab_section_boost_weight: v }}
				/>
			</AccordionSection>

			<AccordionSection title="How Search Behaves" open={true}>
				<ParameterSlider
					label="Ranking Smoothness (RRF K)" paramKey="rrf_k"
					value={hp('rrf_k') as number ?? 60}
					min={1} max={200} step={1}
					description="Lower values make the top-ranked results matter more. Higher values flatten the ranking."
					detailedDescription="RRF (Reciprocal Rank Fusion) combines keyword and semantic search scores. At K=1, the #1 result gets 50% of the score. At K=60 (default), the falloff is gentle. Lower K is useful when you trust ranking signals strongly."
					scaleLabels={['1 (sharp)', '60 (default)', '200 (flat)']}
					disabled={config.locked}
					oninput={(v) => dirtyHybrid = { ...dirtyHybrid, rrf_k: v }}
				/>
				<ParameterSlider
					label="Candidate Depth" paramKey="fetch_size_multiplier"
					value={hp('fetch_size_multiplier') as number ?? 3}
					min={1} max={10} step={1}
					description="How many candidates to consider per page of results. Higher = more thorough but slightly slower."
					detailedDescription="For a page of 15 results, the system fetches (15 x multiplier) candidates from each search method, then re-ranks the combined pool. Diminishing returns above 5x."
					scaleLabels={['1x (fast)', '3x (default)', '10x (thorough)']}
					disabled={config.locked}
					formatValue={(v) => `${v}x`}
					oninput={(v) => dirtyHybrid = { ...dirtyHybrid, fetch_size_multiplier: v }}
				/>
				<ParameterToggle
					label="Series Collapse" paramKey="series_collapse_enabled"
					value={hp('series_collapse_enabled') as boolean ?? true}
					description="Group editions of the same series, showing only the newest."
					detailedDescription="When enabled, multiple editions of the same publication series are collapsed into a single result. 4,758 series cover 65K documents (20% of the collection). The collapse happens after RRF scoring."
					disabled={config.locked}
					onchange={(v) => dirtyHybrid = { ...dirtyHybrid, series_collapse_enabled: v }}
				/>
				<ParameterSlider
					label="Quality Banner Threshold" paramKey="quality_banner_threshold"
					value={hp('quality_banner_threshold') as number ?? 0.020}
					min={0} max={0.100} step={0.001}
					description="RRF score below which the 'no strong matches' banner appears."
					detailedDescription="When the top result's RRF score is below this threshold, users see a 'no strong matches' notice. With RRF K=60, a dual-method rank-0 result scores 0.033 (above default). With K=120, it scores 0.017 (below default). Adjust this when changing RRF K."
					scaleLabels={['0 (off)', '0.020 (default)', '0.100 (strict)']}
					disabled={config.locked}
					formatValue={(v) => v.toFixed(3)}
					oninput={(v) => dirtyHybrid = { ...dirtyHybrid, quality_banner_threshold: v }}
				/>
			</AccordionSection>

			<AccordionSection title="Language Rules" badge={synCount + excludedCount} open={false}>
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
	<div class="lg:sticky lg:top-3 lg:self-start lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto">
		<PreviewPanel
			{previewQuery}
			onQueryChange={(q) => previewQuery = q}
			onRunPreview={runPreview}
			{activePreview}
			{experimentalPreview}
			{previewing}
			{previewError}
			{autoPreviewPending}
			activeConfigName={$configsQuery.data?.find(c => c.active)?.name ?? ''}
			comparisonConfigName={config?.name ?? ''}
		/>
	</div>
</div>

<!-- Save toast -->
{#if saveToastVisible}
	<div class="fixed bottom-6 right-6 z-50 save-toast {saveToastType === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
		{#if saveToastType === 'success'}<Check size={14} />{/if}
		{saveToastMessage}
	</div>
{/if}

<style>
	.save-toast {
		animation: toast-in 200ms ease-out;
	}
	@keyframes toast-in {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
