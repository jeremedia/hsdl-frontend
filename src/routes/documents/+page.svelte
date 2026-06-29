<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { derived } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { inkApi } from '$lib/services/ink-api';
	import { inkPrefs } from '$lib/stores/ink-preferences.svelte';
	import DocumentTable from '$lib/components/ink/DocumentTable.svelte';
	import { Search, X, ChevronLeft, ChevronRight } from 'lucide-svelte';

	// URL-driven state with localStorage-backed defaults
	// URL params take precedence (for shared links); saved prefs are fallback
	let currentPage = $derived(parseInt($page.url.searchParams.get('page') || '1'));
	let perPage = $derived(parseInt($page.url.searchParams.get('per_page') || String(inkPrefs.get<number>('documents.perPage', 50))));
	let sort = $derived($page.url.searchParams.get('sort') || inkPrefs.get<string>('documents.sort', 'updated_at'));
	let direction = $derived($page.url.searchParams.get('direction') || inkPrefs.get<string>('documents.direction', 'desc'));
	let searchQuery = $derived($page.url.searchParams.get('q') || '');
	let enableStatus = $derived($page.url.searchParams.get('enable_status') || inkPrefs.get<string>('documents.enableStatus', ''));
	let hasPdf = $derived($page.url.searchParams.get('has_pdf') || inkPrefs.get<string>('documents.hasPdf', ''));
	let hasEmbedding = $derived($page.url.searchParams.get('has_embedding') || inkPrefs.get<string>('documents.hasEmbedding', ''));

	// Local filter inputs
	let searchInput = $state('');
	$effect(() => {
		searchInput = searchQuery;
	});

	// Selected rows for batch operations
	let selectedIds = $state<Set<string>>(new Set());

	const documentsQuery = createQuery(
		derived(page, ($p) => {
			const cp = parseInt($p.url.searchParams.get('page') || '1');
			const pp = parseInt($p.url.searchParams.get('per_page') || String(inkPrefs.get<number>('documents.perPage', 50)));
			const s = $p.url.searchParams.get('sort') || inkPrefs.get<string>('documents.sort', 'updated_at');
			const d = $p.url.searchParams.get('direction') || inkPrefs.get<string>('documents.direction', 'desc');
			const q = $p.url.searchParams.get('q') || '';
			const es = $p.url.searchParams.get('enable_status') || inkPrefs.get<string>('documents.enableStatus', '');
			const hp = $p.url.searchParams.get('has_pdf') || inkPrefs.get<string>('documents.hasPdf', '');
			const he = $p.url.searchParams.get('has_embedding') || inkPrefs.get<string>('documents.hasEmbedding', '');
			return {
				queryKey: ['ink', 'documents', cp, pp, s, d, q, es, hp, he] as const,
				queryFn: () => inkApi.getDocuments({
					page: cp, per_page: pp, sort: s, direction: d,
					q: q || undefined,
					enable_status: es || undefined,
					has_pdf: hp === 'true' ? true : hp === 'false' ? false : undefined,
					has_embedding: he === 'true' ? true : he === 'false' ? false : undefined
				})
			};
		})
	);

	// Row navigation
	let focusedRow = $state(0);

	function handleKeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
		const data = $documentsQuery.data;
		if (!data) return;
		switch (e.key) {
			case 'j':
				focusedRow = Math.min(focusedRow + 1, data.results.length - 1);
				e.preventDefault();
				break;
			case 'k':
				focusedRow = Math.max(focusedRow - 1, 0);
				e.preventDefault();
				break;
			case 'Enter':
				if (data.results[focusedRow]) goto(`${base}/documents/${data.results[focusedRow].id}`);
				break;
			case 'x':
				// Toggle selection on focused row
				if (data.results[focusedRow]) handleSelect(data.results[focusedRow].id);
				e.preventDefault();
				break;
			case '/':
				e.preventDefault();
				document.getElementById('ink-doc-search')?.focus();
				break;
			case 'n':
				// Next page
				if (data.page < data.total_pages) goto(buildUrl({ page: String(data.page + 1) }));
				e.preventDefault();
				break;
			case 'p':
				// Previous page
				if (data.page > 1) goto(buildUrl({ page: String(data.page - 1) }));
				e.preventDefault();
				break;
		}
	}

	function buildUrl(overrides: Record<string, string | undefined>) {
		const params = new URLSearchParams($page.url.searchParams);
		for (const [k, v] of Object.entries(overrides)) {
			if (v) params.set(k, v);
			else params.delete(k);
		}
		return `${base}/documents?${params.toString()}`;
	}

	function handleSearchSubmit(e: Event) {
		e.preventDefault();
		goto(buildUrl({ q: searchInput.trim() || undefined, page: '1' }));
	}

	function handleSort(field: string) {
		const newDir = sort === field && direction === 'asc' ? 'desc' : 'asc';
		inkPrefs.set('documents.sort', field);
		inkPrefs.set('documents.direction', newDir);
		goto(buildUrl({ sort: field, direction: newDir, page: '1' }));
	}

	function handleSelect(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function clearFilters() {
		inkPrefs.set('documents.enableStatus', '');
		inkPrefs.set('documents.hasPdf', '');
		inkPrefs.set('documents.hasEmbedding', '');
		goto(`${base}/documents`);
	}

	let hasFilters = $derived(searchQuery || enableStatus || hasPdf || hasEmbedding);
	let activeFilterCount = $derived(
		(searchQuery ? 1 : 0) + (enableStatus ? 1 : 0) + (hasPdf ? 1 : 0) + (hasEmbedding ? 1 : 0)
	);

	// Pagination
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
</script>

<svelte:head>
	<title>Documents | INK</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="space-y-3">
	<!-- Header row: title + filter bar inline -->
	<div class="flex items-center gap-3 flex-wrap">
		<h1 class="text-lg font-bold text-text-theme-primary flex-shrink-0">Documents</h1>

		<!-- Search (inline) -->
		<form onsubmit={handleSearchSubmit} class="flex-1 min-w-[180px] max-w-md relative">
			<input
				id="ink-doc-search"
				type="text"
				bind:value={searchInput}
				placeholder="Search... ( / )"
				class="input text-xs py-1.5 pr-8"
			/>
			<Search class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-theme-tertiary" />
		</form>

		<!-- Compact filter selects -->
		<select
			class="input text-xs py-1.5 w-auto"
			value={enableStatus}
			onchange={(e) => { inkPrefs.set('documents.enableStatus', e.currentTarget.value); goto(buildUrl({ enable_status: e.currentTarget.value || undefined, page: '1' })); }}
		>
			<option value="">All statuses</option>
			<option value="enabled">Enabled</option>
			<option value="disabled">Disabled</option>
			<option value="not_set">Not set</option>
		</select>

		<select
			class="input text-xs py-1.5 w-auto"
			value={hasPdf}
			onchange={(e) => { inkPrefs.set('documents.hasPdf', e.currentTarget.value); goto(buildUrl({ has_pdf: e.currentTarget.value || undefined, page: '1' })); }}
		>
			<option value="">Any PDF</option>
			<option value="true">Has PDF</option>
			<option value="false">No PDF</option>
		</select>

		<select
			class="input text-xs py-1.5 w-auto hidden sm:block"
			value={hasEmbedding}
			onchange={(e) => { inkPrefs.set('documents.hasEmbedding', e.currentTarget.value); goto(buildUrl({ has_embedding: e.currentTarget.value || undefined, page: '1' })); }}
		>
			<option value="">Any embedding</option>
			<option value="true">Has embedding</option>
			<option value="false">No embedding</option>
		</select>

		{#if hasFilters}
			<button
				onclick={clearFilters}
				class="btn btn-outline text-xs py-1 px-2 flex items-center gap-1"
			>
				<X size={12} /> Clear {activeFilterCount > 1 ? `(${activeFilterCount})` : ''}
			</button>
		{/if}

		{#if selectedIds.size > 0}
			<span class="text-xs text-text-theme-secondary ml-auto">{selectedIds.size} selected</span>
		{/if}
	</div>

	<!-- Results -->
	{#if $documentsQuery.isPending && !$documentsQuery.data}
		<div class="card">
			{#each Array(15) as _}
				<div class="flex items-center gap-3 px-3 py-2 border-b border-theme">
					<div class="skeleton h-3 w-4 rounded"></div>
					<div class="skeleton h-3 flex-1 rounded"></div>
					<div class="skeleton h-3 w-20 rounded hidden sm:block"></div>
					<div class="skeleton h-3 w-12 rounded"></div>
				</div>
			{/each}
		</div>
	{:else if $documentsQuery.isError}
		<div class="card p-4 text-center">
			<p class="text-error text-sm mb-3">{$documentsQuery.error.message}</p>
			<button onclick={() => $documentsQuery.refetch()} class="btn btn-primary text-xs py-1 px-3">Retry</button>
		</div>
	{:else if $documentsQuery.data}
		{@const data = $documentsQuery.data}

		<!-- Count bar + per page -->
		<div class="flex items-center justify-between text-xs text-text-theme-secondary">
			<span>
				{data.total_count.toLocaleString()} documents
				{#if data.total_pages > 1}
					<span class="text-text-theme-tertiary">-- page {data.page} of {data.total_pages}</span>
				{/if}
			</span>
			<div class="flex items-center gap-1.5">
				<span class="text-text-theme-tertiary">Rows:</span>
				<select
					class="input text-xs py-0.5 w-auto"
					value={String(perPage)}
					onchange={(e) => { inkPrefs.set('documents.perPage', parseInt(e.currentTarget.value)); goto(buildUrl({ per_page: e.currentTarget.value, page: '1' })); }}
				>
					<option value="25">25</option>
					<option value="50">50</option>
					<option value="100">100</option>
				</select>
			</div>
		</div>

		<!-- Table -->
		<div class="card overflow-hidden">
			<DocumentTable
				documents={data.results}
				{selectedIds}
				{focusedRow}
				{sort}
				{direction}
				onsort={handleSort}
				onselect={handleSelect}
				onnavigate={(id) => goto(`${base}/documents/${id}`)}
			/>
		</div>

		<!-- Pagination -->
		{#if data.total_pages > 1}
			<nav class="flex items-center justify-center gap-0.5" aria-label="Pagination">
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
								? 'bg-interactive dark:bg-blue-700 text-white'
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
</div>
