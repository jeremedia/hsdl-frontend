<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { derived } from 'svelte/store';
	import { inkApi } from '$lib/services/ink-api';
	import type { GoldenQuery } from '$lib/services/ink-api';
	import { ArrowLeft, Plus, Play, Trash2, Upload, BarChart3, CheckCircle2, Edit2, Save, X } from 'lucide-svelte';

	let setId = $derived($page.params.id ?? '');
	const queryClient = useQueryClient();

	const setQuery = createQuery(
		derived(page, ($p) => {
			const id = $p.params.id ?? '';
			return {
				queryKey: ['ink', 'golden_set', id],
				queryFn: () => inkApi.getGoldenSet(id)
			};
		})
	);

	// Add query form
	let showAddQuery = $state(false);
	let newQueryText = $state('');
	let newExpectedIds = $state('');

	// Inline query editing
	let editingQueryId = $state<string | null>(null);
	let editQueryText = $state('');
	let editExpectedIds = $state('');
	let savingQueryId = $state<string | null>(null);

	// Run creation
	let runLabel = $state('');
	let running = $state(false);

	// CSV import
	let showImport = $state(false);
	let csvText = $state('');

	// Comparison selection
	let selectedRuns = $state<Set<string>>(new Set());

	function parseExpectedDocIds(value: string): number[] {
		return value.trim()
			? value.split(/[,\s]+/).map(Number).filter(n => !isNaN(n))
			: [];
	}

	async function handleAddQuery() {
		if (!newQueryText.trim()) return;
		const expectedIds = parseExpectedDocIds(newExpectedIds);
		await inkApi.addGoldenQuery(setId, { query_text: newQueryText.trim(), expected_doc_ids: expectedIds });
		newQueryText = '';
		newExpectedIds = '';
		showAddQuery = false;
		queryClient.invalidateQueries({ queryKey: ['ink', 'golden_set', setId] });
	}

	function startEditQuery(query: GoldenQuery) {
		editingQueryId = query.id;
		editQueryText = query.query_text;
		editExpectedIds = query.expected_doc_ids.join(', ');
	}

	function cancelEditQuery() {
		editingQueryId = null;
		editQueryText = '';
		editExpectedIds = '';
	}

	async function handleSaveQuery(queryId: string) {
		if (!editQueryText.trim()) return;
		savingQueryId = queryId;
		try {
			await inkApi.updateGoldenQuery(setId, queryId, {
				query_text: editQueryText.trim(),
				expected_doc_ids: parseExpectedDocIds(editExpectedIds)
			});
			cancelEditQuery();
			await queryClient.invalidateQueries({ queryKey: ['ink', 'golden_set', setId] });
		} finally {
			savingQueryId = null;
		}
	}

	async function handleDeleteQuery(queryId: string) {
		await inkApi.deleteGoldenQuery(setId, queryId);
		queryClient.invalidateQueries({ queryKey: ['ink', 'golden_set', setId] });
	}

	async function handleRun() {
		running = true;
		try {
			const run = await inkApi.createGoldenRun(setId, runLabel.trim() || undefined);
			runLabel = '';
			queryClient.invalidateQueries({ queryKey: ['ink', 'golden_set', setId] });
			goto(`${base}/eval/runs/${run.id}`);
		} finally {
			running = false;
		}
	}

	async function handleImportCsv() {
		if (!csvText.trim()) return;
		await inkApi.importGoldenQueries(setId, csvText);
		csvText = '';
		showImport = false;
		queryClient.invalidateQueries({ queryKey: ['ink', 'golden_set', setId] });
	}

	function toggleRunSelection(runId: string) {
		const next = new Set(selectedRuns);
		if (next.has(runId)) next.delete(runId);
		else if (next.size < 2) next.add(runId);
		selectedRuns = next;
	}

	let canCompare = $derived(selectedRuns.size === 2);
	let compareUrl = $derived(() => {
		const ids = Array.from(selectedRuns);
		return ids.length === 2 ? `${base}/eval/runs/${ids[0]}/compare/${ids[1]}` : '';
	});

	function formatMetric(val: unknown): string {
		if (typeof val === 'number') return (val * 100).toFixed(1) + '%';
		return '--';
	}

	function formatDate(iso: string | null): string {
		if (!iso) return '--';
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>{$setQuery.data?.name || 'Evaluation Set'} | INK</title>
</svelte:head>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center gap-2">
		<a href="{base}/eval" class="p-1 rounded hover:bg-surface-secondary transition-colors" aria-label="Back">
			<ArrowLeft size={16} />
		</a>
		{#if $setQuery.data}
			<div class="flex-1 min-w-0">
				<h1 class="text-lg font-bold text-text-theme-primary truncate">{$setQuery.data.name}</h1>
				{#if $setQuery.data.description}
					<p class="text-xs text-text-theme-tertiary truncate">{$setQuery.data.description}</p>
				{/if}
			</div>
		{/if}
	</div>

	{#if $setQuery.isPending}
		<div class="card p-4"><div class="skeleton h-4 w-48 rounded"></div></div>
	{:else if $setQuery.isError}
		<div class="card p-4 text-center">
			<p class="text-error text-sm mb-3">{$setQuery.error.message}</p>
			<button onclick={() => $setQuery.refetch()} class="btn btn-primary text-xs py-1 px-3">Retry</button>
		</div>
	{:else if $setQuery.data}
		{@const data = $setQuery.data}

		<!-- Queries Section -->
		<div class="card overflow-hidden">
			<div class="flex items-center justify-between px-4 py-2 bg-surface-secondary border-b border-theme">
				<h2 class="text-xs font-semibold text-text-theme-tertiary uppercase tracking-wider">
					Queries ({data.queries.length})
				</h2>
				<div class="flex gap-1.5">
					<button onclick={() => showImport = !showImport} class="btn btn-outline text-xs py-0.5 px-2">
						<Upload size={12} /> Import CSV
					</button>
					<button onclick={() => showAddQuery = !showAddQuery} class="btn btn-outline text-xs py-0.5 px-2">
						<Plus size={12} /> Add
					</button>
				</div>
			</div>

			{#if showImport}
				<div class="px-4 py-3 border-b border-theme bg-surface">
					<textarea bind:value={csvText} rows={4} placeholder="Paste CSV: Q#,Query,Expected Docs IDs List (1-3)" class="input text-xs w-full font-mono"></textarea>
					<div class="flex gap-2 mt-2">
						<button onclick={handleImportCsv} disabled={!csvText.trim()} class="btn btn-primary text-xs py-1 px-3">Import</button>
						<button onclick={() => showImport = false} class="btn btn-outline text-xs py-1 px-3">Cancel</button>
					</div>
				</div>
			{/if}

			{#if showAddQuery}
				<form onsubmit={(e) => { e.preventDefault(); handleAddQuery(); }} class="px-4 py-3 border-b border-theme bg-surface flex gap-2 items-end">
					<div class="flex-1">
						<input type="text" bind:value={newQueryText} placeholder="Query text" class="input text-xs py-1.5 w-full" />
					</div>
					<div class="w-40">
						<input type="text" bind:value={newExpectedIds} placeholder="Expected docIDs" class="input text-xs py-1.5 w-full" />
					</div>
					<button type="submit" disabled={!newQueryText.trim()} class="btn btn-primary text-xs py-1.5 px-3 flex-shrink-0">Add</button>
				</form>
			{/if}

			<div class="max-h-[400px] overflow-y-auto">
				{#each data.queries as query}
					<div class="px-4 py-1.5 border-b border-theme text-xs hover:bg-surface-secondary transition-colors group">
						{#if editingQueryId === query.id}
							<form onsubmit={(e) => { e.preventDefault(); handleSaveQuery(query.id); }} class="flex items-center gap-2">
								<span class="w-8 text-text-theme-tertiary tabular-nums flex-shrink-0">{query.position}</span>
								<input
									type="text"
									bind:value={editQueryText}
									class="input text-xs py-1 flex-1 min-w-0"
									aria-label="Query text"
								/>
								<input
									type="text"
									bind:value={editExpectedIds}
									placeholder="Expected docIDs"
									class="input text-xs py-1 w-40 flex-shrink-0"
									aria-label="Expected document IDs"
								/>
								<button
									type="submit"
									disabled={!editQueryText.trim() || savingQueryId === query.id}
									class="btn btn-primary text-xs py-1 px-2 flex-shrink-0"
									aria-label="Save query"
								>
									<Save size={12} />
									{savingQueryId === query.id ? 'Saving...' : 'Save'}
								</button>
								<button
									type="button"
									onclick={cancelEditQuery}
									disabled={savingQueryId === query.id}
									class="btn btn-outline text-xs py-1 px-2 flex-shrink-0"
									aria-label="Cancel query edit"
								>
									<X size={12} />
									Cancel
								</button>
							</form>
						{:else}
							<div class="flex items-center">
								<span class="w-8 text-text-theme-tertiary tabular-nums flex-shrink-0">{query.position}</span>
								<span class="flex-1 text-text-theme-primary truncate">{query.query_text}</span>
								{#if query.expected_doc_ids.length > 0}
									<span class="text-text-theme-tertiary ml-2 flex-shrink-0">{query.expected_doc_ids.length} expected</span>
								{/if}
								<button
									onclick={() => startEditQuery(query)}
									class="ml-2 p-1 rounded text-text-theme-tertiary hover:text-text-theme-primary"
									aria-label="Edit query"
									title="Edit query"
								>
									<Edit2 size={12} />
								</button>
								<button
									onclick={() => handleDeleteQuery(query.id)}
									class="ml-1 p-1 rounded text-text-theme-tertiary hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
									aria-label="Delete query"
								>
									<Trash2 size={12} />
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- Run Section -->
		<div class="card overflow-hidden">
			<div class="flex items-center justify-between px-4 py-2 bg-surface-secondary border-b border-theme">
				<h2 class="text-xs font-semibold text-text-theme-tertiary uppercase tracking-wider">
					Runs ({data.runs.length})
				</h2>
				<div class="flex items-center gap-2">
					{#if canCompare}
						<a href={compareUrl()} class="btn btn-outline text-xs py-0.5 px-2">
							<BarChart3 size={12} /> Compare
						</a>
					{/if}
				</div>
			</div>

			<!-- Run Now form -->
			<div class="px-4 py-2 border-b border-theme flex gap-2 items-center">
				<input type="text" bind:value={runLabel} placeholder="Run label (optional)" class="input text-xs py-1 flex-1" />
				<button onclick={handleRun} disabled={running || data.queries.length === 0} class="btn btn-primary text-xs py-1 px-3 flex-shrink-0">
					<Play size={12} />
					{running ? 'Running...' : 'Run Now'}
				</button>
			</div>

			{#if data.runs.length > 0}
				{#each data.runs as run}
					{@const metrics = run.aggregate_metrics}
					<div class="flex items-center px-4 py-2 border-b border-theme text-xs hover:bg-surface-secondary transition-colors">
						<input
							type="checkbox"
							checked={selectedRuns.has(run.id)}
							onchange={() => toggleRunSelection(run.id)}
							class="mr-3 flex-shrink-0"
							title="Select for comparison"
						/>
						<a href="{base}/eval/runs/{run.id}" class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<span class="font-medium text-text-theme-primary">{run.label || 'Untitled run'}</span>
								{#if run.rating_progress.complete}
									<CheckCircle2 size={12} class="text-success flex-shrink-0" />
								{/if}
							</div>
							<div class="flex items-center gap-3 mt-0.5 text-text-theme-tertiary">
								<span>{formatDate(run.completed_at)}</span>
								<span>{run.rating_progress.rated}/{run.rating_progress.total} rated</span>
								{#if metrics?.ndcg_at_15}
									<span>NDCG: {formatMetric(metrics.ndcg_at_15)}</span>
								{/if}
								{#if metrics?.map}
									<span>MAP: {formatMetric(metrics.map)}</span>
								{/if}
							</div>
						</a>
					</div>
				{/each}
			{:else}
				<div class="px-4 py-6 text-center text-xs text-text-theme-tertiary">
					No runs yet. Add queries and click "Run Now" to execute.
				</div>
			{/if}
		</div>
	{/if}
</div>
