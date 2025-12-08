<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { api } from '$lib/services/api';
	import {
		Search,
		Filter,
		Calendar,
		FileText,
		SlidersHorizontal,
		X,
		GraduationCap,
		ArrowUpDown,
		ChevronLeft,
		ChevronRight
	} from 'lucide-svelte';

	// Get search params from URL
	let query = $derived($page.url.searchParams.get('q') || '');
	let mode = $derived(($page.url.searchParams.get('mode') as 'semantic' | 'keyword') || 'semantic');
	let currentPage = $derived(parseInt($page.url.searchParams.get('page') || '1'));
	let yearStart = $derived($page.url.searchParams.get('year_start') || '');
	let yearEnd = $derived($page.url.searchParams.get('year_end') || '');
	let thesis = $derived($page.url.searchParams.get('thesis') || 'all');
	let sort = $derived($page.url.searchParams.get('sort') || 'relevance');

	// Local filter state for form
	let filterYearStart = $state('');
	let filterYearEnd = $state('');
	let showFilters = $state(false);

	// Sync filter state with URL params
	$effect(() => {
		filterYearStart = yearStart;
		filterYearEnd = yearEnd;
	});

	// Search query
	const searchQuery = createQuery({
		queryKey: ['search', query, mode, currentPage, yearStart, yearEnd, thesis, sort],
		queryFn: () =>
			api.search({
				q: query,
				mode,
				page: currentPage,
				per_page: 20,
				year_start: yearStart ? parseInt(yearStart) : undefined,
				year_end: yearEnd ? parseInt(yearEnd) : undefined,
				thesis: thesis as 'all' | 'thesis' | 'chds',
				sort: sort as 'relevance' | 'date' | 'title'
			}),
		enabled: !!query
	});

	// Build URL with current params
	function buildUrl(overrides: Record<string, string | undefined> = {}) {
		const params = new URLSearchParams();
		const values = {
			q: query,
			mode,
			page: currentPage.toString(),
			year_start: yearStart,
			year_end: yearEnd,
			thesis,
			sort,
			...overrides
		};

		for (const [key, value] of Object.entries(values)) {
			if (value && value !== 'all' && value !== 'relevance' && !(key === 'page' && value === '1')) {
				params.set(key, value);
			}
		}

		return `/search?${params.toString()}`;
	}

	function applyFilters() {
		goto(
			buildUrl({
				year_start: filterYearStart || undefined,
				year_end: filterYearEnd || undefined,
				page: '1'
			})
		);
	}

	function clearFilters() {
		filterYearStart = '';
		filterYearEnd = '';
		goto(buildUrl({ year_start: undefined, year_end: undefined, thesis: 'all', page: '1' }));
	}

	function hasActiveFilters(): boolean {
		return !!(yearStart || yearEnd || thesis !== 'all');
	}

	// Relevance bar helpers
	function getRelevanceWidth(score: number | undefined): string {
		if (score === undefined) return '0%';
		return `${Math.round(score * 100)}%`;
	}

	function getRelevanceColor(score: number | undefined): string {
		if (score === undefined) return 'bg-gray-300';
		if (score >= 0.8) return 'bg-green-500';
		if (score >= 0.6) return 'bg-lime-500';
		if (score >= 0.4) return 'bg-yellow-500';
		if (score >= 0.2) return 'bg-orange-500';
		return 'bg-red-500';
	}

	// Pagination helpers
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
	<title>{query ? `"${query}" - Search` : 'Search'} | HSDL</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-6 sm:py-8">
	<!-- Search Header -->
	<div class="mb-6">
		<form action="/search" method="GET" class="flex gap-2">
			<div class="relative flex-1">
				<input
					type="text"
					name="q"
					value={query}
					placeholder="Search documents..."
					class="input pr-10 text-lg"
				/>
				<Search class="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
			</div>
			<input type="hidden" name="mode" value={mode} />
			<button type="submit" class="btn btn-primary px-6">Search</button>
		</form>

		<!-- Controls Bar -->
		<div class="mt-4 flex flex-wrap items-center justify-between gap-4">
			<!-- Mode toggle -->
			<div class="flex items-center gap-2">
				<span class="text-sm text-gray-500">Mode:</span>
				<div class="flex gap-1">
					<a
						href={buildUrl({ mode: 'semantic', page: '1' })}
						class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors {mode === 'semantic'
							? 'bg-chds-blue text-white'
							: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					>
						Semantic
					</a>
					<a
						href={buildUrl({ mode: 'keyword', page: '1' })}
						class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors {mode === 'keyword'
							? 'bg-chds-blue text-white'
							: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					>
						Keyword
					</a>
				</div>
			</div>

			<!-- Filter and Sort -->
			<div class="flex items-center gap-2">
				<!-- Sort -->
				<div class="flex items-center gap-1">
					<ArrowUpDown class="w-4 h-4 text-gray-400" />
					<select
						class="text-sm border-0 bg-transparent text-gray-600 cursor-pointer focus:ring-0"
						onchange={(e) => goto(buildUrl({ sort: e.currentTarget.value, page: '1' }))}
					>
						<option value="relevance" selected={sort === 'relevance'}>Relevance</option>
						<option value="date" selected={sort === 'date'}>Date (newest)</option>
						<option value="title" selected={sort === 'title'}>Title (A-Z)</option>
					</select>
				</div>

				<!-- Filter toggle -->
				<button
					onclick={() => (showFilters = !showFilters)}
					class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors {showFilters || hasActiveFilters()
						? 'bg-chds-blue text-white'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				>
					<SlidersHorizontal class="w-4 h-4" />
					Filters
					{#if hasActiveFilters()}
						<span class="w-2 h-2 rounded-full bg-chds-gold"></span>
					{/if}
				</button>
			</div>
		</div>

		<!-- Filter Panel -->
		{#if showFilters}
			<div class="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
				<div class="flex flex-wrap gap-6">
					<!-- Year Range -->
					<div class="flex items-center gap-2">
						<Calendar class="w-4 h-4 text-gray-400" />
						<span class="text-sm text-gray-600">Year:</span>
						<input
							type="number"
							placeholder="From"
							bind:value={filterYearStart}
							class="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
							min="1900"
							max="2030"
						/>
						<span class="text-gray-400">-</span>
						<input
							type="number"
							placeholder="To"
							bind:value={filterYearEnd}
							class="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
							min="1900"
							max="2030"
						/>
					</div>

					<!-- Thesis Filter -->
					<div class="flex items-center gap-2">
						<GraduationCap class="w-4 h-4 text-gray-400" />
						<span class="text-sm text-gray-600">Type:</span>
						<div class="flex gap-1">
							<a
								href={buildUrl({ thesis: 'all', page: '1' })}
								class="px-2.5 py-1 rounded text-sm {thesis === 'all'
									? 'bg-chds-navy text-white'
									: 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}"
							>
								All
							</a>
							<a
								href={buildUrl({ thesis: 'thesis', page: '1' })}
								class="px-2.5 py-1 rounded text-sm {thesis === 'thesis'
									? 'bg-chds-navy text-white'
									: 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}"
							>
								Theses
							</a>
							<a
								href={buildUrl({ thesis: 'chds', page: '1' })}
								class="px-2.5 py-1 rounded text-sm {thesis === 'chds'
									? 'bg-chds-gold text-chds-navy font-medium'
									: 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}"
							>
								CHDS Only
							</a>
						</div>
					</div>
				</div>

				<!-- Filter Actions -->
				<div class="mt-4 flex gap-2">
					<button onclick={applyFilters} class="btn btn-primary text-sm py-1.5">
						Apply Filters
					</button>
					{#if hasActiveFilters()}
						<button onclick={clearFilters} class="btn btn-outline text-sm py-1.5">
							<X class="w-4 h-4" />
							Clear
						</button>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Results -->
	{#if !query}
		<div class="text-center py-16 text-gray-500">
			<Search class="w-16 h-16 mx-auto mb-4 opacity-50" />
			<p class="text-lg">Enter a search query to find documents</p>
			<p class="text-sm mt-2">
				Try searching for topics like "cybersecurity", "terrorism", or "emergency management"
			</p>
		</div>
	{:else if $searchQuery.isPending}
		<div class="space-y-4">
			{#each Array(5) as _}
				<div class="card p-4">
					<div class="skeleton h-6 w-3/4 mb-2 rounded"></div>
					<div class="skeleton h-4 w-full mb-1 rounded"></div>
					<div class="skeleton h-4 w-2/3 rounded"></div>
				</div>
			{/each}
		</div>
	{:else if $searchQuery.isError}
		<div class="text-center py-16">
			<p class="text-red-500 mb-4">Error loading results: {$searchQuery.error.message}</p>
			<button onclick={() => $searchQuery.refetch()} class="btn btn-primary">
				Try Again
			</button>
		</div>
	{:else if $searchQuery.data}
		{@const data = $searchQuery.data}

		<!-- Results Count -->
		<div class="mb-4 flex items-center justify-between">
			<p class="text-sm text-gray-600">
				Found <span class="font-semibold">{data.total_count.toLocaleString()}</span> results for
				<span class="font-medium">"{data.query}"</span>
			</p>
			{#if data.total_pages > 1}
				<p class="text-sm text-gray-500">
					Page {data.page} of {data.total_pages.toLocaleString()}
				</p>
			{/if}
		</div>

		<!-- Results List -->
		<div class="space-y-3">
			{#each data.results as doc}
				<article class="card p-4 hover:shadow-md transition-shadow">
					<div class="flex items-start gap-4">
						<div class="flex-1 min-w-0">
							<a href="/doc/{doc.id}" class="group">
								<h2
									class="font-semibold text-lg text-gray-900 group-hover:text-chds-blue transition-colors line-clamp-2"
								>
									{doc.title}
								</h2>
							</a>

							{#if doc.description}
								<p class="mt-2 text-gray-600 line-clamp-2 text-sm">
									{doc.description}
								</p>
							{/if}

							<div class="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
								{#if doc.publish_year}
									<span class="flex items-center gap-1">
										<Calendar class="w-4 h-4" />
										{doc.publish_year}
									</span>
								{/if}
								<span class="flex items-center gap-1">
									<FileText class="w-4 h-4" />
									{doc.doc_type}
								</span>
								{#if doc.is_thesis}
									<span class="badge bg-blue-100 text-blue-700">
										<GraduationCap class="w-3 h-3 mr-1" />
										Thesis
									</span>
								{/if}
								{#if doc.terms.length > 0}
									<div class="hidden sm:flex gap-1">
										{#each doc.terms.slice(0, 2) as term}
											<span class="badge badge-secondary">{term.name}</span>
										{/each}
									</div>
								{/if}
							</div>
						</div>

						<!-- Relevance score (for semantic search) -->
						{#if doc.relevance_score !== undefined}
							<div class="flex-shrink-0 w-16 text-right">
								<div class="text-sm font-semibold text-gray-700">
									{Math.round(doc.relevance_score * 100)}%
								</div>
								<div class="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
									<div
										class="h-full {getRelevanceColor(doc.relevance_score)} transition-all"
										style="width: {getRelevanceWidth(doc.relevance_score)}"
									></div>
								</div>
								<div class="text-xs text-gray-400 mt-0.5">match</div>
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>

		<!-- Pagination -->
		{#if data.total_pages > 1}
			<nav class="mt-8 flex items-center justify-center gap-1">
				<!-- Previous -->
				<a
					href={data.page > 1 ? buildUrl({ page: (data.page - 1).toString() }) : '#'}
					class="p-2 rounded-lg {data.page > 1
						? 'hover:bg-gray-100 text-gray-600'
						: 'text-gray-300 cursor-not-allowed'}"
					aria-disabled={data.page <= 1}
				>
					<ChevronLeft class="w-5 h-5" />
				</a>

				<!-- Page numbers -->
				{#each getPageNumbers(data.page, data.total_pages) as pageNum}
					{#if pageNum === '...'}
						<span class="px-2 text-gray-400">...</span>
					{:else}
						<a
							href={buildUrl({ page: pageNum.toString() })}
							class="px-3 py-1.5 rounded-lg text-sm font-medium {pageNum === data.page
								? 'bg-chds-blue text-white'
								: 'hover:bg-gray-100 text-gray-600'}"
						>
							{pageNum}
						</a>
					{/if}
				{/each}

				<!-- Next -->
				<a
					href={data.page < data.total_pages
						? buildUrl({ page: (data.page + 1).toString() })
						: '#'}
					class="p-2 rounded-lg {data.page < data.total_pages
						? 'hover:bg-gray-100 text-gray-600'
						: 'text-gray-300 cursor-not-allowed'}"
					aria-disabled={data.page >= data.total_pages}
				>
					<ChevronRight class="w-5 h-5" />
				</a>
			</nav>
		{/if}
	{/if}
</div>
