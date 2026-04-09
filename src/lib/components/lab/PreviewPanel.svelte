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
		autoPreviewPending = false
	}: {
		previewQuery: string;
		onQueryChange: (query: string) => void;
		onRunPreview: () => void;
		activePreview: PreviewResponse | null;
		experimentalPreview: PreviewResponse | null;
		previewing: boolean;
		previewError: string | null;
		autoPreviewPending?: boolean;
	} = $props();
</script>

<div class="card overflow-hidden">
	<div class="px-4 py-3">
		<h2 class="text-sm font-semibold text-text-theme-primary mb-1">Live Preview</h2>
		<p class="text-[11px] text-text-theme-tertiary mb-3 leading-relaxed">
			Compare results between the active config and your current settings.
			<kbd class="kbd">Cmd+Enter</kbd> to run.
		</p>

		<div class="flex gap-2 mb-4">
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

		{#if activePreview && experimentalPreview}
			{#if autoPreviewPending}
				<p class="text-[10px] text-text-theme-tertiary mb-2 animate-pulse">updating...</p>
			{/if}

			<div class="grid grid-cols-2 gap-4">
				<!-- Active config results -->
				<div>
					<h3 class="text-[11px] font-semibold text-text-theme-secondary mb-2 uppercase tracking-wider flex items-center gap-2">
						Active Config
						<span class="font-mono font-normal text-green-600">{activePreview.timing_ms}ms</span>
					</h3>
					<div class="space-y-2">
						{#each activePreview.results as r (r.uuid)}
							<a href="/ink/documents/{r.uuid}" target="_blank" rel="noopener" class="block text-xs py-2.5 px-3 rounded border border-theme bg-surface-elevated hover:border-interactive/50 transition-colors cursor-pointer no-underline">
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
							</a>
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
					<div class="space-y-2">
						{#each experimentalPreview.results as r (r.uuid)}
							{@const activeRank = activePreview.results.find(a => a.uuid === r.uuid)?.rank}
							{@const rankDelta = activeRank ? activeRank - r.rank : null}
							<a href="/ink/documents/{r.uuid}" target="_blank" rel="noopener" class="block text-xs py-2.5 px-3 rounded border border-theme bg-surface-elevated hover:border-interactive/50 transition-colors cursor-pointer no-underline {!activeRank ? 'ring-1 ring-blue-400/40' : ''}">
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
							</a>
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
				<p class="text-xs text-text-theme-tertiary">Enter a query above to compare search results.</p>
			</div>
		{/if}
	</div>
</div>
