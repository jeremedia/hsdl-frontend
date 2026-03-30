<script lang="ts">
	import { base } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { inkApi } from '$lib/services/ink-api';
	import type { GoldenQuerySet } from '$lib/services/ink-api';
	import { ClipboardList, Plus, Play, CheckCircle2, BarChart3 } from 'lucide-svelte';

	const setsQuery = createQuery({
		queryKey: ['ink', 'golden_sets'],
		queryFn: () => inkApi.getGoldenSets()
	});

	let showCreate = $state(false);
	let newName = $state('');
	let newDesc = $state('');
	let creating = $state(false);

	async function handleCreate() {
		if (!newName.trim()) return;
		creating = true;
		try {
			await inkApi.createGoldenSet({ name: newName.trim(), description: newDesc.trim() || undefined });
			newName = '';
			newDesc = '';
			showCreate = false;
			$setsQuery.refetch();
		} finally {
			creating = false;
		}
	}

	function formatMetric(val: unknown): string {
		if (typeof val === 'number') return (val * 100).toFixed(1) + '%';
		return '--';
	}

	function formatDate(iso: string | null): string {
		if (!iso) return '--';
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Search Evaluation | INK</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold text-text-theme-primary">Search Evaluation</h1>
			<p class="text-xs text-text-theme-tertiary mt-0.5">Golden query sets for measuring search quality</p>
		</div>
		<button onclick={() => showCreate = !showCreate} class="btn btn-primary text-xs py-1 px-2.5">
			<Plus size={14} />
			New Set
		</button>
	</div>

	{#if showCreate}
		<form onsubmit={(e) => { e.preventDefault(); handleCreate(); }} class="card p-4 space-y-3">
			<div>
				<label for="set-name" class="text-xs font-medium text-text-theme-secondary block mb-1">Name</label>
				<input id="set-name" type="text" bind:value={newName} placeholder="March 2026 baseline" class="input text-xs py-1.5 w-full" />
			</div>
			<div>
				<label for="set-desc" class="text-xs font-medium text-text-theme-secondary block mb-1">Description (optional)</label>
				<input id="set-desc" type="text" bind:value={newDesc} placeholder="Initial evaluation of hybrid search" class="input text-xs py-1.5 w-full" />
			</div>
			<div class="flex gap-2">
				<button type="submit" disabled={!newName.trim() || creating} class="btn btn-primary text-xs py-1 px-3">
					{creating ? 'Creating...' : 'Create Set'}
				</button>
				<button type="button" onclick={() => showCreate = false} class="btn btn-outline text-xs py-1 px-3">Cancel</button>
			</div>
		</form>
	{/if}

	{#if $setsQuery.isPending}
		<div class="space-y-3">
			{#each Array(3) as _}
				<div class="card p-4">
					<div class="skeleton h-4 w-48 mb-2 rounded"></div>
					<div class="skeleton h-3 w-32 rounded"></div>
				</div>
			{/each}
		</div>
	{:else if $setsQuery.isError}
		<div class="card p-4 text-center">
			<p class="text-error text-sm mb-3">Failed to load: {$setsQuery.error.message}</p>
			<button onclick={() => $setsQuery.refetch()} class="btn btn-primary text-xs py-1 px-3">Retry</button>
		</div>
	{:else if $setsQuery.data}
		{#if $setsQuery.data.length === 0}
			<div class="card p-8 text-center">
				<ClipboardList size={32} class="mx-auto mb-3 text-text-theme-tertiary opacity-40" />
				<p class="text-sm text-text-theme-secondary mb-1">No evaluation sets yet</p>
				<p class="text-xs text-text-theme-tertiary">Create a set and add queries to start evaluating search quality.</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each $setsQuery.data as set}
					{@const run = set.latest_run}
					{@const metrics = run?.aggregate_metrics}
					<a href="{base}/eval/{set.id}" class="card p-4 block hover:border-interactive transition-colors">
						<div class="flex items-start justify-between">
							<div>
								<h2 class="text-sm font-semibold text-text-theme-primary">{set.name}</h2>
								{#if set.description}
									<p class="text-xs text-text-theme-tertiary mt-0.5">{set.description}</p>
								{/if}
								<div class="flex items-center gap-3 mt-2 text-xs text-text-theme-secondary">
									<span class="flex items-center gap-1"><ClipboardList size={12} /> {set.query_count} queries</span>
									{#if run}
										<span class="flex items-center gap-1">
											{#if run.rating_progress.complete}
												<CheckCircle2 size={12} class="text-success" />
											{:else}
												<Play size={12} />
											{/if}
											{run.rating_progress.rated}/{run.rating_progress.total} rated
										</span>
									{/if}
								</div>
							</div>
							{#if metrics?.ndcg_at_15}
								<div class="text-right flex-shrink-0">
									<div class="text-lg font-bold tabular-nums">{formatMetric(metrics.ndcg_at_15)}</div>
									<div class="text-[0.625rem] text-text-theme-tertiary uppercase tracking-wider">NDCG@15</div>
								</div>
							{/if}
						</div>
						{#if run}
							<div class="mt-2 pt-2 border-t border-theme flex items-center gap-4 text-[0.625rem] text-text-theme-tertiary">
								<span>Last run: {formatDate(run.completed_at)}</span>
								{#if run.label}<span>{run.label}</span>{/if}
								{#if metrics?.map}<span>MAP: {formatMetric(metrics.map)}</span>{/if}
								{#if metrics?.p_at_5}<span>P@5: {formatMetric(metrics.p_at_5)}</span>{/if}
							</div>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	{/if}

	<!-- How it works -->
	<div class="card p-5 space-y-4 mt-2">
		<h2 class="text-sm font-semibold text-text-theme-primary">How Search Evaluation Works</h2>

		<p class="text-xs text-text-theme-secondary leading-relaxed">
			This tool measures how well HSDL search serves real queries. When we change the search engine
			(new ranking signals, different weights, series collapsing), we need to know: did results get
			better or worse? Evaluation gives us numbers instead of guesses.
		</p>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div>
				<h3 class="text-xs font-semibold text-text-theme-primary mb-1">1. Create a Query Set</h3>
				<p class="text-[0.6875rem] text-text-theme-tertiary leading-relaxed">
					A set is a collection of test queries that represent how people actually search HSDL.
					Short keywords, full questions, misspellings, acronyms, broad topics. Import from a CSV
					or add queries one by one. Include expected docIDs when you know what should appear.
				</p>
			</div>
			<div>
				<h3 class="text-xs font-semibold text-text-theme-primary mb-1">2. Run and Rate</h3>
				<p class="text-[0.6875rem] text-text-theme-tertiary leading-relaxed">
					Click "Run Now" to execute every query against the live search engine. The system captures
					the top 15 results with their scores. Then rate each result on three dimensions:
					<span class="text-text-theme-secondary">relevance</span> (0-3),
					<span class="text-text-theme-secondary">intent match</span> (direct answer, supporting, background),
					and <span class="text-text-theme-secondary">failure flags</span> (too narrow, too broad, wrong context, etc.).
				</p>
			</div>
			<div>
				<h3 class="text-xs font-semibold text-text-theme-primary mb-1">3. Compare Runs</h3>
				<p class="text-[0.6875rem] text-text-theme-tertiary leading-relaxed">
					After a search change, run the same set again and compare. The system computes
					NDCG, MAP, and precision metrics automatically. The comparison view shows which queries
					improved, which regressed, and which failure modes shifted. Export to CSV anytime.
				</p>
			</div>
		</div>

		<div class="pt-2 border-t border-theme">
			<h3 class="text-xs font-semibold text-text-theme-primary mb-1.5">Rating Rubric</h3>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-[0.6875rem]">
				<div>
					<span class="text-text-theme-secondary font-medium">Relevance:</span>
					<span class="text-text-theme-tertiary">
						3 = directly answers, 2 = relevant but broader, 1 = weak connection, 0 = not relevant
					</span>
				</div>
				<div>
					<span class="text-text-theme-secondary font-medium">Intent:</span>
					<span class="text-text-theme-tertiary">
						Direct Answer (user stops searching), Supporting Info (helpful but partial), Background Info (loosely related)
					</span>
				</div>
				<div>
					<span class="text-text-theme-secondary font-medium">Failure Flags:</span>
					<span class="text-text-theme-tertiary">
						Overly Semantic, Keyword Overfit, Wrong Context, Too Narrow, Too Broad
					</span>
				</div>
			</div>
		</div>
	</div>
</div>
