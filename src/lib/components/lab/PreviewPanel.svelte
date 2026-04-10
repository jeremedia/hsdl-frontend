<script lang="ts">
	import { Search } from 'lucide-svelte';
	import type { PreviewResponse } from '$lib/services/ink-api';

	let {
		previewQuery,
		onQueryChange,
		onRunPreview,
		activePreview,
		experimentalPreview,
		previewing,
		previewError,
		autoPreviewPending = false,
		activeConfigName = '',
		comparisonConfigName = ''
	}: {
		previewQuery: string;
		onQueryChange: (query: string) => void;
		onRunPreview: () => void;
		activePreview: PreviewResponse | null;
		experimentalPreview: PreviewResponse | null;
		previewing: boolean;
		previewError: string | null;
		autoPreviewPending?: boolean;
		activeConfigName?: string;
		comparisonConfigName?: string;
	} = $props();
</script>

<div class="card overflow-hidden">
	<!-- Search bar -->
	<div class="px-4 pt-3 pb-3">
		<div class="flex items-center justify-between mb-2">
			<h2 class="text-sm font-semibold text-text-theme-primary">Live Preview</h2>
			<span class="text-[10px] text-text-theme-tertiary"><kbd class="kbd text-[10px]">Cmd+Enter</kbd> to run</span>
		</div>

		<div class="flex gap-2">
			<div class="relative flex-1">
				<input
					value={previewQuery}
					oninput={(e) => onQueryChange((e.target as HTMLInputElement).value)}
					aria-label="Search preview query"
					class="input text-xs py-1.5 pr-8 w-full"
					placeholder="Try a search query..."
					onkeydown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onRunPreview(); } }}
				/>
				<Search class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-theme-tertiary pointer-events-none" />
			</div>
			<button
				onclick={onRunPreview}
				disabled={previewing || !previewQuery.trim()}
				class="btn btn-primary text-xs py-1.5 px-3"
			>
				{#if previewing}Running...{:else}Preview{/if}
			</button>
		</div>
	</div>

	{#if activePreview && experimentalPreview}
		{#if autoPreviewPending}
			<div class="px-4 pb-1">
				<p class="text-[10px] text-text-theme-tertiary animate-pulse">updating...</p>
			</div>
		{/if}

		<div class="grid grid-cols-2 border-t border-theme">
			<!-- Active config results -->
			<div class="border-r border-theme">
				<div class="px-3 py-2 bg-surface-secondary/50 border-b border-theme flex items-baseline justify-between">
					<h3 class="text-[11px] font-semibold text-text-theme-secondary uppercase tracking-wider">
						Active
					</h3>
					<span class="text-[11px] text-green-600 font-medium">{activeConfigName || activePreview.config_name}</span>
				</div>
				<div class="preview-results-list">
					{#each activePreview.results as r (r.uuid)}
						<a href="/ink/documents/{r.uuid}" target="_blank" rel="noopener" class="preview-result-item">
							<div class="flex items-start gap-1.5">
								<span class="text-text-theme-tertiary font-mono text-[10px] tabular-nums shrink-0 pt-px">#{r.rank}</span>
								<span class="text-[11px] text-text-theme-primary leading-snug line-clamp-2">{r.title}</span>
							</div>
							<div class="flex items-center gap-1 mt-1">
								{#each r.matched_by as badge}
									<span class="preview-badge">{badge}</span>
								{/each}
								<span class="text-[9px] text-text-theme-tertiary ml-auto tabular-nums font-mono">{r.rrf_score?.toFixed(4)}</span>
							</div>
						</a>
					{/each}
					{#if activePreview.results.length === 0}
						<p class="text-xs text-text-theme-tertiary text-center py-4">No results</p>
					{/if}
				</div>
				<div class="px-3 py-1.5 border-t border-theme">
					<span class="font-mono text-[10px] text-text-theme-tertiary">{activePreview.timing_ms}ms</span>
				</div>
			</div>

			<!-- Experimental config results -->
			<div>
				<div class="px-3 py-2 bg-surface-secondary/50 border-b border-theme flex items-baseline justify-between">
					<h3 class="text-[11px] font-semibold text-text-theme-secondary uppercase tracking-wider">
						Comparison
					</h3>
					<span class="text-[11px] text-blue-500 font-medium">{comparisonConfigName || experimentalPreview.config_name}</span>
				</div>
				<div class="preview-results-list">
					{#each experimentalPreview.results as r (r.uuid)}
						{@const activeRank = activePreview.results.find(a => a.uuid === r.uuid)?.rank}
						{@const rankDelta = activeRank ? activeRank - r.rank : null}
						<a href="/ink/documents/{r.uuid}" target="_blank" rel="noopener" class="preview-result-item {!activeRank ? 'ring-1 ring-inset ring-blue-400/30' : ''}">
							<div class="flex items-start gap-1.5">
								<span class="text-text-theme-tertiary font-mono text-[10px] tabular-nums shrink-0 pt-px">#{r.rank}</span>
								<span class="text-[11px] text-text-theme-primary leading-snug line-clamp-2">{r.title}</span>
							</div>
							<div class="flex items-center gap-1 mt-1">
								{#each r.matched_by as badge}
									<span class="preview-badge">{badge}</span>
								{/each}
								{#if rankDelta !== null && rankDelta !== 0}
									<span class="text-[9px] ml-auto font-semibold tabular-nums {rankDelta > 0 ? 'text-green-500' : 'text-red-400'}">
										{rankDelta > 0 ? `+${rankDelta}` : rankDelta}
									</span>
								{:else if !activeRank}
									<span class="text-[9px] ml-auto font-semibold text-blue-400">new</span>
								{:else}
									<span class="text-[9px] text-text-theme-tertiary ml-auto tabular-nums font-mono">{r.rrf_score?.toFixed(4)}</span>
								{/if}
							</div>
						</a>
					{/each}
					{#if experimentalPreview.results.length === 0}
						<p class="text-xs text-text-theme-tertiary text-center py-4">No results</p>
					{/if}
				</div>
				<div class="px-3 py-1.5 border-t border-theme">
					<span class="font-mono text-[10px] text-text-theme-tertiary">{experimentalPreview.timing_ms}ms</span>
				</div>
			</div>
		</div>
	{:else if previewError}
		<div class="mx-4 mb-3 py-3 px-4 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
			<p class="text-xs text-red-700 dark:text-red-300">{previewError}</p>
		</div>
	{:else}
		<div class="py-8 text-center border-t border-theme">
			<Search size={20} class="mx-auto mb-1.5 text-text-theme-tertiary opacity-25" />
			<p class="text-[11px] text-text-theme-tertiary">Enter a query to compare search results</p>
		</div>
	{/if}
</div>

<style>
	.preview-results-list {
		display: flex;
		flex-direction: column;
	}
	.preview-result-item {
		display: block;
		padding: 0.375rem 0.75rem;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
		transition: background-color 150ms ease;
		cursor: pointer;
		text-decoration: none;
	}
	.preview-result-item:last-child {
		border-bottom: none;
	}
	.preview-result-item:hover {
		background-color: color-mix(in srgb, var(--color-interactive) 5%, transparent);
	}
	.preview-badge {
		font-size: 0.5625rem;
		padding: 0.0625rem 0.375rem;
		border-radius: 0.1875rem;
		background: color-mix(in srgb, var(--color-interactive) 12%, transparent);
		color: var(--color-interactive);
		font-weight: 500;
		line-height: 1.4;
	}
</style>
