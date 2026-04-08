<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { derived } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { inkApi } from '$lib/services/ink-api';
	import { inkPrefs } from '$lib/stores/ink-preferences.svelte';
	import HealthBar from '$lib/components/ink/HealthBar.svelte';
	import { Search, ChevronLeft, ChevronRight, AlertTriangle, FileText } from 'lucide-svelte';

	// URL-driven state with localStorage-backed defaults
	let query = $derived($page.url.searchParams.get('q') || '');
	let mode = $derived($page.url.searchParams.get('mode') || inkPrefs.get<string>('search.mode', 'combined'));
	let currentPage = $derived(parseInt($page.url.searchParams.get('page') || '1'));

	let searchInput = $state('');
	$effect(() => {
		searchInput = query;
	});

	const searchQuery = createQuery(
		derived(page, ($p) => {
			const q = $p.url.searchParams.get('q') || '';
			const m = $p.url.searchParams.get('mode') || inkPrefs.get<string>('search.mode', 'combined');
			const cp = parseInt($p.url.searchParams.get('page') || '1');
			return {
				queryKey: ['ink', 'search', q, m, cp] as const,
				queryFn: () => inkApi.search({ q, mode: m, page: cp, per_page: 25 }),
				enabled: !!q
			};
		})
	);

	function buildUrl(overrides: Record<string, string | undefined>) {
		const params = new URLSearchParams($page.url.searchParams);
		for (const [k, v] of Object.entries(overrides)) {
			if (v) params.set(k, v);
			else params.delete(k);
		}
		return `${base}/search?${params.toString()}`;
	}

	function handleSearchSubmit(e: Event) {
		e.preventDefault();
		if (searchInput.trim()) {
			goto(buildUrl({ q: searchInput.trim(), page: '1' }));
		}
	}

	function statusBadgeClass(status: string): string {
		switch (status) {
			case 'enabled': return 'bg-success-light text-green-700';
			case 'disabled': return 'bg-error-light text-red-700';
			default: return 'bg-surface-secondary text-text-theme-tertiary';
		}
	}

	function getPageNumbers(current: number, total: number): (number | '...')[] {
		if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
		const pages: (number | '...')[] = [];
		if (current <= 4) {
			pages.push(1, 2, 3, 4, 5, '...', total);
		} else if (current >= total - 3) {
			pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
		} else {
			pages.push(1, '...', current - 1, current, current + 1, '...', total);
		}
		return pages;
	}

	// Focus the search input on load
	$effect(() => {
		if (!query) {
			document.getElementById('ink-search-input')?.focus();
		}
	});
</script>

<svelte:head>
	<title>{query ? `"${query}" - Search` : 'Search'} | INK</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center gap-3">
		<h1 class="text-lg font-bold text-text-theme-primary">Search</h1>
		<!-- Mode Toggle (inline with header) -->
		<div class="flex gap-0.5 bg-surface-secondary rounded p-0.5">
			{#each [
				{ key: 'semantic', label: 'Semantic' },
				{ key: 'keyword', label: 'Keyword' },
				{ key: 'combined', label: 'Combined' }
			] as m}
				<a
					href={buildUrl({ mode: m.key, page: '1' })}
					onclick={() => inkPrefs.set('search.mode', m.key)}
					class="px-2.5 py-1 rounded text-xs font-medium transition-colors
						{mode === m.key
						? 'bg-interactive text-white shadow-sm'
						: 'text-text-theme-secondary hover:text-text-theme-primary'}"
				>
					{m.label}
				</a>
			{/each}
		</div>
	</div>

	<!-- Search Bar -->
	<form onsubmit={handleSearchSubmit} class="flex gap-2">
		<div class="relative flex-1">
			<input
				id="ink-search-input"
				type="text"
				bind:value={searchInput}
				placeholder="Search by title, description, or content..."
				class="input pr-10"
			/>
			<Search class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-theme-tertiary" />
		</div>
		<button type="submit" class="btn btn-primary text-sm px-4">Search</button>
	</form>

	<!-- Mode description -->
	<p class="text-xs text-text-theme-tertiary">
		{#if mode === 'semantic'}
			Semantic search finds documents by meaning, even when exact words differ.
		{:else if mode === 'keyword'}
			Keyword search matches exact terms in title and description. Useful for duplicate checking.
		{:else}
			Hybrid search — same engine as next.hsdl.org. Combines BM25 keyword ranking with semantic similarity.
		{/if}
	</p>

	<!-- Results -->
	{#if !query}
		<div class="text-center py-12 text-text-theme-tertiary">
			<Search class="w-10 h-10 mx-auto mb-3 opacity-40" />
			<p class="text-sm font-medium">Enter a search query</p>
			<p class="text-xs mt-1 max-w-sm mx-auto">
				Use keyword mode to check for duplicates before adding a new record.
				Semantic mode finds conceptually related documents.
			</p>
		</div>
	{:else if $searchQuery.isPending}
		<div class="space-y-2">
			{#each Array(8) as _}
				<div class="card p-3">
					<div class="skeleton h-4 w-3/4 mb-1.5 rounded"></div>
					<div class="skeleton h-3 w-full mb-1 rounded"></div>
					<div class="skeleton h-3 w-1/3 rounded"></div>
				</div>
			{/each}
		</div>
	{:else if $searchQuery.isError}
		<div class="card p-4 text-center">
			<p class="text-error text-sm mb-3">{$searchQuery.error.message}</p>
			<button onclick={() => $searchQuery.refetch()} class="btn btn-primary text-xs py-1 px-3">Retry</button>
		</div>
	{:else if $searchQuery.data}
		{@const data = $searchQuery.data}

		<div class="flex items-center justify-between text-xs text-text-theme-secondary">
			<span>
				<span class="font-semibold">{data.total_count.toLocaleString()}</span> results for "{query}"
			</span>
			{#if data.total_pages > 1}
				<span class="text-text-theme-tertiary">Page {data.page} of {data.total_pages}</span>
			{/if}
		</div>

		{#if data.results.length === 0}
			<div class="text-center py-8 text-text-theme-tertiary">
				<FileText class="w-8 h-8 mx-auto mb-2 opacity-40" />
				<p class="text-sm">No documents match your search</p>
				<p class="text-xs mt-1">Try different keywords or switch to semantic mode</p>
			</div>
		{:else}
			<div class="space-y-1.5">
				{#each data.results as doc, i}
					<a
						href="{base}/documents/{doc.id}"
						class="card px-3 py-2.5 block hover:shadow-sm transition-shadow group"
					>
						<div class="flex items-start gap-3">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<h2 class="text-sm font-medium text-text-theme-primary line-clamp-1 group-hover:text-interactive transition-colors">
										{doc.title}
									</h2>
								</div>
								{#if doc.description}
									<p class="text-xs text-text-theme-secondary mt-0.5 line-clamp-2 leading-relaxed">{doc.description}</p>
								{/if}
								<div class="flex items-center gap-2 mt-1 text-[0.625rem] text-text-theme-tertiary">
									{#if doc.publish_year}
										<span>{doc.publish_year}</span>
									{/if}
									{#if doc.source}
										<span>{doc.source}</span>
									{/if}
									<span class="badge text-[0.625rem] {statusBadgeClass(doc.enable_status)}">
										{doc.enable_status === 'not_set' ? 'unset' : doc.enable_status}
									</span>
									{#if doc.term_count > 0}
										<span>{doc.term_count} terms</span>
									{/if}
								</div>
							</div>
							<div class="w-16 flex-shrink-0 pt-0.5">
								<HealthBar score={doc.health_score} size="sm" />
							</div>
						</div>
					</a>
				{/each}
			</div>

			<!-- Pagination -->
			{#if data.total_pages > 1}
				<nav class="flex items-center justify-center gap-0.5 pt-2" aria-label="Search pagination">
					<a
						href={data.page > 1 ? buildUrl({ page: String(data.page - 1) }) : undefined}
						class="p-1.5 rounded {data.page > 1
							? 'hover:bg-surface-secondary text-text-theme-secondary'
							: 'text-text-theme-tertiary cursor-not-allowed pointer-events-none'}"
						aria-label="Previous page"
					>
						<ChevronLeft size={16} />
					</a>

					{#each getPageNumbers(data.page, data.total_pages) as pageNum}
						{#if pageNum === '...'}
							<span class="px-1.5 text-text-theme-tertiary text-xs">...</span>
						{:else}
							<a
								href={buildUrl({ page: String(pageNum) })}
								class="px-2 py-1 rounded text-xs font-medium {pageNum === data.page
									? 'bg-interactive text-white'
									: 'hover:bg-surface-secondary text-text-theme-secondary'}"
							>
								{pageNum}
							</a>
						{/if}
					{/each}

					<a
						href={data.page < data.total_pages ? buildUrl({ page: String(data.page + 1) }) : undefined}
						class="p-1.5 rounded {data.page < data.total_pages
							? 'hover:bg-surface-secondary text-text-theme-secondary'
							: 'text-text-theme-tertiary cursor-not-allowed pointer-events-none'}"
						aria-label="Next page"
					>
						<ChevronRight size={16} />
					</a>
				</nav>
			{/if}
		{/if}
	{/if}
</div>
