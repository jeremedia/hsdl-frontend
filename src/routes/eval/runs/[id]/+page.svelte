<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { derived } from 'svelte/store';
	import { inkApi } from '$lib/services/ink-api';
	import type { GoldenQueryRunResult, RatingEntry, SearchResult } from '$lib/services/ink-api';
	import {
		ArrowLeft, Download, CheckCircle2, ChevronDown, ChevronRight,
		AlertTriangle, Gauge
	} from 'lucide-svelte';

	let runId = $derived($page.params.id ?? '');
	const queryClient = useQueryClient();

	const runQuery = createQuery(
		derived(page, ($p) => {
			const id = $p.params.id ?? '';
			return {
				queryKey: ['ink', 'golden_run', id],
				queryFn: () => inkApi.getGoldenRun(id)
			};
		})
	);

	// Rating mutation -- fires on every individual rating action
	const rateMutation = createMutation({
		mutationFn: ({ resultId, ratings, no_strong_matches }: {
			resultId: string;
			ratings: Record<string, RatingEntry>;
			no_strong_matches?: boolean;
		}) => inkApi.rateGoldenResult(resultId, { ratings, no_strong_matches }),
		onSuccess: (updated, variables) => {
			// Optimistically update the cached run data
			queryClient.setQueryData(['ink', 'golden_run', runId], (old: any) => {
				if (!old) return old;
				return {
					...old,
					results: old.results.map((r: GoldenQueryRunResult) =>
						r.id === variables.resultId
							? { ...r, ratings: updated.ratings, per_query_metrics: updated.per_query_metrics, rated_at: updated.rated_at }
							: r
					)
				};
			});
		}
	});

	// Local UI state
	let expandedQueryId = $state<string | null>(null);
	let exporting = $state(false);

	// Derived computed values from query data
	let results = $derived($runQuery.data?.results ?? []);

	let sortedResults = $derived(
		[...results].sort((a, b) => a.position - b.position)
	);

	let ratedCount = $derived(
		results.filter(r => r.rated_at !== null).length
	);

	let totalCount = $derived(results.length);

	let progressPct = $derived(
		totalCount > 0 ? Math.round((ratedCount / totalCount) * 100) : 0
	);

	let allRated = $derived(ratedCount === totalCount && totalCount > 0);

	let metrics = $derived($runQuery.data?.aggregate_metrics ?? {});

	// Find next unrated query for keyboard navigation
	function findNextUnrated(): string | null {
		const currentIdx = sortedResults.findIndex(r => r.id === expandedQueryId);
		// Search from current position forward, then wrap
		for (let i = 0; i < sortedResults.length; i++) {
			const idx = (currentIdx + 1 + i) % sortedResults.length;
			if (sortedResults[idx].rated_at === null) {
				return sortedResults[idx].id;
			}
		}
		return null;
	}

	// Check if a query result row has all 15 results rated
	function isQueryFullyRated(qr: GoldenQueryRunResult): boolean {
		if (!qr.results || qr.results.length === 0) return false;
		return qr.results.every(sr => {
			const key = String(sr.doc_id);
			const entry = qr.ratings[key];
			return entry && entry.relevance !== undefined && entry.relevance !== null;
		});
	}

	// Rating controls
	const RELEVANCE_LEVELS = [
		{ value: 3, label: '3', longLabel: 'Highly Relevant', color: 'bg-green-600 text-white', hoverColor: 'hover:bg-green-600 hover:text-white' },
		{ value: 2, label: '2', longLabel: 'Relevant', color: 'bg-green-400 text-white', hoverColor: 'hover:bg-green-400 hover:text-white' },
		{ value: 1, label: '1', longLabel: 'Slightly Relevant', color: 'bg-yellow-500 text-white', hoverColor: 'hover:bg-yellow-500 hover:text-white' },
		{ value: 0, label: '0', longLabel: 'Not Relevant', color: 'bg-red-500 text-white', hoverColor: 'hover:bg-red-500 hover:text-white' }
	] as const;

	const INTENT_OPTIONS = [
		'Direct Answer',
		'Supporting Info',
		'Background Info',
		'Not Relevant'
	] as const;

	const FAILURE_FLAGS = [
		'Overly Semantic',
		'Keyword Overfit',
		'Wrong Context',
		'Too Narrow',
		'Too Broad'
	] as const;

	function getExistingRating(qr: GoldenQueryRunResult, docId: number): RatingEntry {
		const key = String(docId);
		return qr.ratings[key] ?? { relevance: -1, intent: null, failure: null };
	}

	function handleRelevanceClick(qr: GoldenQueryRunResult, sr: SearchResult, value: number) {
		const key = String(sr.doc_id);
		const existing = qr.ratings[key] ?? { relevance: -1, intent: null, failure: null };
		const updated = { ...existing, relevance: value };
		const newRatings = { ...qr.ratings, [key]: updated };
		$rateMutation.mutate({ resultId: qr.id, ratings: newRatings });
	}

	function handleIntentChange(qr: GoldenQueryRunResult, sr: SearchResult, intent: string | null) {
		const key = String(sr.doc_id);
		const existing = qr.ratings[key] ?? { relevance: -1, intent: null, failure: null };
		const updated = { ...existing, intent };
		const newRatings = { ...qr.ratings, [key]: updated };
		$rateMutation.mutate({ resultId: qr.id, ratings: newRatings });
	}

	function handleFailureChange(qr: GoldenQueryRunResult, sr: SearchResult, failure: string | null) {
		const key = String(sr.doc_id);
		const existing = qr.ratings[key] ?? { relevance: -1, intent: null, failure: null };
		const updated = { ...existing, failure: existing.failure === failure ? null : failure };
		const newRatings = { ...qr.ratings, [key]: updated };
		$rateMutation.mutate({ resultId: qr.id, ratings: newRatings });
	}

	function handleNoStrongMatches(qr: GoldenQueryRunResult, checked: boolean) {
		$rateMutation.mutate({ resultId: qr.id, ratings: qr.ratings, no_strong_matches: checked });
	}

	function toggleQuery(queryId: string) {
		expandedQueryId = expandedQueryId === queryId ? null : queryId;
	}

	// Keyboard navigation
	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

		if (e.key === 'n') {
			e.preventDefault();
			const next = findNextUnrated();
			if (next) {
				expandedQueryId = next;
				// Scroll the expanded row into view
				requestAnimationFrame(() => {
					const el = document.getElementById(`query-${next}`);
					el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
				});
			}
		}
		if (e.key === 'Escape') {
			expandedQueryId = null;
		}
	}

	// CSV export
	async function handleExport() {
		exporting = true;
		try {
			const blob = await inkApi.exportGoldenRunCsv(runId);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `golden-run-${runId}.csv`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			exporting = false;
		}
	}

	// Formatting helpers
	function formatMetric(val: unknown): string {
		if (typeof val === 'number') return (val * 100).toFixed(1) + '%';
		return '--';
	}

	function formatDate(iso: string | null): string {
		if (!iso) return '--';
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	function matchedByBadge(method: string): string {
		if (method === 'keyword') return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
		if (method === 'semantic') return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
		if (method === 'subject') return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
		return 'bg-surface-secondary text-text-theme-secondary';
	}
</script>

<svelte:head>
	<title>{$runQuery.data?.label || 'Run Detail'} | Search Evaluation | INK</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center gap-2">
		<a
			href="{base}/eval/{$runQuery.data?.set_id ?? ''}"
			class="p-1 rounded hover:bg-surface-secondary transition-colors"
			aria-label="Back to evaluation set"
		>
			<ArrowLeft size={16} />
		</a>
		{#if $runQuery.data}
			<div class="flex-1 min-w-0">
				<h1 class="text-lg font-bold text-text-theme-primary truncate">
					{$runQuery.data.label || $runQuery.data.set_name}
				</h1>
				<p class="text-xs text-text-theme-tertiary truncate">
					{$runQuery.data.set_name}
					{#if $runQuery.data.completed_at}
						 -- {formatDate($runQuery.data.completed_at)}
					{/if}
				</p>
			</div>
			<div class="flex items-center gap-2 flex-shrink-0">
				<button
					onclick={handleExport}
					disabled={exporting}
					class="btn btn-outline text-xs py-1 px-2.5"
					title="Export ratings as CSV"
				>
					<Download size={13} />
					{exporting ? 'Exporting...' : 'CSV'}
				</button>
			</div>
		{/if}
	</div>

	{#if $runQuery.isPending}
		<div class="space-y-3">
			<div class="card p-4"><div class="skeleton h-6 w-64 rounded"></div></div>
			{#each Array(5) as _}
				<div class="card p-3">
					<div class="skeleton h-4 w-48 mb-2 rounded"></div>
					<div class="skeleton h-3 w-32 rounded"></div>
				</div>
			{/each}
		</div>
	{:else if $runQuery.isError}
		<div class="card p-4 text-center">
			<p class="text-error text-sm mb-3">{$runQuery.error.message}</p>
			<button onclick={() => $runQuery.refetch()} class="btn btn-primary text-xs py-1 px-3">Retry</button>
		</div>
	{:else if $runQuery.data}
		<!-- Progress + Aggregate Metrics -->
		<div class="card p-4">
			<div class="flex items-center justify-between mb-2">
				<div class="flex items-center gap-3">
					<span class="text-sm font-semibold text-text-theme-primary tabular-nums">
						{ratedCount}/{totalCount} queries rated
					</span>
					{#if allRated}
						<CheckCircle2 size={16} class="text-success" />
					{/if}
				</div>
				<span class="text-xs text-text-theme-tertiary">
					Press <kbd class="kbd">n</kbd> for next unrated &middot; <kbd class="kbd">Esc</kbd> to collapse
				</span>
			</div>

			<!-- Progress bar -->
			<div class="w-full h-2 bg-surface-secondary rounded-full overflow-hidden mb-3">
				<div
					class="h-full rounded-full transition-all duration-500 {allRated ? 'bg-success' : 'bg-interactive'}"
					style="width: {progressPct}%"
				></div>
			</div>

			<!-- Aggregate metrics (shown when all rated) -->
			{#if allRated && Object.keys(metrics).length > 0}
				<div class="flex items-center gap-6 pt-2 border-t border-theme">
					{#if metrics.ndcg_at_15 !== undefined}
						<div class="text-center">
							<div class="text-2xl font-bold tabular-nums text-text-theme-primary">{formatMetric(metrics.ndcg_at_15)}</div>
							<div class="text-[0.625rem] text-text-theme-tertiary uppercase tracking-wider">NDCG@15</div>
						</div>
					{/if}
					{#if metrics.map !== undefined}
						<div class="text-center">
							<div class="text-lg font-semibold tabular-nums text-text-theme-primary">{formatMetric(metrics.map)}</div>
							<div class="text-[0.625rem] text-text-theme-tertiary uppercase tracking-wider">MAP</div>
						</div>
					{/if}
					{#if metrics.p_at_5 !== undefined}
						<div class="text-center">
							<div class="text-lg font-semibold tabular-nums text-text-theme-primary">{formatMetric(metrics.p_at_5)}</div>
							<div class="text-[0.625rem] text-text-theme-tertiary uppercase tracking-wider">P@5</div>
						</div>
					{/if}
					{#if $runQuery.data.no_strong_matches_count > 0}
						<div class="text-center">
							<div class="text-lg font-semibold tabular-nums text-warning">{$runQuery.data.no_strong_matches_count}</div>
							<div class="text-[0.625rem] text-text-theme-tertiary uppercase tracking-wider">No Strong Matches</div>
						</div>
					{/if}
				</div>
			{:else if !allRated && Object.keys(metrics).length > 0}
				<!-- Partial metrics preview -->
				<div class="flex items-center gap-4 pt-2 border-t border-theme text-text-theme-tertiary">
					<span class="text-xs">Partial metrics:</span>
					{#if metrics.ndcg_at_15 !== undefined}
						<span class="text-xs tabular-nums">NDCG@15 {formatMetric(metrics.ndcg_at_15)}</span>
					{/if}
					{#if metrics.map !== undefined}
						<span class="text-xs tabular-nums">MAP {formatMetric(metrics.map)}</span>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Query List -->
		<div class="space-y-1">
			{#each sortedResults as qr (qr.id)}
				{@const isExpanded = expandedQueryId === qr.id}
				{@const fullyRated = isQueryFullyRated(qr)}
				{@const ratedResultCount = qr.results.filter(sr => {
					const entry = qr.ratings[String(sr.doc_id)];
					return entry && entry.relevance !== undefined && entry.relevance !== null && entry.relevance >= 0;
				}).length}

				<div id="query-{qr.id}" class="card overflow-hidden">
					<!-- Query row (always visible) -->
					<button
						onclick={() => toggleQuery(qr.id)}
						class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-secondary/50 transition-colors"
					>
						<span class="flex-shrink-0 text-text-theme-tertiary">
							{#if isExpanded}
								<ChevronDown size={14} />
							{:else}
								<ChevronRight size={14} />
							{/if}
						</span>

						<span class="w-8 text-xs text-text-theme-tertiary tabular-nums flex-shrink-0">
							{qr.position}
						</span>

						<span class="flex-1 text-sm text-text-theme-primary truncate font-medium">
							{qr.query_text}
						</span>

						<!-- Rated indicator -->
						<span class="flex items-center gap-2 flex-shrink-0">
							{#if qr.no_strong_matches}
								<span class="text-[0.625rem] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning font-medium" title="No strong matches">
									<AlertTriangle size={10} class="inline -mt-px" /> NSM
								</span>
							{/if}

							{#if fullyRated}
								<CheckCircle2 size={14} class="text-success" />
							{:else}
								<span class="text-xs text-text-theme-tertiary tabular-nums">
									{ratedResultCount}/{qr.results.length}
								</span>
							{/if}

							<!-- Per-query NDCG (once fully rated) -->
							{#if fullyRated && qr.per_query_metrics?.ndcg_at_15 !== undefined}
								<span class="text-xs font-semibold tabular-nums text-text-theme-secondary" title="NDCG@15 for this query">
									{formatMetric(qr.per_query_metrics.ndcg_at_15)}
								</span>
							{/if}
						</span>
					</button>

					<!-- Expanded: results table + rating controls -->
					{#if isExpanded}
						<div class="border-t border-theme">
							<!-- No Strong Matches checkbox -->
							<div class="px-4 py-2 bg-surface-secondary/30 border-b border-theme flex items-center gap-2">
								<label class="flex items-center gap-2 text-xs text-text-theme-secondary cursor-pointer">
									<input
										type="checkbox"
										checked={qr.no_strong_matches}
										onchange={(e) => handleNoStrongMatches(qr, (e.target as HTMLInputElement).checked)}
										class="rounded border-theme"
									/>
									"No strong matches" banner appeared for this query
								</label>
							</div>

							<!-- Results table -->
							<div class="overflow-x-auto">
								<table class="w-full text-xs">
									<thead>
										<tr class="border-b border-theme text-text-theme-tertiary bg-surface-secondary/20">
											<th class="text-left py-1.5 pl-4 pr-2 font-medium w-8">#</th>
											<th class="text-left py-1.5 px-2 font-medium">Title</th>
											<th class="text-left py-1.5 px-2 font-medium w-20">Matched</th>
											<th class="text-center py-1.5 px-2 font-medium w-10">RRF</th>
											<th class="text-center py-1.5 px-1 font-medium" style="min-width: 160px;">Relevance</th>
											<th class="text-center py-1.5 px-1 font-medium" style="min-width: 120px;">Intent</th>
											<th class="text-center py-1.5 px-1 font-medium" style="min-width: 100px;">Failure</th>
										</tr>
									</thead>
									<tbody>
										{#each qr.results as sr, idx (sr.doc_id)}
											{@const rating = getExistingRating(qr, sr.doc_id)}
											{@const hasRelevance = rating.relevance >= 0}
											<tr class="border-b border-theme last:border-0 {hasRelevance ? '' : 'bg-surface-secondary/10'} hover:bg-surface-secondary/30 transition-colors">
												<!-- Rank -->
												<td class="py-2 pl-4 pr-2 tabular-nums text-text-theme-tertiary">
													{sr.rank}
												</td>

												<!-- Title + doc_id -->
												<td class="py-2 px-2">
													<div class="flex items-start gap-1.5 min-w-0">
														<span class="text-text-theme-primary leading-tight line-clamp-2" title={sr.title}>
															{sr.title}
														</span>
													</div>
													<span class="text-[0.6rem] text-text-theme-tertiary tabular-nums mt-0.5 block">
														doc {sr.doc_id}
													</span>
												</td>

												<!-- Matched by -->
												<td class="py-2 px-2">
													<div class="flex flex-wrap gap-0.5">
														{#each sr.matched_by as method}
															<span class="inline-block px-1.5 py-0 rounded text-[0.6rem] font-medium {matchedByBadge(method)}">
																{method}
															</span>
														{/each}
													</div>
												</td>

												<!-- RRF Score -->
												<td class="py-2 px-2 text-center tabular-nums text-text-theme-tertiary">
													{sr.rrf_score.toFixed(3)}
												</td>

												<!-- Relevance buttons -->
												<td class="py-1.5 px-1 text-center">
													<div class="inline-flex gap-0.5">
														{#each RELEVANCE_LEVELS as level}
															{@const isActive = rating.relevance === level.value}
															<button
																onclick={() => handleRelevanceClick(qr, sr, level.value)}
																class="w-7 h-7 rounded text-xs font-bold transition-all
																	{isActive
																		? level.color + ' shadow-sm scale-105'
																		: 'bg-surface-secondary text-text-theme-tertiary ' + level.hoverColor + ' hover:shadow-sm'
																	}"
																title={level.longLabel}
																aria-label="Rate {sr.doc_id} relevance {level.value}: {level.longLabel}"
															>
																{level.label}
															</button>
														{/each}
													</div>
												</td>

												<!-- Intent select -->
												<td class="py-1.5 px-1 text-center">
													<select
														value={rating.intent ?? ''}
														onchange={(e) => handleIntentChange(qr, sr, (e.target as HTMLSelectElement).value || null)}
														class="text-[0.65rem] py-1 px-1.5 rounded border border-theme bg-surface-elevated text-text-theme-primary
															{rating.intent ? 'border-interactive/40' : ''}"
													>
														<option value="">--</option>
														{#each INTENT_OPTIONS as opt}
															<option value={opt}>{opt}</option>
														{/each}
													</select>
												</td>

												<!-- Failure flag select -->
												<td class="py-1.5 px-1 text-center">
													<select
														value={rating.failure ?? ''}
														onchange={(e) => handleFailureChange(qr, sr, (e.target as HTMLSelectElement).value || null)}
														class="text-[0.65rem] py-1 px-1.5 rounded border border-theme bg-surface-elevated text-text-theme-primary
															{rating.failure ? 'border-warning/50' : ''}"
													>
														<option value="">--</option>
														{#each FAILURE_FLAGS as flag}
															<option value={flag}>{flag}</option>
														{/each}
													</select>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>

							<!-- Per-query metrics footer -->
							{#if fullyRated && qr.per_query_metrics && Object.keys(qr.per_query_metrics).length > 0}
								<div class="px-4 py-2 bg-surface-secondary/30 border-t border-theme flex items-center gap-4 text-xs">
									<Gauge size={12} class="text-text-theme-tertiary" />
									{#if qr.per_query_metrics.ndcg_at_15 !== undefined}
										<span class="text-text-theme-secondary">
											NDCG@15: <strong class="text-text-theme-primary tabular-nums">{formatMetric(qr.per_query_metrics.ndcg_at_15)}</strong>
										</span>
									{/if}
									{#if qr.per_query_metrics.ap !== undefined}
										<span class="text-text-theme-secondary">
											AP: <strong class="text-text-theme-primary tabular-nums">{formatMetric(qr.per_query_metrics.ap)}</strong>
										</span>
									{/if}
									{#if qr.per_query_metrics.p_at_5 !== undefined}
										<span class="text-text-theme-secondary">
											P@5: <strong class="text-text-theme-primary tabular-nums">{formatMetric(qr.per_query_metrics.p_at_5)}</strong>
										</span>
									{/if}
									{#if typeof qr.per_query_metrics.relevance_distribution === 'object' && qr.per_query_metrics.relevance_distribution !== null}
										{@const dist = qr.per_query_metrics.relevance_distribution as Record<string, number>}
										<span class="ml-auto flex items-center gap-1.5 text-text-theme-tertiary">
											{#each ['3', '2', '1', '0'] as level}
												{@const count = dist[level] ?? 0}
												{#if count > 0}
													<span class="inline-flex items-center gap-0.5">
														<span class="w-2 h-2 rounded-full {level === '3' ? 'bg-green-600' : level === '2' ? 'bg-green-400' : level === '1' ? 'bg-yellow-500' : 'bg-red-500'}"></span>
														<span class="tabular-nums">{count}</span>
													</span>
												{/if}
											{/each}
										</span>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* Ensure line-clamp works across browsers */
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Compact select styling */
	select {
		appearance: auto;
		cursor: pointer;
	}

	select:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--color-interactive);
	}
</style>
