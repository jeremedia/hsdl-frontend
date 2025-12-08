<script lang="ts">
	import { page } from '$app/stores';
	import { createQuery } from '@tanstack/svelte-query';
	import { api, type SearchResult } from '$lib/services/api';
	import { Search, Filter, Calendar, FileText } from 'lucide-svelte';

	// Get search params from URL
	let query = $derived($page.url.searchParams.get('q') || '');
	let mode = $derived(($page.url.searchParams.get('mode') as 'semantic' | 'keyword') || 'semantic');

	// Search query
	const searchQuery = createQuery({
		queryKey: ['search', query, mode],
		queryFn: () => api.search({ q: query, mode, per_page: 20 }),
		enabled: !!query
	});

	// Relevance bar width calculation
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
</script>

<svelte:head>
	<title>{query ? `"${query}" - Search` : 'Search'} | HSDL</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8">
	<!-- Search Header -->
	<div class="mb-8">
		<form action="/search" method="GET" class="flex gap-2">
			<div class="relative flex-1">
				<input
					type="text"
					name="q"
					value={query}
					placeholder="Search documents..."
					class="input pr-10"
				/>
				<Search class="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
			</div>
			<input type="hidden" name="mode" value={mode} />
			<button type="submit" class="btn btn-primary">Search</button>
		</form>

		<!-- Mode toggle -->
		<div class="mt-4 flex items-center gap-4">
			<span class="text-sm text-gray-600">Search mode:</span>
			<div class="flex gap-2">
				<a
					href="/search?q={encodeURIComponent(query)}&mode=semantic"
					class="px-3 py-1 rounded-full text-sm transition-colors {mode === 'semantic' ? 'bg-chds-blue text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				>
					Semantic
				</a>
				<a
					href="/search?q={encodeURIComponent(query)}&mode=keyword"
					class="px-3 py-1 rounded-full text-sm transition-colors {mode === 'keyword' ? 'bg-chds-blue text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				>
					Keyword
				</a>
			</div>
		</div>
	</div>

	<!-- Results -->
	{#if !query}
		<div class="text-center py-16 text-gray-500">
			<Search class="w-16 h-16 mx-auto mb-4 opacity-50" />
			<p>Enter a search query to find documents</p>
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
		<div class="text-center py-16 text-red-500">
			<p>Error loading results: {$searchQuery.error.message}</p>
		</div>
	{:else if $searchQuery.data}
		{@const data = $searchQuery.data}
		<div class="mb-4 text-sm text-gray-600">
			Found {data.total_count.toLocaleString()} results for "{data.query}"
		</div>

		<div class="space-y-4">
			{#each data.results as doc}
				<article class="card p-4 hover:shadow-md transition-shadow">
					<div class="flex items-start gap-4">
						<div class="flex-1 min-w-0">
							<a href="/doc/{doc.id}" class="group">
								<h2 class="font-semibold text-lg text-gray-900 group-hover:text-chds-blue transition-colors line-clamp-2">
									{doc.title}
								</h2>
							</a>

							{#if doc.description}
								<p class="mt-2 text-gray-600 line-clamp-2">
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
								{#if doc.terms.length > 0}
									<div class="flex gap-1">
										{#each doc.terms.slice(0, 3) as term}
											<span class="badge badge-secondary">{term.name}</span>
										{/each}
									</div>
								{/if}
							</div>
						</div>

						<!-- Relevance score (for semantic search) -->
						{#if doc.relevance_score !== undefined}
							<div class="flex-shrink-0 w-20 text-right">
								<div class="text-sm font-medium text-gray-700">
									{Math.round(doc.relevance_score * 100)}%
								</div>
								<div class="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden">
									<div
										class="h-full {getRelevanceColor(doc.relevance_score)} transition-all"
										style="width: {getRelevanceWidth(doc.relevance_score)}"
									></div>
								</div>
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>

		<!-- Pagination -->
		{#if data.total_pages > 1}
			<div class="mt-8 flex justify-center gap-2">
				{#if data.page > 1}
					<a
						href="/search?q={encodeURIComponent(query)}&mode={mode}&page={data.page - 1}"
						class="btn btn-outline"
					>
						Previous
					</a>
				{/if}
				<span class="px-4 py-2 text-gray-600">
					Page {data.page} of {data.total_pages}
				</span>
				{#if data.page < data.total_pages}
					<a
						href="/search?q={encodeURIComponent(query)}&mode={mode}&page={data.page + 1}"
						class="btn btn-outline"
					>
						Next
					</a>
				{/if}
			</div>
		{/if}
	{/if}
</div>
