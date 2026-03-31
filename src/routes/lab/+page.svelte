<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { inkApi } from '$lib/services/ink-api';
	import type { SearchConfigDetail, SearchConfigSummary, PreviewResponse } from '$lib/services/ink-api';
	import { Lock, Copy, Trash2, Zap, ChevronDown, ChevronRight, Search, Info, Plus, Check } from 'lucide-svelte';

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

	// Collapsible sections
	let showRanking = $state(true);
	let showSynonyms = $state(false);
	let showExcluded = $state(false);
	let showDefaults = $state(false);
	let showPreview = $state(true);

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
	const detailQuery = createQuery({
		queryKey: ['ink', 'search_config', selectedId],
		queryFn: () => selectedId ? inkApi.getSearchConfig(selectedId) : Promise.reject('no id'),
		enabled: !!selectedId
	});

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
		try {
			// Run with active config
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
				<button onclick={() => clearDirty()} class="btn text-xs py-1 px-2.5">Revert</button>
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
		<form onsubmit={(e) => { e.preventDefault(); handleCreate(); }} class="card p-3 flex gap-2 items-end">
			<div class="flex-1">
				<label class="text-xs text-text-theme-secondary block mb-1">{cloneSourceId ? 'Clone as' : 'New config name'}</label>
				<input bind:value={newName} class="input text-xs py-1.5 w-full" placeholder="e.g., Experiment March 2026" />
			</div>
			<button type="submit" class="btn btn-primary text-xs py-1.5 px-3">Create</button>
			<button type="button" onclick={() => showCreate = false} class="btn text-xs py-1.5 px-3">Cancel</button>
		</form>
	{/if}

	<!-- Config selector -->
	{#if $configsQuery.data}
		<div class="flex gap-2 flex-wrap">
			{#each $configsQuery.data as c (c.id)}
				<button
					onclick={() => selectConfig(c.id)}
					class="px-3 py-1.5 rounded-full text-xs font-medium border transition-all
						{selectedId === c.id ? 'border-[var(--color-interactive)] bg-[var(--color-interactive)]/10 text-[var(--color-interactive)]' : 'border-[var(--color-border)] text-text-theme-secondary hover:border-[var(--color-interactive)]/50'}
						{c.active ? 'ring-2 ring-green-500/30' : ''}"
				>
					{#if c.locked}<Lock size={10} class="inline mr-1 opacity-60" />{/if}
					{c.name}
					{#if c.active}<span class="ml-1 text-green-600 text-[10px] font-semibold">LIVE</span>{/if}
				</button>
			{/each}
		</div>
	{/if}

	{#if config}
		<!-- Config info bar -->
		<div class="flex items-center gap-3 text-xs text-text-theme-tertiary">
			{#if config.locked}
				<span class="text-amber-600 font-medium"><Lock size={12} class="inline mr-0.5" /> Locked -- clone to experiment</span>
			{/if}
			{#if !config.active}
				<button onclick={() => $activateMutation.mutate(config.id)} class="text-green-600 hover:text-green-700 font-medium">
					<Zap size={12} class="inline mr-0.5" /> Activate this config
				</button>
			{:else}
				<span class="text-green-600 font-medium"><Check size={12} class="inline mr-0.5" /> Currently live</span>
			{/if}
			{#if !config.active && !config.locked}
				<button onclick={() => $deleteMutation.mutate(config.id)} class="text-red-500 hover:text-red-600 ml-auto">
					<Trash2 size={12} class="inline mr-0.5" /> Delete
				</button>
			{/if}
			<button onclick={() => handleClone(config.id)} class="text-text-theme-secondary hover:text-text-theme-primary {config.active && !config.locked ? 'ml-auto' : ''}">
				<Copy size={12} class="inline mr-0.5" /> Clone
			</button>
		</div>

		<!-- ═══ Ranking & Relevance ═══ -->
		<div class="card">
			<button onclick={() => showRanking = !showRanking} class="w-full flex items-center justify-between p-3 text-left">
				<h2 class="text-sm font-semibold text-text-theme-primary">Ranking & Relevance</h2>
				{#if showRanking}<ChevronDown size={16} />{:else}<ChevronRight size={16} />{/if}
			</button>
			{#if showRanking}
				<div class="px-3 pb-4 space-y-5">
					<!-- RRF K -->
					<div>
						<div class="flex items-center justify-between mb-1">
							<label class="text-xs font-medium text-text-theme-primary">Ranking Smoothness (RRF K)</label>
							<span class="text-xs font-mono text-text-theme-secondary">{hp('rrf_k')}</span>
						</div>
						<p class="text-[11px] text-text-theme-tertiary mb-2">Lower values make the top-ranked results matter more. Higher values flatten the ranking so #1 and #10 have similar weight.</p>
						<input type="range" min="1" max="200" step="1"
							value={hp('rrf_k') as number}
							oninput={(e) => dirtyHybrid = { ...dirtyHybrid, rrf_k: parseInt((e.target as HTMLInputElement).value) }}
							disabled={config.locked}
							class="w-full accent-[var(--color-interactive)]" />
						<div class="flex justify-between text-[10px] text-text-theme-tertiary">
							<span>1 (sharp)</span><span>60 (default)</span><span>200 (flat)</span>
						</div>
					</div>

					<!-- Title Boost -->
					<div>
						<div class="flex items-center justify-between mb-1">
							<label class="text-xs font-medium text-text-theme-primary">Title Match Boost</label>
							<span class="text-xs font-mono text-text-theme-secondary">{(hp('title_boost_weight') as number)?.toFixed(1)}</span>
						</div>
						<p class="text-[11px] text-text-theme-tertiary mb-2">Extra weight when a document's title contains the search terms. 0 disables, 1.0 is normal, higher amplifies.</p>
						<input type="range" min="0" max="5" step="0.1"
							value={hp('title_boost_weight') as number}
							oninput={(e) => dirtyHybrid = { ...dirtyHybrid, title_boost_weight: parseFloat((e.target as HTMLInputElement).value) }}
							disabled={config.locked}
							class="w-full accent-[var(--color-interactive)]" />
						<div class="flex justify-between text-[10px] text-text-theme-tertiary">
							<span>0 (off)</span><span>1.0 (default)</span><span>5.0 (strong)</span>
						</div>
					</div>

					<!-- Subject Boost -->
					<div>
						<div class="flex items-center justify-between mb-1">
							<label class="text-xs font-medium text-text-theme-primary">Subject Heading Boost</label>
							<span class="text-xs font-mono text-text-theme-secondary">{(hp('subject_boost_weight') as number)?.toFixed(1)}</span>
						</div>
						<p class="text-[11px] text-text-theme-tertiary mb-2">Extra weight when a document's MARC subject headings match the query. Helps surface well-cataloged documents.</p>
						<input type="range" min="0" max="5" step="0.1"
							value={hp('subject_boost_weight') as number}
							oninput={(e) => dirtyHybrid = { ...dirtyHybrid, subject_boost_weight: parseFloat((e.target as HTMLInputElement).value) }}
							disabled={config.locked}
							class="w-full accent-[var(--color-interactive)]" />
						<div class="flex justify-between text-[10px] text-text-theme-tertiary">
							<span>0 (off)</span><span>1.0 (default)</span><span>5.0 (strong)</span>
						</div>
					</div>

					<!-- Fetch Depth -->
					<div>
						<div class="flex items-center justify-between mb-1">
							<label class="text-xs font-medium text-text-theme-primary">Candidate Depth</label>
							<span class="text-xs font-mono text-text-theme-secondary">{hp('fetch_size_multiplier')}x</span>
						</div>
						<p class="text-[11px] text-text-theme-tertiary mb-2">How many candidates to consider per page of results. Higher means more thorough ranking but slightly slower.</p>
						<input type="range" min="1" max="10" step="1"
							value={hp('fetch_size_multiplier') as number}
							oninput={(e) => dirtyHybrid = { ...dirtyHybrid, fetch_size_multiplier: parseInt((e.target as HTMLInputElement).value) }}
							disabled={config.locked}
							class="w-full accent-[var(--color-interactive)]" />
						<div class="flex justify-between text-[10px] text-text-theme-tertiary">
							<span>1x (fast)</span><span>3x (default)</span><span>10x (thorough)</span>
						</div>
					</div>

					<!-- Series Collapse -->
					<div class="flex items-center justify-between">
						<div>
							<label class="text-xs font-medium text-text-theme-primary">Series Collapse</label>
							<p class="text-[11px] text-text-theme-tertiary">Group editions of the same series, showing only the newest.</p>
						</div>
						<button
							onclick={() => dirtyHybrid = { ...dirtyHybrid, series_collapse_enabled: !(hp('series_collapse_enabled') as boolean) }}
							disabled={config.locked}
							class="relative w-10 h-5 rounded-full transition-colors {hp('series_collapse_enabled') ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}"
						>
							<span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform {hp('series_collapse_enabled') ? 'translate-x-5' : ''}"></span>
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- ═══ Synonyms ═══ -->
		<div class="card">
			<button onclick={() => showSynonyms = !showSynonyms} class="w-full flex items-center justify-between p-3 text-left">
				<h2 class="text-sm font-semibold text-text-theme-primary">
					Query Synonyms
					<span class="font-normal text-text-theme-tertiary ml-1">({Object.keys(currentSynonyms()).length})</span>
				</h2>
				{#if showSynonyms}<ChevronDown size={16} />{:else}<ChevronRight size={16} />{/if}
			</button>
			{#if showSynonyms}
				<div class="px-3 pb-4">
					<p class="text-[11px] text-text-theme-tertiary mb-3">When someone searches for a term on the left, results for the terms on the right are also included. Works both ways for best results.</p>
					<div class="space-y-1 max-h-64 overflow-y-auto">
						{#each Object.entries(currentSynonyms()) as [term, expansions] (term)}
							<div class="flex items-center gap-2 text-xs py-1 border-b border-[var(--color-border)]/30">
								<span class="font-mono font-medium text-text-theme-primary min-w-[120px]">{term}</span>
								<span class="text-text-theme-tertiary">&rarr;</span>
								<span class="text-text-theme-secondary flex-1">{expansions.join(', ')}</span>
								{#if !config.locked}
									<button onclick={() => removeSynonym(term)} class="text-red-400 hover:text-red-500 shrink-0">&times;</button>
								{/if}
							</div>
						{/each}
					</div>
					{#if !config.locked}
						<div class="flex gap-2 mt-3">
							<input bind:value={newSynTerm} class="input text-xs py-1 w-32" placeholder="Term" />
							<input bind:value={newSynExpansions} class="input text-xs py-1 flex-1" placeholder="Expansions (comma-separated)" />
							<button onclick={addSynonym} class="btn text-xs py-1 px-2">Add</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- ═══ Excluded Terms ═══ -->
		<div class="card">
			<button onclick={() => showExcluded = !showExcluded} class="w-full flex items-center justify-between p-3 text-left">
				<h2 class="text-sm font-semibold text-text-theme-primary">
					Excluded Terms
					<span class="font-normal text-text-theme-tertiary ml-1">({currentExcluded().length})</span>
				</h2>
				{#if showExcluded}<ChevronDown size={16} />{:else}<ChevronRight size={16} />{/if}
			</button>
			{#if showExcluded}
				<div class="px-3 pb-4">
					<p class="text-[11px] text-text-theme-tertiary mb-3">Documents whose title contains these terms are filtered from search results. Used for classification markings like FOUO.</p>
					<div class="flex flex-wrap gap-1.5">
						{#each currentExcluded() as term (term)}
							<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
								{term}
								{#if !config.locked}
									<button onclick={() => removeExcludedTerm(term)} class="hover:text-red-900">&times;</button>
								{/if}
							</span>
						{/each}
					</div>
					{#if !config.locked}
						<div class="flex gap-2 mt-3">
							<input bind:value={newExcludedTerm} class="input text-xs py-1 flex-1" placeholder="Term to exclude" onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExcludedTerm(); } }} />
							<button onclick={addExcludedTerm} class="btn text-xs py-1 px-2">Add</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- ═══ Live Preview ═══ -->
		<div class="card">
			<button onclick={() => showPreview = !showPreview} class="w-full flex items-center justify-between p-3 text-left">
				<h2 class="text-sm font-semibold text-text-theme-primary">Live Preview</h2>
				{#if showPreview}<ChevronDown size={16} />{:else}<ChevronRight size={16} />{/if}
			</button>
			{#if showPreview}
				<div class="px-3 pb-4">
					<p class="text-[11px] text-text-theme-tertiary mb-3">Type a query to compare results between the active config and your current settings. <kbd class="kbd">Cmd+Enter</kbd> to run.</p>
					<div class="flex gap-2 mb-4">
						<input bind:value={previewQuery} class="input text-xs py-1.5 flex-1" placeholder="Try a search query..." onkeydown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); runPreview(); } }} />
						<button onclick={runPreview} disabled={previewing || !previewQuery.trim()} class="btn btn-primary text-xs py-1.5 px-3">
							{#if previewing}Running...{:else}<Search size={14} class="mr-1" /> Preview{/if}
						</button>
					</div>

					{#if activePreview && experimentalPreview}
						<div class="grid grid-cols-2 gap-3">
							<!-- Active config results -->
							<div>
								<h3 class="text-[11px] font-semibold text-text-theme-secondary mb-1 uppercase tracking-wide">Active Config <span class="text-green-600">({activePreview.timing_ms}ms)</span></h3>
								<div class="space-y-1">
									{#each activePreview.results as r (r.uuid)}
										<div class="text-xs py-1.5 px-2 rounded bg-[var(--color-surface-secondary)]">
											<span class="text-text-theme-tertiary font-mono mr-1">#{r.rank}</span>
											<span class="text-text-theme-primary">{r.title?.slice(0, 80)}{(r.title?.length ?? 0) > 80 ? '...' : ''}</span>
											<div class="flex gap-1 mt-0.5">
												{#each r.matched_by as badge}
													<span class="text-[9px] px-1 py-0 rounded bg-[var(--color-interactive)]/10 text-[var(--color-interactive)]">{badge}</span>
												{/each}
												<span class="text-[9px] text-text-theme-tertiary ml-auto">{r.rrf_score?.toFixed(4)}</span>
											</div>
										</div>
									{/each}
								</div>
							</div>
							<!-- Experimental config results -->
							<div>
								<h3 class="text-[11px] font-semibold text-text-theme-secondary mb-1 uppercase tracking-wide">This Config <span class="text-blue-500">({experimentalPreview.timing_ms}ms)</span></h3>
								<div class="space-y-1">
									{#each experimentalPreview.results as r (r.uuid)}
										{@const activeRank = activePreview.results.find(a => a.uuid === r.uuid)?.rank}
										{@const rankDelta = activeRank ? activeRank - r.rank : null}
										<div class="text-xs py-1.5 px-2 rounded bg-[var(--color-surface-secondary)] {!activeRank ? 'ring-1 ring-blue-400/40' : ''}">
											<span class="text-text-theme-tertiary font-mono mr-1">#{r.rank}</span>
											<span class="text-text-theme-primary">{r.title?.slice(0, 80)}{(r.title?.length ?? 0) > 80 ? '...' : ''}</span>
											<div class="flex gap-1 mt-0.5">
												{#each r.matched_by as badge}
													<span class="text-[9px] px-1 py-0 rounded bg-[var(--color-interactive)]/10 text-[var(--color-interactive)]">{badge}</span>
												{/each}
												{#if rankDelta !== null && rankDelta !== 0}
													<span class="text-[9px] ml-auto {rankDelta > 0 ? 'text-green-600' : 'text-red-500'}">
														{rankDelta > 0 ? `+${rankDelta}` : rankDelta}
													</span>
												{:else if !activeRank}
													<span class="text-[9px] ml-auto text-blue-500">new</span>
												{:else}
													<span class="text-[9px] text-text-theme-tertiary ml-auto">{r.rrf_score?.toFixed(4)}</span>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Save status -->
		{#if $saveMutation.isSuccess}
			<p class="text-xs text-green-600">Saved successfully.</p>
		{/if}
		{#if $saveMutation.isError}
			<p class="text-xs text-red-500">Save failed: {$saveMutation.error?.message}</p>
		{/if}
	{:else if $detailQuery.isPending && selectedId}
		<div class="card p-8 text-center text-text-theme-tertiary text-sm">Loading config...</div>
	{:else if !$configsQuery.data?.length}
		<div class="card p-8 text-center text-text-theme-tertiary text-sm">No search configurations found. Create one to get started.</div>
	{/if}
</div>
