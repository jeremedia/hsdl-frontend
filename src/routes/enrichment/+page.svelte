<script lang="ts">
	import { base } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { writable, derived } from 'svelte/store';
	import { inkApi, type EnrichmentStatus } from '$lib/services/ink-api';
	import {
		Zap, Database, FileText, Brain, Tag, BookOpen, Network, Heart,
		Activity, RefreshCw, Clock, CheckCircle
	} from 'lucide-svelte';

	let autoRefresh = $state(true);

	// Bridge $state → store for TanStack Query reactivity
	const autoRefreshStore = writable(true);
	$effect(() => { autoRefreshStore.set(autoRefresh); });

	const statusQuery = createQuery(
		derived(autoRefreshStore, ($auto) => ({
			queryKey: ['ink', 'enrichment'],
			queryFn: () => inkApi.getEnrichmentStatus(),
			refetchInterval: $auto ? 10000 : false as const
		}))
	);

	const dimensionMeta: Record<string, { label: string; icon: typeof Zap; color: string }> = {
		embedding: { label: 'Embeddings', icon: Brain, color: 'bg-blue-500' },
		full_text_embedding: { label: 'Full-Text Embeddings', icon: FileText, color: 'bg-indigo-500' },
		docling: { label: 'Docling PDF', icon: FileText, color: 'bg-purple-500' },
		tags: { label: 'Tags', icon: Tag, color: 'bg-amber-500' },
		summary: { label: 'Summaries', icon: BookOpen, color: 'bg-emerald-500' },
		marc_subjects: { label: 'MARC Subjects', icon: Database, color: 'bg-cyan-500' },
		entity_mentions: { label: 'Entity Graph', icon: Network, color: 'bg-rose-500' },
		vocab_terms: { label: 'Vocab Terms', icon: Database, color: 'bg-teal-500' },
		health_score: { label: 'Health Scores', icon: Heart, color: 'bg-green-500' }
	};

	function formatNumber(n: number): string {
		if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
		if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
		return n.toLocaleString();
	}

	function pctColor(pct: number): string {
		if (pct >= 90) return 'bg-green-500';
		if (pct >= 60) return 'bg-blue-500';
		if (pct >= 30) return 'bg-amber-500';
		return 'bg-red-500';
	}

	function timeAgo(iso: string | null): string {
		if (!iso) return '';
		const diff = Date.now() - new Date(iso).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		return `${Math.floor(hrs / 24)}d ago`;
	}
</script>

<svelte:head>
	<title>Enrichment | INK</title>
</svelte:head>

<div class="space-y-5">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold text-text-theme-primary flex items-center gap-2">
				<Zap size={20} class="text-amber-500" />
				Enrichment Pipeline
			</h1>
			<p class="text-xs text-text-theme-tertiary mt-0.5">Document processing coverage and activity</p>
		</div>
		<div class="flex items-center gap-3">
			<button
				onclick={() => autoRefresh = !autoRefresh}
				class="btn btn-sm {autoRefresh ? 'btn-primary' : 'btn-outline'} flex items-center gap-1.5 text-xs"
				title={autoRefresh ? 'Auto-refreshing every 10s' : 'Auto-refresh paused'}
			>
				<RefreshCw size={12} class={autoRefresh ? 'animate-spin' : ''} style={autoRefresh ? 'animation-duration: 10s' : ''} />
				{autoRefresh ? 'Live' : 'Paused'}
			</button>
			<button onclick={() => $statusQuery.refetch()} class="btn btn-sm btn-outline text-xs">
				Refresh
			</button>
		</div>
	</div>

	{#if $statusQuery.isPending}
		<div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
			{#each Array(9) as _}
				<div class="card p-3">
					<div class="skeleton h-3 w-24 mb-2 rounded"></div>
					<div class="skeleton h-2 w-full mb-1 rounded"></div>
					<div class="skeleton h-3 w-16 rounded"></div>
				</div>
			{/each}
		</div>
	{:else if $statusQuery.isError}
		<div class="card p-4 text-center">
			<p class="text-error text-sm mb-3">Failed to load enrichment status: {$statusQuery.error.message}</p>
			<button onclick={() => $statusQuery.refetch()} class="btn btn-primary text-xs py-1 px-3">Retry</button>
		</div>
	{:else if $statusQuery.data}
		{@const data = $statusQuery.data}

		<!-- Totals bar -->
		<div class="flex gap-4 text-xs text-text-theme-secondary">
			<span><strong>{formatNumber(data.totals.total_documents)}</strong> documents</span>
			<span><strong>{formatNumber(data.totals.publicly_visible)}</strong> public</span>
			<span><strong>{formatNumber(data.totals.pdfs)}</strong> PDFs</span>
		</div>

		<!-- Coverage Grid -->
		<div>
			<h2 class="text-sm font-semibold text-text-theme-primary mb-2">Coverage</h2>
			<div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
				{#each Object.entries(data.coverage) as [key, cov]}
					{@const meta = dimensionMeta[key] || { label: key, icon: Zap, color: 'bg-gray-500' }}
					{@const MetaIcon = meta.icon}
					<div class="card p-3">
						<div class="flex items-center gap-2 mb-2">
							<div class="w-6 h-6 rounded {meta.color} bg-opacity-15 flex items-center justify-center">
								<MetaIcon size={13} class={meta.color.replace('bg-', 'text-')} />
							</div>
							<span class="text-xs font-medium text-text-theme-primary">{meta.label}</span>
							{#if cov.note}
								<span class="text-[0.6rem] text-text-theme-tertiary">({cov.note})</span>
							{/if}
						</div>
						<div class="w-full h-1.5 bg-surface-secondary rounded-full overflow-hidden mb-1.5">
							<div
								class="{pctColor(cov.pct)} h-full rounded-full transition-all duration-500"
								style="width: {Math.max(cov.pct, 0.5)}%"
							></div>
						</div>
						<div class="flex justify-between text-[0.65rem] text-text-theme-tertiary">
							<span class="tabular-nums">{formatNumber(cov.count)} / {formatNumber(cov.total)}</span>
							<span class="font-semibold tabular-nums {cov.pct >= 90 ? 'text-green-600' : cov.pct < 10 ? 'text-red-500' : ''}">{cov.pct}%</span>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Queue Status -->
		<div>
			<h2 class="text-sm font-semibold text-text-theme-primary mb-2">Queue Activity</h2>
			<div class="card p-3">
				<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
					{#each Object.entries(data.queues) as [name, q]}
						{#if typeof q === 'object' && 'size' in q}
							<div class="flex items-center gap-2">
								<div class="w-2 h-2 rounded-full {q.size > 0 ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}"></div>
								<div>
									<p class="text-xs font-medium text-text-theme-primary">{name}</p>
									<p class="text-[0.6rem] text-text-theme-tertiary tabular-nums">
										{q.size} jobs
										{#if q.latency > 0}
											<span class="text-text-theme-tertiary">({q.latency}s latency)</span>
										{/if}
									</p>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		</div>

		<!-- Recent Activity -->
		{#if data.recent_activity.length > 0}
			<div>
				<h2 class="text-sm font-semibold text-text-theme-primary mb-2">Recent Activity</h2>
				<div class="card overflow-hidden">
					<table class="w-full text-xs">
						<thead>
							<tr class="border-b border-surface-secondary text-text-theme-tertiary">
								<th class="text-left py-2 px-3 font-medium">Document</th>
								<th class="text-left py-2 px-3 font-medium">Enrichment</th>
								<th class="text-left py-2 px-3 font-medium">Model</th>
								<th class="text-right py-2 px-3 font-medium">When</th>
							</tr>
						</thead>
						<tbody>
							{#each data.recent_activity as item}
								<tr class="border-b border-surface-secondary last:border-0 hover:bg-surface-secondary/50">
									<td class="py-1.5 px-3">
										<a href="{base}/documents/{item.id}" class="text-interactive hover:underline" title={item.title || ''}>
											<span class="text-text-theme-tertiary tabular-nums">#{item.docID}</span>
											{item.title ? ` ${item.title}` : ''}
										</a>
									</td>
									<td class="py-1.5 px-3">
										{#if item.enrichment}
											<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-surface-secondary text-[0.6rem] font-medium">
												{item.enrichment}
											</span>
										{/if}
									</td>
									<td class="py-1.5 px-3 text-text-theme-tertiary font-mono text-[0.6rem]">
										{item.model || ''}
									</td>
									<td class="py-1.5 px-3 text-right text-text-theme-tertiary tabular-nums">
										{timeAgo(item.at)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Model Provenance -->
		{#if Object.keys(data.model_provenance).length > 0}
			<div>
				<h2 class="text-sm font-semibold text-text-theme-primary mb-2">Model Provenance</h2>
				<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
					{#each Object.entries(data.model_provenance) as [enrichment, models]}
						<div class="card p-3">
							<p class="text-xs font-medium text-text-theme-primary mb-1.5 capitalize">{enrichment.replace('_', ' ')}</p>
							{#each Object.entries(models) as [model, count]}
								<div class="flex justify-between text-[0.65rem] text-text-theme-secondary">
									<span class="font-mono">{model}</span>
									<span class="tabular-nums">{formatNumber(count)}</span>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<div class="card p-4 text-center text-xs text-text-theme-tertiary">
				<p>No enrichment provenance data yet. Run a backfill to start tracking which models produce which enrichments.</p>
			</div>
		{/if}
	{/if}
</div>
