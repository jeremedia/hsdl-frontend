<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { writable, derived } from 'svelte/store';
	import { inkApi, type ReleaseNote } from '$lib/services/ink-api';
	import { ScrollText, Tag, ChevronDown, ChevronRight } from 'lucide-svelte';

	let filterTag = $state('');

	// Bridge $state → store for TanStack Query reactivity
	const filterTagStore = writable('');
	$effect(() => { filterTagStore.set(filterTag); });

	// Always-unfiltered query just for tag list
	const allReleasesQuery = createQuery({
		queryKey: ['ink', 'releases', ''],
		queryFn: () => inkApi.getReleaseNotes()
	});

	const releasesQuery = createQuery(
		derived(filterTagStore, ($tag) => ({
			queryKey: ['ink', 'releases', $tag],
			queryFn: () => inkApi.getReleaseNotes($tag || undefined)
		}))
	);

	// Track which releases are expanded (first one defaults open)
	let expandedVersions = $state<Set<string>>(new Set());
	let initialized = $state(false);

	$effect(() => {
		if ($releasesQuery.data && !initialized) {
			// Auto-expand the first (newest) release
			if ($releasesQuery.data.length > 0) {
				expandedVersions = new Set([($releasesQuery.data[0] as ReleaseNote).version]);
			}
			initialized = true;
		}
	});

	function toggleExpanded(version: string) {
		const next = new Set(expandedVersions);
		if (next.has(version)) next.delete(version);
		else next.add(version);
		expandedVersions = next;
	}

	function expandAll() {
		if ($releasesQuery.data) {
			expandedVersions = new Set($releasesQuery.data.map((n: ReleaseNote) => n.version));
		}
	}

	function collapseAll() {
		expandedVersions = new Set();
	}

	// Collect all unique tags from the unfiltered query (so tag buttons don't disappear when filtering)
	let allTags = $derived(
		$allReleasesQuery.data
			? [...new Set($allReleasesQuery.data.flatMap((n: ReleaseNote) => n.tags || []))].sort()
			: []
	);

	function typeBadgeClass(type: string): string {
		switch (type) {
			case 'Major Feature':
				return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
			case 'Feature':
				return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
			case 'Bug Fix':
				return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
			case 'Infrastructure':
				return 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300';
			default:
				return 'bg-surface-secondary text-text-theme-secondary';
		}
	}

	function tagBadgeClass(tag: string): string {
		switch (tag) {
			case 'ink':
				return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
			case 'search':
				return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
			case 'feed':
				return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
			case 'infrastructure':
				return 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400';
			default:
				return 'bg-surface-secondary text-text-theme-tertiary';
		}
	}

	function formatDate(iso: string): string {
		return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Releases | INK</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between flex-wrap gap-2">
		<div class="flex items-center gap-3">
			<h1 class="text-lg font-bold text-text-theme-primary">Releases</h1>
			{#if $releasesQuery.data}
				<span class="text-xs text-text-theme-tertiary">{$releasesQuery.data.length} releases</span>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<!-- Tag filter (always visible, active tag highlighted) -->
			{#if allTags.length > 0}
				<div class="flex gap-0.5 flex-wrap">
					{#each allTags as tag}
						<button
							onclick={() => { filterTag = filterTag === tag ? '' : tag; initialized = false; }}
							class="px-2 py-0.5 rounded text-[0.625rem] font-medium transition-colors
								{filterTag === tag
								? tagBadgeClass(tag) + ' ring-1 ring-offset-1 ring-current'
								: filterTag
									? 'bg-surface-secondary text-text-theme-tertiary hover:opacity-80'
									: tagBadgeClass(tag) + ' hover:opacity-80'}"
						>
							{tag}
						</button>
					{/each}
					{#if filterTag}
						<button
							onclick={() => { filterTag = ''; initialized = false; }}
							class="text-[0.625rem] text-text-theme-tertiary hover:text-text-theme-primary ml-0.5"
						>
							clear
						</button>
					{/if}
				</div>
			{/if}

			<!-- Expand/collapse all -->
			{#if $releasesQuery.data && $releasesQuery.data.length > 1}
				<button onclick={expandAll} class="text-xs text-text-theme-tertiary hover:text-text-theme-primary">expand all</button>
				<button onclick={collapseAll} class="text-xs text-text-theme-tertiary hover:text-text-theme-primary">collapse all</button>
			{/if}
		</div>
	</div>

	{#if $releasesQuery.isPending}
		<div class="space-y-3">
			{#each Array(5) as _}
				<div class="card p-4">
					<div class="skeleton h-5 w-48 mb-2 rounded"></div>
					<div class="skeleton h-3 w-full mb-1 rounded"></div>
					<div class="skeleton h-3 w-2/3 rounded"></div>
				</div>
			{/each}
		</div>
	{:else if $releasesQuery.isError}
		<div class="card p-4 text-center">
			<p class="text-error text-sm mb-3">{$releasesQuery.error.message}</p>
			<button onclick={() => $releasesQuery.refetch()} class="btn btn-primary text-xs py-1 px-3">Retry</button>
		</div>
	{:else if $releasesQuery.data}
		<div class="space-y-2">
			{#each $releasesQuery.data as note}
				{@const isExpanded = expandedVersions.has(note.version)}
				<div class="card overflow-hidden">
					<!-- Header (always visible) -->
					<button
						onclick={() => toggleExpanded(note.version)}
						class="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-surface-secondary/50 transition-colors"
					>
						<div class="pt-0.5 text-text-theme-tertiary flex-shrink-0">
							{#if isExpanded}
								<ChevronDown size={14} />
							{:else}
								<ChevronRight size={14} />
							{/if}
						</div>

						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 flex-wrap">
								<span class="text-sm font-semibold text-text-theme-primary">v{note.version}</span>
								<span class="px-1.5 py-0.5 rounded text-[0.625rem] font-medium {typeBadgeClass(note.release_type)}">
									{note.release_type}
								</span>
								{#each note.tags || [] as tag}
									<span class="px-1.5 py-0.5 rounded text-[0.625rem] font-medium {tagBadgeClass(tag)}">
										{tag}
									</span>
								{/each}
								<span class="text-[0.625rem] text-text-theme-tertiary ml-auto flex-shrink-0">
									{formatDate(note.release_date)}
								</span>
							</div>

							<!-- Highlights preview (collapsed state) -->
							{#if !isExpanded && note.highlights?.length > 0}
								<ul class="mt-1.5 space-y-0.5">
									{#each note.highlights.slice(0, 3) as highlight}
										<li class="text-xs text-text-theme-secondary leading-relaxed truncate">
											{highlight}
										</li>
									{/each}
									{#if note.highlights.length > 3}
										<li class="text-[0.625rem] text-text-theme-tertiary">+{note.highlights.length - 3} more</li>
									{/if}
								</ul>
							{/if}
						</div>
					</button>

					<!-- Expanded content -->
					{#if isExpanded}
						<div class="border-t border-theme px-4 py-4">
							<!-- Highlights as bullet list -->
							{#if note.highlights?.length > 0}
								<div class="mb-4 bg-surface-secondary/50 rounded-lg px-4 py-3">
									<h3 class="text-[0.625rem] font-semibold text-text-theme-tertiary uppercase tracking-wider mb-2">Highlights</h3>
									<ul class="space-y-1">
										{#each note.highlights as highlight}
											<li class="text-xs text-text-theme-primary leading-relaxed flex gap-2">
												<span class="text-interactive mt-0.5 flex-shrink-0">--</span>
												{highlight}
											</li>
										{/each}
									</ul>
								</div>
							{/if}

							<!-- Full rendered content -->
							<div class="prose prose-sm dark:prose-invert max-w-none
								text-text-theme-primary
								prose-headings:text-text-theme-primary prose-headings:font-semibold
								prose-h1:text-base prose-h1:mt-0 prose-h1:mb-3
								prose-h2:text-sm prose-h2:mt-5 prose-h2:mb-2 prose-h2:border-b prose-h2:border-theme prose-h2:pb-1
								prose-h3:text-xs prose-h3:mt-3 prose-h3:mb-1
								prose-p:text-xs prose-p:leading-relaxed prose-p:my-2
								prose-li:text-xs prose-li:leading-relaxed prose-li:text-text-theme-primary
								prose-strong:text-text-theme-primary
								prose-code:text-xs prose-code:font-mono prose-code:font-normal prose-code:text-text-theme-primary prose-code:bg-surface-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
								prose-pre:bg-surface-secondary prose-pre:text-text-theme-primary prose-pre:border prose-pre:border-theme
								prose-table:text-xs
								prose-th:text-left prose-th:px-3 prose-th:py-1.5 prose-th:bg-surface-secondary prose-th:font-semibold prose-th:text-text-theme-primary
								prose-td:px-3 prose-td:py-1.5 prose-td:border-t prose-td:border-theme prose-td:text-text-theme-primary
								prose-a:text-interactive prose-a:no-underline hover:prose-a:underline
							">
								{@html note.content_html}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if $releasesQuery.data.length === 0}
			<div class="text-center py-12 text-text-theme-tertiary">
				<ScrollText class="w-10 h-10 mx-auto mb-3 opacity-40" />
				<p class="text-sm font-medium">No releases found</p>
				{#if filterTag}
					<p class="text-xs mt-1">No releases tagged "{filterTag}"</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>
