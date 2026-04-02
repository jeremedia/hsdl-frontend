<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { derived, writable } from 'svelte/store';
	import { inkApi } from '$lib/services/ink-api';
	import type { SearchConfigDetail, SearchConfigSummary, PreviewResponse } from '$lib/services/ink-api';
	import { Lock, Copy, Trash2, Zap, ChevronDown, Search, Info, Plus, Check, FlaskConical, BookOpen, Ban } from 'lucide-svelte';

	const queryClient = useQueryClient();

	// Config list
	const configsQuery = createQuery({
		queryKey: ['ink', 'search_configs'],
		queryFn: () => inkApi.getSearchConfigs()
	});

	// Selected config for editing (not necessarily the active one)
	let selectedId = $state<string | null>(null);
	let showCreate = $state(false);
	let newName = $state('');
	let cloneSourceId = $state<string | null>(null);

	// Dirty state (only changed fields)
	let dirtyHybrid = $state<Record<string, unknown>>({});
	let dirtySynonyms = $state<Record<string, string[]> | null>(null);
	let dirtyExcluded = $state<string[] | null>(null);

	// Preview
	let previewQuery = $state('');
	let activePreview = $state<PreviewResponse | null>(null);
	let experimentalPreview = $state<PreviewResponse | null>(null);
	let previewing = $state(false);
	let previewError = $state<string | null>(null);

	// Collapsible sections
	let showRanking = $state(true);
	let showSynonyms = $state(false);
	let showExcluded = $state(false);
	let showDefaults = $state(false);
	let showPreview = $state(true);

	// Save toast
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

	// Expanded parameter descriptions
	let expandedParam = $state<string | null>(null);

	// New synonym entry
	let newSynTerm = $state('');
	let newSynExpansions = $state('');
	let newExcludedTerm = $state('');

	// Computed: select first config if none selected
	$effect(() => {
		if (!selectedId && $configsQuery.data?.length) {
			selectedId = $configsQuery.data[0].id;
		}
	});

	// Detail query for selected config
	// TanStack Query 5.90 for Svelte uses stores, not runes.
	// Wrapping options in derived() so TanStack re-evaluates when selectedId changes.
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
	let isDirty = $derived(Object.keys(dirtyHybrid).length > 0 || dirtySynonyms !== null || dirtyExcluded !== null);

	// Resolved values (dirty overrides saved)
	function hp(key: string): unknown {
		if (key in dirtyHybrid) return dirtyHybrid[key];
		return config?.hybrid_params?.[key as keyof typeof config.hybrid_params];
	}

	function currentSynonyms(): Record<string, string[]> {
		return dirtySynonyms ?? config?.synonyms ?? {};
	}

	function currentExcluded(): string[] {
		return dirtyExcluded ?? config?.excluded_terms ?? [];
	}

	// Mutations
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

	async function handleClone(sourceId: string) {
		cloneSourceId = sourceId;
		const source = $configsQuery.data?.find(c => c.id === sourceId);
		newName = `${source?.name || 'config'} (copy)`;
		showCreate = true;
	}

	async function handleCreate() {
		if (!newName.trim()) return;
		try {
			let result: SearchConfigDetail;
			if (cloneSourceId) {
				result = await inkApi.cloneSearchConfig(cloneSourceId, { name: newName.trim() });
			} else {
				result = await inkApi.createSearchConfig({ name: newName.trim() });
			}
			showCreate = false;
			newName = '';
			cloneSourceId = null;
			selectedId = result.id;
			queryClient.invalidateQueries({ queryKey: ['ink', 'search_configs'] });
		} catch (e) {
			// handled by UI
		}
	}

	async function runPreview() {
		if (!previewQuery.trim()) return;
		previewing = true;
		previewError = null;
		try {
			const [active, experimental] = await Promise.all([
				inkApi.previewSearch({ query: previewQuery }),
				inkApi.previewSearch({
					query: previewQuery,
					config_id: selectedId || undefined,
					config: Object.keys(dirtyHybrid).length > 0 ? { hybrid_params: { ...(config?.hybrid_params || {}), ...dirtyHybrid } as SearchConfigDetail['hybrid_params'] } : undefined
				})
			]);
			activePreview = active;
			experimentalPreview = experimental;
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			previewError = `Preview failed: ${msg}. Try again -- this can happen during heavy database operations.`;
			activePreview = null;
			experimentalPreview = null;
		} finally {
			previewing = false;
		}
	}

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

	function addSynonym() {
		if (!newSynTerm.trim() || !newSynExpansions.trim()) return;
		const syns = { ...currentSynonyms() };
		syns[newSynTerm.trim().toLowerCase()] = newSynExpansions.split(',').map(s => s.trim()).filter(Boolean);
		dirtySynonyms = syns;
		newSynTerm = '';
		newSynExpansions = '';
	}

	function removeSynonym(term: string) {
		const syns = { ...currentSynonyms() };
		delete syns[term];
		dirtySynonyms = syns;
	}

	function addExcludedTerm() {
		if (!newExcludedTerm.trim()) return;
		dirtyExcluded = [...currentExcluded(), newExcludedTerm.trim()];
		newExcludedTerm = '';
	}

	function removeExcludedTerm(term: string) {
		dirtyExcluded = currentExcluded().filter(t => t !== term);
	}

	function formatDate(iso: string | null): string {
		if (!iso) return '';
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<svelte:head>
	<title>Search Lab | INK</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold text-text-theme-primary">Search Lab</h1>
			<p class="text-xs text-text-theme-tertiary mt-0.5">Tune search ranking, synonyms, and behavior. Changes only go live when you activate a config.</p>
		</div>
		<div class="flex gap-2">
			{#if isDirty && !config?.locked}
				<button onclick={() => clearDirty()} class="btn btn-outline text-xs py-1 px-2.5">Revert</button>
				<button onclick={() => $saveMutation.mutate()} disabled={$saveMutation.isPending} class="btn btn-primary text-xs py-1 px-2.5">
					{$saveMutation.isPending ? 'Saving...' : 'Save'}
				</button>
			{/if}
			<button onclick={() => { cloneSourceId = null; newName = ''; showCreate = !showCreate; }} class="btn btn-outline text-xs py-1 px-2.5">
				<Plus size={14} /> New
			</button>
		</div>
	</div>

	<!-- Create/Clone form -->
	{#if showCreate}
		<form onsubmit={(e) => { e.preventDefault(); handleCreate(); }} class="card p-4 space-y-3">
			<div>
				<label class="text-xs font-medium text-text-theme-secondary block mb-1">{cloneSourceId ? 'Clone as' : 'New config name'}</label>
				<input bind:value={newName} class="input text-xs py-1.5 w-full" placeholder="e.g., Experiment March 2026" />
			</div>
			<div class="flex gap-2">
				<button type="submit" class="btn btn-primary text-xs py-1 px-3">Create</button>
				<button type="button" onclick={() => showCreate = false} class="btn btn-outline text-xs py-1 px-3">Cancel</button>
			</div>
		</form>
	{/if}

	<!-- Config selector -->
	{#if $configsQuery.isPending}
		<div class="flex gap-2 flex-wrap">
			{#each Array(3) as _}
				<div class="skeleton h-7 w-24 rounded-full"></div>
			{/each}
		</div>
	{:else if $configsQuery.isError}
		<div class="card p-4 text-center">
			<p class="text-error text-sm mb-3">Failed to load configurations: {$configsQuery.error.message}</p>
			<button onclick={() => $configsQuery.refetch()} class="btn btn-primary text-xs py-1 px-3">Retry</button>
		</div>
	{:else if $configsQuery.data}
		{#if $configsQuery.data.length === 0}
			<div class="card p-8 text-center">
				<FlaskConical size={32} class="mx-auto mb-3 text-text-theme-tertiary opacity-40" />
				<p class="text-sm text-text-theme-secondary mb-1">No search configurations yet</p>
				<p class="text-xs text-text-theme-tertiary">Create a configuration to start tuning search parameters.</p>
			</div>
		{:else}
			<div class="flex gap-2 flex-wrap">
				{#each $configsQuery.data as c (c.id)}
					<button
						onclick={() => selectConfig(c.id)}
						class="config-pill px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150
							{selectedId === c.id ? 'border-interactive bg-interactive/10 text-interactive shadow-sm' : 'border-[var(--color-border)] text-text-theme-secondary hover:border-interactive/50 hover:text-text-theme-primary'}
							{c.active ? 'ring-2 ring-green-500/30' : ''}"
					>
						{#if c.locked}<Lock size={10} class="inline mr-1 opacity-60" />{/if}
						{c.name}
						{#if c.active}<span class="ml-1.5 text-green-600 dark:text-green-400 text-[11px] font-bold uppercase tracking-wider">Live</span>{/if}
					</button>
				{/each}
			</div>
		{/if}
	{/if}

	{#if config}
		<!-- Config info bar -->
		<div class="card px-4 py-3 flex items-center gap-4 text-xs text-text-theme-tertiary">
			{#if config.locked}
				<span class="text-amber-600 font-medium flex items-center gap-1"><Lock size={12} /> Locked -- clone to experiment</span>
			{/if}
			{#if !config.active}
				<button onclick={() => $activateMutation.mutate(config.id)} class="text-green-600 hover:text-green-700 font-medium flex items-center gap-1 transition-colors">
					<Zap size={12} /> Activate this config
				</button>
			{:else}
				<span class="text-green-600 font-medium flex items-center gap-1"><Check size={12} /> Currently live</span>
			{/if}
			{#if !config.active && !config.locked}
				<button onclick={() => $deleteMutation.mutate(config.id)} class="text-red-500 hover:text-red-600 ml-auto flex items-center gap-1 transition-colors">
					<Trash2 size={12} /> Delete
				</button>
			{/if}
			<button onclick={() => handleClone(config.id)} class="text-text-theme-secondary hover:text-text-theme-primary flex items-center gap-1 transition-colors {config.active && !config.locked ? 'ml-auto' : ''}">
				<Copy size={12} /> Clone
			</button>
		</div>

		<!-- ═══ Ranking & Relevance ═══ -->
		<div class="card overflow-hidden">
			<button onclick={() => showRanking = !showRanking} class="section-header w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-secondary transition-colors">
				<h2 class="text-sm font-semibold text-text-theme-primary">Ranking & Relevance</h2>
				<ChevronDown size={16} class="text-text-theme-tertiary transition-transform duration-200 {showRanking ? '' : '-rotate-90'}" />
			</button>
			{#if showRanking}
				<div class="border-t border-theme px-4 pb-5 pt-4 space-y-6">
					<!-- RRF K -->
					<div class="param-group">
						<div class="flex items-center justify-between mb-1">
							<div class="flex items-center gap-1.5">
								<label class="text-xs font-medium text-text-theme-primary">Ranking Smoothness (RRF K)</label>
								<button onclick={() => expandedParam = expandedParam === 'rrf_k' ? null : 'rrf_k'} class="text-text-theme-tertiary hover:text-interactive transition-colors" title="Learn more">
									<Info size={12} />
								</button>
							</div>
							<span class="text-xs font-mono text-interactive tabular-nums">{hp('rrf_k')}</span>
						</div>
						<p class="text-[11px] text-text-theme-tertiary mb-2 leading-relaxed">Lower values make the top-ranked results matter more. Higher values flatten the ranking so #1 and #10 have similar weight.</p>
						{#if expandedParam === 'rrf_k'}
							<div class="text-[11px] text-text-theme-secondary bg-surface-secondary rounded px-3 py-2 mb-2 leading-relaxed">
								RRF (Reciprocal Rank Fusion) combines keyword and semantic search scores. The K parameter controls how steeply rank position falls off. At K=1, the #1 result gets 50% of the score and #2 gets 33%. At K=60 (default), the falloff is gentle, so results in positions 1-20 have similar influence. Lower K is useful when you trust the ranking signals strongly; higher K when you want diverse sources to contribute equally.
							</div>
						{/if}
						<input type="range" min="1" max="200" step="1"
							aria-label="Ranking Smoothness (RRF K)"
							value={hp('rrf_k') as number}
							oninput={(e) => dirtyHybrid = { ...dirtyHybrid, rrf_k: parseInt((e.target as HTMLInputElement).value) }}
							disabled={config.locked}
							class="lab-slider w-full" />
						<div class="flex justify-between text-[11px] text-text-theme-tertiary mt-1.5">
							<span>1 (sharp)</span><span>60 (default)</span><span>200 (flat)</span>
						</div>
					</div>

					<!-- Title Boost -->
					<div class="param-group">
						<div class="flex items-center justify-between mb-1">
							<div class="flex items-center gap-1.5">
								<label class="text-xs font-medium text-text-theme-primary">Title Match Boost</label>
								<button onclick={() => expandedParam = expandedParam === 'title_boost' ? null : 'title_boost'} class="text-text-theme-tertiary hover:text-interactive transition-colors" title="Learn more">
									<Info size={12} />
								</button>
							</div>
							<span class="text-xs font-mono text-interactive tabular-nums">{(hp('title_boost_weight') as number)?.toFixed(1)}</span>
						</div>
						<p class="text-[11px] text-text-theme-tertiary mb-2 leading-relaxed">Extra weight when a document's title contains the search terms. 0 disables, 1.0 is normal, higher amplifies.</p>
						{#if expandedParam === 'title_boost'}
							<div class="text-[11px] text-text-theme-secondary bg-surface-secondary rounded px-3 py-2 mb-2 leading-relaxed">
								Title boost adds a bonus RRF rank to documents whose title matches the search query. At 1.0, a title match is equivalent to being ranked #1 in an additional ranking signal. This helps when users search for a known document by name. Too high and title-only matches dominate; too low and documents with perfect titles get buried by semantic matches.
							</div>
						{/if}
						<input type="range" min="0" max="5" step="0.1"
							aria-label="Title Match Boost"
							value={hp('title_boost_weight') as number}
							oninput={(e) => dirtyHybrid = { ...dirtyHybrid, title_boost_weight: parseFloat((e.target as HTMLInputElement).value) }}
							disabled={config.locked}
							class="lab-slider w-full" />
						<div class="flex justify-between text-[11px] text-text-theme-tertiary mt-1.5">
							<span>0 (off)</span><span>1.0 (default)</span><span>5.0 (strong)</span>
						</div>
					</div>

					<!-- Subject Boost -->
					<div class="param-group">
						<div class="flex items-center justify-between mb-1">
							<div class="flex items-center gap-1.5">
								<label class="text-xs font-medium text-text-theme-primary">Subject Heading Boost</label>
								<button onclick={() => expandedParam = expandedParam === 'subject_boost' ? null : 'subject_boost'} class="text-text-theme-tertiary hover:text-interactive transition-colors" title="Learn more">
									<Info size={12} />
								</button>
							</div>
							<span class="text-xs font-mono text-interactive tabular-nums">{(hp('subject_boost_weight') as number)?.toFixed(1)}</span>
						</div>
						<p class="text-[11px] text-text-theme-tertiary mb-2 leading-relaxed">Extra weight when a document's MARC subject headings match the query. Helps surface well-cataloged documents.</p>
						{#if expandedParam === 'subject_boost'}
							<div class="text-[11px] text-text-theme-secondary bg-surface-secondary rounded px-3 py-2 mb-2 leading-relaxed">
								Subject heading boost uses the MARC subject headings assigned by catalogers. Documents with matching headings get a bonus RRF rank. This rewards the cataloging work and ensures well-described documents surface for topical searches. 1.17M headings across 285K documents (91.3% coverage). Uses a GIN index for fast matching.
							</div>
						{/if}
						<input type="range" min="0" max="5" step="0.1"
							aria-label="Subject Heading Boost"
							value={hp('subject_boost_weight') as number}
							oninput={(e) => dirtyHybrid = { ...dirtyHybrid, subject_boost_weight: parseFloat((e.target as HTMLInputElement).value) }}
							disabled={config.locked}
							class="lab-slider w-full" />
						<div class="flex justify-between text-[11px] text-text-theme-tertiary mt-1.5">
							<span>0 (off)</span><span>1.0 (default)</span><span>5.0 (strong)</span>
						</div>
					</div>

					<!-- Fetch Depth -->
					<div class="param-group">
						<div class="flex items-center justify-between mb-1">
							<div class="flex items-center gap-1.5">
								<label class="text-xs font-medium text-text-theme-primary">Candidate Depth</label>
								<button onclick={() => expandedParam = expandedParam === 'fetch_depth' ? null : 'fetch_depth'} class="text-text-theme-tertiary hover:text-interactive transition-colors" title="Learn more">
									<Info size={12} />
								</button>
							</div>
							<span class="text-xs font-mono text-interactive tabular-nums">{hp('fetch_size_multiplier')}x</span>
						</div>
						<p class="text-[11px] text-text-theme-tertiary mb-2 leading-relaxed">How many candidates to consider per page of results. Higher means more thorough ranking but slightly slower.</p>
						{#if expandedParam === 'fetch_depth'}
							<div class="text-[11px] text-text-theme-secondary bg-surface-secondary rounded px-3 py-2 mb-2 leading-relaxed">
								For a page of 15 results, the system fetches (15 x multiplier) candidates from each search method (keyword and semantic), then re-ranks the combined pool. At 3x, that is 45 candidates from each, 90 total. Higher multipliers find more good results but require more database work. Diminishing returns above 5x for most queries.
							</div>
						{/if}
						<input type="range" min="1" max="10" step="1"
							aria-label="Candidate Depth"
							value={hp('fetch_size_multiplier') as number}
							oninput={(e) => dirtyHybrid = { ...dirtyHybrid, fetch_size_multiplier: parseInt((e.target as HTMLInputElement).value) }}
							disabled={config.locked}
							class="lab-slider w-full" />
						<div class="flex justify-between text-[11px] text-text-theme-tertiary mt-1.5">
							<span>1x (fast)</span><span>3x (default)</span><span>10x (thorough)</span>
						</div>
					</div>

					<!-- Series Collapse -->
					<div class="param-group flex items-center justify-between">
						<div>
							<div class="flex items-center gap-1.5">
								<label class="text-xs font-medium text-text-theme-primary">Series Collapse</label>
								<button onclick={() => expandedParam = expandedParam === 'series' ? null : 'series'} class="text-text-theme-tertiary hover:text-interactive transition-colors" title="Learn more">
									<Info size={12} />
								</button>
							</div>
							<p class="text-[11px] text-text-theme-tertiary mt-0.5 leading-relaxed">Group editions of the same series, showing only the newest.</p>
							{#if expandedParam === 'series'}
								<div class="text-[11px] text-text-theme-secondary bg-surface-secondary rounded px-3 py-2 mt-2 leading-relaxed max-w-lg">
									When enabled, multiple editions of the same publication series (e.g., annual reports) are collapsed into a single result showing the most recent edition. 4,758 series cover 65K documents (20% of the collection). The collapse happens after RRF scoring, so the best edition is selected. The result shows how many other editions exist.
								</div>
							{/if}
						</div>
						<button
							onclick={() => dirtyHybrid = { ...dirtyHybrid, series_collapse_enabled: !(hp('series_collapse_enabled') as boolean) }}
							disabled={config.locked}
							class="relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 {hp('series_collapse_enabled') ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}"
						>
							<span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 {hp('series_collapse_enabled') ? 'translate-x-5' : ''}"></span>
						</button>
					</div>
				<!-- Curated Lists Boost -->
					<div class="param-group">
						<div class="flex items-center justify-between mb-1">
							<div class="flex items-center gap-1.5">
								<label class="text-xs font-medium text-text-theme-primary">Curated Lists Boost</label>
								<button onclick={() => expandedParam = expandedParam === 'lists_boost' ? null : 'lists_boost'} class="text-text-theme-tertiary hover:text-interactive transition-colors" title="Learn more">
									<Info size={12} />
								</button>
							</div>
							<span class="text-xs font-mono text-interactive tabular-nums">{(hp('lists_boost_weight') as number)?.toFixed(1)}</span>
						</div>
						<p class="text-[11px] text-text-theme-tertiary mb-2 leading-relaxed">Extra weight for documents on editorially curated HSDL topic lists. Only ~3,500 documents have list assignments.</p>
						{#if expandedParam === 'lists_boost'}
							<div class="text-[11px] text-text-theme-secondary bg-surface-secondary rounded px-3 py-2 mb-2 leading-relaxed">
								HSDL maintains curated topic lists (e.g., "Countering Violent Extremism", "Maritime Domain", "Pandemics and Epidemics") with 102 lists covering 3,569 documents. Documents placed on these lists have been editorially selected as key resources for that topic. This boost rewards that curation.
							</div>
						{/if}
						<input type="range" min="0" max="5" step="0.1"
							value={hp('lists_boost_weight') as number}
							oninput={(e) => dirtyHybrid = { ...dirtyHybrid, lists_boost_weight: parseFloat((e.target as HTMLInputElement).value) }}
							disabled={config.locked}
							class="lab-slider w-full" aria-label="Curated Lists Boost" />
						<div class="flex justify-between text-[11px] text-text-theme-tertiary mt-1.5">
							<span>0 (off)</span><span>1.0</span><span>5.0 (strong)</span>
						</div>
					</div>

					<!-- Tab/Section Boost -->
					<div class="param-group">
						<div class="flex items-center justify-between mb-1">
							<div class="flex items-center gap-1.5">
								<label class="text-xs font-medium text-text-theme-primary">Tab/Section Boost</label>
								<button onclick={() => expandedParam = expandedParam === 'tab_boost' ? null : 'tab_boost'} class="text-text-theme-tertiary hover:text-interactive transition-colors" title="Learn more">
									<Info size={12} />
								</button>
							</div>
							<span class="text-xs font-mono text-interactive tabular-nums">{(hp('tab_section_boost_weight') as number)?.toFixed(1)}</span>
						</div>
						<p class="text-[11px] text-text-theme-tertiary mb-2 leading-relaxed">Extra weight for documents assigned to an editorial section. Covers ~173K documents (55% of the collection).</p>
						{#if expandedParam === 'tab_boost'}
							<div class="text-[11px] text-text-theme-secondary bg-surface-secondary rounded px-3 py-2 mb-2 leading-relaxed">
								Tab/Section categorizes documents into editorial sections (e.g., "Congressional reports", "Emergency management plans", "Theses and dissertations"). 173K documents (55% of the collection) have at least one section assignment. This boost gives a mild preference to categorized documents over uncategorized ones.
							</div>
						{/if}
						<input type="range" min="0" max="5" step="0.1"
							value={hp('tab_section_boost_weight') as number}
							oninput={(e) => dirtyHybrid = { ...dirtyHybrid, tab_section_boost_weight: parseFloat((e.target as HTMLInputElement).value) }}
							disabled={config.locked}
							class="lab-slider w-full" aria-label="Tab/Section Boost" />
						<div class="flex justify-between text-[11px] text-text-theme-tertiary mt-1.5">
							<span>0 (off)</span><span>1.0</span><span>5.0 (strong)</span>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- ═══ Synonyms ═══ -->
		<div class="card overflow-hidden">
			<button onclick={() => showSynonyms = !showSynonyms} class="section-header w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-secondary transition-colors">
				<h2 class="text-sm font-semibold text-text-theme-primary">
					Query Synonyms
					<span class="font-normal text-text-theme-tertiary ml-1.5 text-xs">({Object.keys(currentSynonyms()).length})</span>
				</h2>
				<ChevronDown size={16} class="text-text-theme-tertiary transition-transform duration-200 {showSynonyms ? '' : '-rotate-90'}" />
			</button>
			{#if showSynonyms}
				<div class="border-t border-theme px-4 pb-4 pt-3">
					<p class="text-[11px] text-text-theme-tertiary mb-3 leading-relaxed">When someone searches for a term on the left, results for the terms on the right are also included. Works both ways for best results.</p>
					{#if Object.keys(currentSynonyms()).length === 0}
						<div class="py-6 text-center">
							<BookOpen size={24} class="mx-auto mb-2 text-text-theme-tertiary opacity-40" />
							<p class="text-xs text-text-theme-tertiary">No synonyms defined. Add pairs below to expand search coverage.</p>
						</div>
					{:else}
						<div class="space-y-0 max-h-80 overflow-y-auto rounded border border-theme">
							{#each Object.entries(currentSynonyms()) as [term, expansions], i (term)}
								<div class="flex items-center gap-3 text-xs py-2.5 px-3 {i > 0 ? 'border-t border-theme' : ''} hover:bg-surface-secondary transition-colors">
									<span class="font-mono font-medium text-text-theme-primary min-w-[120px]">{term}</span>
									<span class="text-text-theme-tertiary select-none">&rarr;</span>
									<span class="text-text-theme-secondary flex-1">{expansions.join(', ')}</span>
									{#if !config.locked}
										<button onclick={() => removeSynonym(term)} class="text-red-400 hover:text-red-500 shrink-0 transition-colors p-0.5">&times;</button>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
					{#if !config.locked}
						<div class="flex gap-2 mt-3">
							<input bind:value={newSynTerm} class="input text-xs py-1.5 w-32" placeholder="Term" />
							<input bind:value={newSynExpansions} class="input text-xs py-1.5 flex-1" placeholder="Expansions (comma-separated)" onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSynonym(); } }} />
							<button onclick={addSynonym} class="btn btn-outline text-xs py-1.5 px-3">Add</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- ═══ Excluded Terms ═══ -->
		<div class="card overflow-hidden">
			<button onclick={() => showExcluded = !showExcluded} class="section-header w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-secondary transition-colors">
				<h2 class="text-sm font-semibold text-text-theme-primary">
					Excluded Terms
					<span class="font-normal text-text-theme-tertiary ml-1.5 text-xs">({currentExcluded().length})</span>
				</h2>
				<ChevronDown size={16} class="text-text-theme-tertiary transition-transform duration-200 {showExcluded ? '' : '-rotate-90'}" />
			</button>
			{#if showExcluded}
				<div class="border-t border-theme px-4 pb-4 pt-3">
					<p class="text-[11px] text-text-theme-tertiary mb-3 leading-relaxed">Documents whose title contains these terms are filtered from search results. Used for classification markings like FOUO.</p>
					{#if currentExcluded().length === 0}
						<div class="py-6 text-center">
							<Ban size={24} class="mx-auto mb-2 text-text-theme-tertiary opacity-40" />
							<p class="text-xs text-text-theme-tertiary">No excluded terms. Add terms below to filter them from results.</p>
						</div>
					{:else}
						<div class="flex flex-wrap gap-1.5">
							{#each currentExcluded() as term (term)}
								<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 transition-colors">
									{term}
									{#if !config.locked}
										<button onclick={() => removeExcludedTerm(term)} class="hover:text-red-900 dark:hover:text-red-100 transition-colors ml-0.5">&times;</button>
									{/if}
								</span>
							{/each}
						</div>
					{/if}
					{#if !config.locked}
						<div class="flex gap-2 mt-3">
							<input bind:value={newExcludedTerm} class="input text-xs py-1.5 flex-1" placeholder="Term to exclude" onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExcludedTerm(); } }} />
							<button onclick={addExcludedTerm} class="btn btn-outline text-xs py-1.5 px-3">Add</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- ═══ Live Preview ═══ -->
		<div class="card overflow-hidden">
			<button onclick={() => showPreview = !showPreview} class="section-header w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-secondary transition-colors">
				<h2 class="text-sm font-semibold text-text-theme-primary">Live Preview</h2>
				<ChevronDown size={16} class="text-text-theme-tertiary transition-transform duration-200 {showPreview ? '' : '-rotate-90'}" />
			</button>
			{#if showPreview}
				<div class="border-t border-theme px-4 pb-4 pt-3">
					<p class="text-[11px] text-text-theme-tertiary mb-3 leading-relaxed">Type a query to compare results between the active config and your current settings. <kbd class="kbd">Cmd+Enter</kbd> to run.</p>
					<div class="flex gap-2 mb-4">
						<div class="relative flex-1">
							<input bind:value={previewQuery} aria-label="Search preview query" class="input text-xs py-1.5 pr-8 w-full" placeholder="Try a search query..." onkeydown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); runPreview(); } }} />
							<Search class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-theme-tertiary pointer-events-none" />
						</div>
						<button onclick={runPreview} disabled={previewing || !previewQuery.trim()} class="btn btn-primary text-xs py-1.5 px-3">
							{#if previewing}Running...{:else}Preview{/if}
						</button>
					</div>

					{#if activePreview && experimentalPreview}
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<!-- Active config results -->
							<div>
								<h3 class="text-[11px] font-semibold text-text-theme-secondary mb-2 uppercase tracking-wider flex items-center gap-2">
									Active Config
									<span class="font-mono font-normal text-green-600">{activePreview.timing_ms}ms</span>
								</h3>
								<div class="space-y-1">
									{#each activePreview.results as r (r.uuid)}
										<div class="text-xs py-2 px-2.5 rounded bg-surface-secondary">
											<div class="flex items-baseline gap-1.5">
												<span class="text-text-theme-tertiary font-mono text-[10px] tabular-nums">#{r.rank}</span>
												<span class="text-text-theme-primary leading-snug">{r.title?.slice(0, 80)}{(r.title?.length ?? 0) > 80 ? '...' : ''}</span>
											</div>
											<div class="flex gap-1 mt-1">
												{#each r.matched_by as badge}
													<span class="text-[9px] px-1.5 py-0.5 rounded bg-interactive/10 text-interactive font-medium">{badge}</span>
												{/each}
												<span class="text-[9px] text-text-theme-tertiary ml-auto tabular-nums">{r.rrf_score?.toFixed(4)}</span>
											</div>
										</div>
									{/each}
									{#if activePreview.results.length === 0}
										<p class="text-xs text-text-theme-tertiary text-center py-4">No results</p>
									{/if}
								</div>
							</div>
							<!-- Experimental config results -->
							<div>
								<h3 class="text-[11px] font-semibold text-text-theme-secondary mb-2 uppercase tracking-wider flex items-center gap-2">
									This Config
									<span class="font-mono font-normal text-blue-500">{experimentalPreview.timing_ms}ms</span>
								</h3>
								<div class="space-y-1">
									{#each experimentalPreview.results as r (r.uuid)}
										{@const activeRank = activePreview.results.find(a => a.uuid === r.uuid)?.rank}
										{@const rankDelta = activeRank ? activeRank - r.rank : null}
										<div class="text-xs py-2 px-2.5 rounded bg-surface-secondary {!activeRank ? 'ring-1 ring-blue-400/40' : ''}">
											<div class="flex items-baseline gap-1.5">
												<span class="text-text-theme-tertiary font-mono text-[10px] tabular-nums">#{r.rank}</span>
												<span class="text-text-theme-primary leading-snug">{r.title?.slice(0, 80)}{(r.title?.length ?? 0) > 80 ? '...' : ''}</span>
											</div>
											<div class="flex gap-1 mt-1">
												{#each r.matched_by as badge}
													<span class="text-[9px] px-1.5 py-0.5 rounded bg-interactive/10 text-interactive font-medium">{badge}</span>
												{/each}
												{#if rankDelta !== null && rankDelta !== 0}
													<span class="text-[9px] ml-auto font-medium tabular-nums {rankDelta > 0 ? 'text-green-600' : 'text-red-500'}">
														{rankDelta > 0 ? `+${rankDelta}` : rankDelta}
													</span>
												{:else if !activeRank}
													<span class="text-[9px] ml-auto font-medium text-blue-500">new</span>
												{:else}
													<span class="text-[9px] text-text-theme-tertiary ml-auto tabular-nums">{r.rrf_score?.toFixed(4)}</span>
												{/if}
											</div>
										</div>
									{/each}
									{#if experimentalPreview.results.length === 0}
										<p class="text-xs text-text-theme-tertiary text-center py-4">No results</p>
									{/if}
								</div>
							</div>
						</div>
					{:else if previewError}
						<div class="py-4 px-4 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
							<p class="text-xs text-red-700 dark:text-red-300">{previewError}</p>
						</div>
					{:else}
						<div class="py-8 text-center">
							<Search size={24} class="mx-auto mb-2 text-text-theme-tertiary opacity-30" />
							<p class="text-xs text-text-theme-tertiary">Enter a query above and press Preview to compare search results.</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
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

	<!-- Save toast -->
	{#if saveToastVisible}
		<div class="fixed bottom-6 right-6 z-50 save-toast {saveToastType === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
			{#if saveToastType === 'success'}<Check size={14} />{/if}
			{saveToastMessage}
		</div>
	{/if}
</div>

<style>
	/* Custom slider styling */
	.lab-slider {
		-webkit-appearance: none;
		appearance: none;
		height: 6px;
		border-radius: 3px;
		background: var(--color-gray-300);
		outline: none;
		cursor: pointer;
	}

	.lab-slider:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.lab-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--color-interactive);
		border: 2px solid var(--color-surface-elevated);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
		cursor: pointer;
		transition: transform 150ms ease, box-shadow 150ms ease;
	}

	.lab-slider::-webkit-slider-thumb:hover {
		transform: scale(1.15);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
	}

	.lab-slider::-webkit-slider-thumb:active {
		transform: scale(1.05);
	}

	.lab-slider:focus-visible::-webkit-slider-thumb {
		box-shadow: 0 0 0 3px var(--color-interactive), 0 0 0 5px rgba(0, 0, 0, 0.1);
	}

	.lab-slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--color-interactive);
		border: 2px solid var(--color-surface-elevated);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
		cursor: pointer;
		transition: transform 150ms ease, box-shadow 150ms ease;
	}

	.lab-slider::-moz-range-thumb:hover {
		transform: scale(1.15);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
	}

	.lab-slider::-moz-range-track {
		height: 6px;
		border-radius: 3px;
		background: var(--color-gray-300);
	}

	/* Param group visual separation */
	.param-group + .param-group {
		padding-top: 0.25rem;
		border-top: 1px solid var(--color-border);
	}

	/* Save toast animation */
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

	/* Section header focus state */
	.section-header:focus-visible {
		outline: none;
		box-shadow: inset 0 0 0 2px var(--color-interactive);
	}
</style>
