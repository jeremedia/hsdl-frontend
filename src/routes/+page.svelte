<script lang="ts">
	import { base } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { inkApi } from '$lib/services/ink-api';
	import HealthBar from '$lib/components/ink/HealthBar.svelte';
	import { FileText, Heart, CheckCircle, XCircle, AlertTriangle, ArrowRight, Search, ClipboardList } from 'lucide-svelte';

	const dashboardQuery = createQuery({
		queryKey: ['ink', 'dashboard'],
		queryFn: () => inkApi.getDashboard()
	});

	function healthLabel(key: string): string {
		switch (key) {
			case 'excellent': return 'Excellent (80-100%)';
			case 'good': return 'Good (60-79%)';
			case 'fair': return 'Fair (40-59%)';
			case 'poor': return 'Poor (0-39%)';
			default: return key;
		}
	}

	function healthColor(key: string): string {
		switch (key) {
			case 'excellent': return 'bg-green-500';
			case 'good': return 'bg-blue-500';
			case 'fair': return 'bg-yellow-500';
			case 'poor': return 'bg-red-500';
			default: return 'bg-gray-500';
		}
	}

	// Readable labels for missing metadata keys
	function missingLabel(key: string): string {
		switch (key) {
			case 'no_description': return 'Missing description';
			case 'no_subjects': return 'No FAST subjects';
			case 'no_embedding': return 'No embedding';
			case 'no_pdf': return 'No PDF attached';
			default: return key.replace('no_', 'No ').replace(/_/g, ' ');
		}
	}

	// Build the filter URL for missing metadata drill-down
	function missingFilterUrl(key: string): string {
		switch (key) {
			case 'no_description': return `${base}/documents?has_description=false`;
			case 'no_subjects': return `${base}/documents?has_subjects=false`;
			case 'no_embedding': return `${base}/documents?has_embedding=false`;
			case 'no_pdf': return `${base}/documents?has_pdf=false`;
			default: return `${base}/documents?has_${key.replace('no_', '')}=false`;
		}
	}
</script>

<svelte:head>
	<title>Dashboard | INK</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold text-text-theme-primary">Dashboard</h1>
			<p class="text-xs text-text-theme-tertiary mt-0.5">HSDL collection overview</p>
		</div>
		<div class="flex items-center gap-2">
			<a href="{base}/documents?sort=updated_at&direction=desc" class="btn btn-outline text-xs py-1 px-2.5">
				<ClipboardList size={14} />
				Recent edits
			</a>
			<a href="{base}/search" class="btn btn-primary text-xs py-1 px-2.5">
				<Search size={14} />
				Search
			</a>
		</div>
	</div>

	{#if $dashboardQuery.isPending}
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
			{#each Array(4) as _}
				<div class="card p-3">
					<div class="skeleton h-3 w-20 mb-2 rounded"></div>
					<div class="skeleton h-6 w-14 rounded"></div>
				</div>
			{/each}
		</div>
	{:else if $dashboardQuery.isError}
		<div class="card p-4 text-center">
			<p class="text-error text-sm mb-3">Failed to load dashboard: {$dashboardQuery.error.message}</p>
			<button onclick={() => $dashboardQuery.refetch()} class="btn btn-primary text-xs py-1 px-3">Retry</button>
		</div>
	{:else if $dashboardQuery.data}
		{@const data = $dashboardQuery.data}

		<!-- Stat Cards (compact) -->
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
			<div class="card p-3">
				<div class="flex items-center gap-2.5">
					<div class="w-8 h-8 rounded bg-primary-100 flex items-center justify-center flex-shrink-0">
						<FileText size={16} class="text-primary-700" />
					</div>
					<div>
						<p class="text-xs text-text-theme-tertiary">Total Documents</p>
						<p class="text-lg font-bold leading-tight">{data.total_documents.toLocaleString()}</p>
					</div>
				</div>
			</div>

			<div class="card p-3">
				<div class="flex items-center gap-2.5">
					<div class="w-8 h-8 rounded bg-success-light flex items-center justify-center flex-shrink-0">
						<Heart size={16} class="text-success" />
					</div>
					<div>
						<p class="text-xs text-text-theme-tertiary">Avg Health</p>
						<p class="text-lg font-bold leading-tight">{Math.round(data.collection_health_avg * 100)}%</p>
					</div>
				</div>
			</div>

			<a href="{base}/documents?enable_status=enabled" class="card p-3 hover:shadow-md transition-shadow">
				<div class="flex items-center gap-2.5">
					<div class="w-8 h-8 rounded bg-success-light flex items-center justify-center flex-shrink-0">
						<CheckCircle size={16} class="text-success" />
					</div>
					<div>
						<p class="text-xs text-text-theme-tertiary">Enabled</p>
						<p class="text-lg font-bold leading-tight">{data.enabled_count.toLocaleString()}</p>
					</div>
				</div>
			</a>

			<a href="{base}/documents?enable_status=disabled" class="card p-3 hover:shadow-md transition-shadow">
				<div class="flex items-center gap-2.5">
					<div class="w-8 h-8 rounded bg-error-light flex items-center justify-center flex-shrink-0">
						<XCircle size={16} class="text-error" />
					</div>
					<div>
						<p class="text-xs text-text-theme-tertiary">Disabled</p>
						<p class="text-lg font-bold leading-tight">{data.disabled_count.toLocaleString()}</p>
					</div>
				</div>
			</a>
		</div>

		<!-- QC Action Panel + Health Distribution -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Missing Metadata (QC worklist) - takes 2/3 -->
			<div class="card p-4 lg:col-span-2">
				<div class="flex items-center gap-2 mb-3">
					<AlertTriangle size={16} class="text-warning" />
					<h2 class="text-sm font-semibold">QC Worklist</h2>
					<span class="text-xs text-text-theme-tertiary">-- documents needing attention</span>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
					{#each Object.entries(data.missing_metadata) as [key, count]}
						<a
							href={missingFilterUrl(key)}
							class="flex items-center justify-between py-2 px-3 rounded hover:bg-surface-secondary transition-colors group border border-transparent hover:border-theme"
						>
							<span class="text-sm text-text-theme-primary">{missingLabel(key)}</span>
							<span class="flex items-center gap-1.5">
								<span class="text-sm font-semibold tabular-nums {count > 10000 ? 'text-error' : count > 1000 ? 'text-warning' : 'text-text-theme-secondary'}">{count.toLocaleString()}</span>
								<ArrowRight size={12} class="text-text-theme-tertiary group-hover:text-interactive transition-colors" />
							</span>
						</a>
					{/each}
				</div>
			</div>

			<!-- Health Distribution - takes 1/3 -->
			<div class="card p-4">
				<h2 class="text-sm font-semibold mb-3">Health Distribution</h2>
				<div class="space-y-2.5">
					{#each Object.entries(data.health_distribution) as [key, count]}
						{@const total = data.total_documents}
						{@const pct = total > 0 ? (count / total) * 100 : 0}
						<div>
							<div class="flex items-center justify-between mb-0.5">
								<span class="text-xs text-text-theme-secondary">{healthLabel(key)}</span>
								<span class="text-xs font-medium tabular-nums">{count.toLocaleString()}</span>
							</div>
							<div class="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
								<div class="{healthColor(key)} h-full rounded-full transition-all" style="width: {count > 0 ? Math.max(pct, 2) : 0}%"></div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Recent Additions -->
		{#if data.recent_additions.length > 0}
			<div class="card">
				<div class="flex items-center justify-between px-4 py-2.5 border-b border-theme">
					<h2 class="text-sm font-semibold">Recent Additions</h2>
					<a href="{base}/documents?sort=created_at&direction=desc" class="text-xs text-interactive hover:underline">
						View all
					</a>
				</div>
				<div class="divide-y divide-[var(--color-border)]">
					{#each data.recent_additions as doc}
						<a
							href="{base}/documents/{doc.id}"
							class="flex items-center justify-between py-2 px-4 hover:bg-surface-secondary transition-colors group"
						>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium truncate group-hover:text-interactive transition-colors">
									{doc.title}
								</p>
								<p class="text-xs text-text-theme-tertiary">{doc.publisher || doc.source || 'Unknown source'}</p>
							</div>
							<div class="flex items-center gap-3 flex-shrink-0 ml-4">
								{#if doc.health_score != null}
									<div class="w-14">
										<HealthBar score={doc.health_score} size="sm" />
									</div>
								{/if}
								<span class="text-xs text-text-theme-tertiary tabular-nums">
									{doc.updated_at ? new Date(doc.updated_at).toLocaleDateString() : ''}
								</span>
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
