<script lang="ts">
	import { page } from '$app/stores';
	import { createQuery } from '@tanstack/svelte-query';
	import { api, type TaxonomyField } from '$lib/services/api';
	import {
		ArrowLeft,
		Search,
		FileText,
		ChevronLeft,
		ChevronRight
	} from 'lucide-svelte';

	let fieldId = $derived($page.params.id);

	const fieldQuery = createQuery({
		queryKey: ['taxonomy', 'field', fieldId],
		queryFn: () => api.getField(fieldId)
	});

	// Search and pagination state
	let searchQuery = $state('');
	let currentPage = $state(1);
	const perPage = 50;

	// Filter and paginate terms
	let filteredTerms = $derived.by(() => {
		if (!$fieldQuery.data?.terms) return [];
		const terms = $fieldQuery.data.terms.filter(t => t.document_count > 0);
		if (!searchQuery.trim()) return terms;
		const q = searchQuery.toLowerCase();
		return terms.filter(t => t.name.toLowerCase().includes(q));
	});

	let totalPages = $derived(Math.ceil(filteredTerms.length / perPage));
	let paginatedTerms = $derived(
		filteredTerms.slice((currentPage - 1) * perPage, currentPage * perPage)
	);

	// Reset page when search changes
	$effect(() => {
		searchQuery;
		currentPage = 1;
	});

	function formatCount(count: number): string {
		if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
		if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
		return count.toString();
	}
</script>

<svelte:head>
	<title>{$fieldQuery.data?.name || 'Loading...'} | Browse | HSDL</title>
	<meta name="description" content="Browse {$fieldQuery.data?.name || ''} terms in the HSDL collection" />
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-6 sm:py-8">
	<!-- Back link -->
	<a
		href="/browse"
		class="inline-flex items-center gap-1.5 text-sm text-text-theme-secondary hover:text-chds-blue transition-colors mb-6"
	>
		<ArrowLeft class="w-4 h-4" />
		Back to Browse
	</a>

	{#if $fieldQuery.isPending}
		<div class="space-y-4">
			<div class="skeleton h-8 w-64 rounded"></div>
			<div class="skeleton h-5 w-32 rounded"></div>
			<div class="skeleton h-12 w-full rounded-lg mt-6"></div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
				{#each Array(10) as _}
					<div class="skeleton h-16 rounded-lg"></div>
				{/each}
			</div>
		</div>
	{:else if $fieldQuery.isError}
		<div class="card p-8 text-center">
			<p class="text-red-500 mb-4">Error loading field: {$fieldQuery.error.message}</p>
			<button onclick={() => $fieldQuery.refetch()} class="btn btn-primary">
				Try Again
			</button>
		</div>
	{:else if $fieldQuery.data}
		{@const field = $fieldQuery.data}
		{@const totalTermsWithDocs = field.terms.filter(t => t.document_count > 0).length}

		<!-- Page Header -->
		<div class="mb-6">
			<h1 class="text-2xl sm:text-3xl font-bold text-chds-navy mb-2">{field.name}</h1>
			<p class="text-text-theme-secondary">
				{totalTermsWithDocs.toLocaleString()} terms with documents
			</p>
		</div>

		<!-- Search Box -->
		<div class="relative mb-6">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-theme-tertiary" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Filter terms..."
				class="w-full pl-10 pr-4 py-3 rounded-lg border border-border-theme bg-surface-elevated text-text-theme-primary placeholder:text-text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-chds-blue/50 focus:border-chds-blue"
			/>
		</div>

		<!-- Results info -->
		<div class="flex items-center justify-between mb-4 text-sm text-text-theme-secondary">
			<span>
				{#if searchQuery.trim()}
					{filteredTerms.length.toLocaleString()} matches
				{:else}
					Showing {((currentPage - 1) * perPage + 1).toLocaleString()}-{Math.min(currentPage * perPage, filteredTerms.length).toLocaleString()} of {filteredTerms.length.toLocaleString()}
				{/if}
			</span>
			{#if totalPages > 1}
				<span>Page {currentPage} of {totalPages}</span>
			{/if}
		</div>

		<!-- Terms Grid -->
		{#if paginatedTerms.length === 0}
			<div class="card p-8 text-center">
				<p class="text-text-theme-secondary">No terms found matching "{searchQuery}"</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{#each paginatedTerms as term}
					<a
						href="/search?q={encodeURIComponent(term.name)}&mode=keyword"
						class="card p-4 hover:shadow-md hover:border-chds-blue/20 transition-all group flex items-center gap-3"
					>
						<div class="flex items-center justify-center w-10 h-10 rounded-lg bg-chds-blue/10 text-chds-blue flex-shrink-0">
							<FileText class="w-5 h-5" />
						</div>
						<div class="flex-1 min-w-0">
							<div class="font-medium text-text-theme-primary group-hover:text-chds-blue transition-colors line-clamp-2">
								{term.name}
							</div>
							<div class="text-sm text-text-theme-tertiary">
								{formatCount(term.document_count)} documents
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="flex items-center justify-center gap-2 mt-8">
				<button
					onclick={() => currentPage = Math.max(1, currentPage - 1)}
					disabled={currentPage === 1}
					class="p-2 rounded-lg border border-border-theme hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					<ChevronLeft class="w-5 h-5" />
				</button>

				{#each Array(Math.min(5, totalPages)) as _, i}
					{@const pageNum = currentPage <= 3
						? i + 1
						: currentPage >= totalPages - 2
							? totalPages - 4 + i
							: currentPage - 2 + i}
					{#if pageNum >= 1 && pageNum <= totalPages}
						<button
							onclick={() => currentPage = pageNum}
							class="w-10 h-10 rounded-lg border transition-colors {currentPage === pageNum
								? 'bg-chds-blue text-white border-chds-blue'
								: 'border-border-theme hover:bg-surface-secondary'}"
						>
							{pageNum}
						</button>
					{/if}
				{/each}

				<button
					onclick={() => currentPage = Math.min(totalPages, currentPage + 1)}
					disabled={currentPage === totalPages}
					class="p-2 rounded-lg border border-border-theme hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					<ChevronRight class="w-5 h-5" />
				</button>
			</div>
		{/if}
	{/if}
</div>
