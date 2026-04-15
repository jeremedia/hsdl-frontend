<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { createQuery } from '@tanstack/svelte-query';
	import { derived } from 'svelte/store';
	import { inkApi } from '$lib/services/ink-api';
	import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-svelte';

	const compareQuery = createQuery(
		derived(page, ($p) => {
			const idA = $p.params.id ?? '';
			const idB = $p.params.otherId ?? '';
			return {
				queryKey: ['ink', 'golden_compare', idA, idB],
				queryFn: () => inkApi.compareGoldenRuns(idA, idB)
			};
		})
	);

	function formatMetric(val: unknown): string {
		if (typeof val === 'number') return (val * 100).toFixed(1) + '%';
		return '--';
	}

	function deltaColor(delta: number): string {
		if (delta > 0.01) return 'text-success';
		if (delta < -0.01) return 'text-error';
		return 'text-text-theme-tertiary';
	}

	function formatDelta(delta: number): string {
		const pct = (delta * 100).toFixed(1);
		return delta > 0 ? `+${pct}%` : `${pct}%`;
	}

	const METRIC_LABELS: Record<string, string> = {
		ndcg_at_15: 'NDCG@15',
		map: 'MAP',
		p_at_5: 'P@5',
		p_at_10: 'P@10',
		p_at_15: 'P@15',
		mean_expected_recall: 'Expected Recall'
	};
</script>

<svelte:head>
	<title>Compare Runs | INK</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center gap-2">
		<button onclick={() => history.back()} class="p-1 rounded hover:bg-surface-secondary transition-colors">
			<ArrowLeft size={16} />
		</button>
		<h1 class="text-lg font-bold text-text-theme-primary">Run Comparison</h1>
	</div>

	{#if $compareQuery.isPending}
		<div class="card p-4"><div class="skeleton h-4 w-48 rounded"></div></div>
	{:else if $compareQuery.isError}
		<div class="card p-4 text-center">
			<p class="text-error text-sm mb-3">{$compareQuery.error.message}</p>
			<button onclick={() => $compareQuery.refetch()} class="btn btn-primary text-xs py-1 px-3">Retry</button>
		</div>
	{:else if $compareQuery.data}
		{@const data = $compareQuery.data}

		<!-- Run Headers -->
		<div class="grid grid-cols-2 gap-3">
			<div class="card p-3">
				<div class="text-xs text-text-theme-tertiary uppercase tracking-wider mb-1">Run A</div>
				<div class="text-sm font-semibold">{data.run_a.label || 'Untitled'}</div>
				<div class="text-xs text-text-theme-tertiary mt-0.5">{data.run_a.completed_at ? new Date(data.run_a.completed_at).toLocaleDateString() : '--'}</div>
			</div>
			<div class="card p-3">
				<div class="text-xs text-text-theme-tertiary uppercase tracking-wider mb-1">Run B</div>
				<div class="text-sm font-semibold">{data.run_b.label || 'Untitled'}</div>
				<div class="text-xs text-text-theme-tertiary mt-0.5">{data.run_b.completed_at ? new Date(data.run_b.completed_at).toLocaleDateString() : '--'}</div>
			</div>
		</div>

		<!-- Aggregate Metrics Comparison -->
		<div class="card overflow-hidden">
			<div class="px-4 py-2 bg-surface-secondary border-b border-theme">
				<h2 class="text-xs font-semibold text-text-theme-tertiary uppercase tracking-wider">Aggregate Metrics</h2>
			</div>
			<div class="divide-y divide-theme">
				{#each Object.entries(data.deltas) as [key, d]}
					{#if key !== 'failure_shifts' && METRIC_LABELS[key]}
						<div class="flex items-center px-4 py-2 text-xs">
							<span class="w-32 text-text-theme-secondary font-medium">{METRIC_LABELS[key]}</span>
							<span class="w-20 text-right tabular-nums">{formatMetric(d.a)}</span>
							<span class="w-20 text-right tabular-nums">{formatMetric(d.b)}</span>
							<span class="w-24 text-right tabular-nums font-semibold {deltaColor(d.delta)} flex items-center justify-end gap-1">
								{#if d.delta > 0.01}
									<TrendingUp size={12} />
								{:else if d.delta < -0.01}
									<TrendingDown size={12} />
								{:else}
									<Minus size={12} />
								{/if}
								{formatDelta(d.delta)}
							</span>
						</div>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Failure Flag Shifts -->
		{#if data.deltas.failure_shifts}
			<div class="card overflow-hidden">
				<div class="px-4 py-2 bg-surface-secondary border-b border-theme">
					<h2 class="text-xs font-semibold text-text-theme-tertiary uppercase tracking-wider">Failure Flag Changes</h2>
				</div>
				<div class="divide-y divide-theme">
					{#each data.deltas.failure_shifts as shift}
						<div class="flex items-center px-4 py-1.5 text-xs">
							<span class="flex-1 text-text-theme-secondary">{shift.flag}</span>
							<span class="w-12 text-right tabular-nums">{shift.a}</span>
							<span class="w-12 text-right tabular-nums">{shift.b}</span>
							<span class="w-16 text-right tabular-nums font-medium {shift.delta > 0 ? 'text-error' : shift.delta < 0 ? 'text-success' : 'text-text-theme-tertiary'}">
								{shift.delta > 0 ? '+' : ''}{shift.delta}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Per-Query NDCG Comparison -->
		{#if data.per_query.length > 0}
			<div class="card overflow-hidden">
				<div class="px-4 py-2 bg-surface-secondary border-b border-theme">
					<h2 class="text-xs font-semibold text-text-theme-tertiary uppercase tracking-wider">Per-Query NDCG Changes (sorted by impact)</h2>
				</div>
				<div class="max-h-[500px] overflow-y-auto divide-y divide-theme">
					{#each data.per_query as q}
						<div class="flex items-center px-4 py-1.5 text-xs hover:bg-surface-secondary transition-colors">
							<span class="flex-1 text-text-theme-primary truncate">{q.query_text}</span>
							<span class="w-16 text-right tabular-nums">{formatMetric(q.ndcg_a)}</span>
							<span class="w-16 text-right tabular-nums">{formatMetric(q.ndcg_b)}</span>
							<span class="w-20 text-right tabular-nums font-semibold {deltaColor(q.delta)} flex items-center justify-end gap-1">
								{#if q.delta > 0.01}
									<TrendingUp size={12} />
								{:else if q.delta < -0.01}
									<TrendingDown size={12} />
								{:else}
									<Minus size={12} />
								{/if}
								{formatDelta(q.delta)}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
