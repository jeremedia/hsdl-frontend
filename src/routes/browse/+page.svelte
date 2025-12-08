<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { api, type TaxonomyField } from '$lib/services/api';
	import {
		ChevronRight,
		ChevronDown,
		Folder,
		FolderOpen,
		FileText,
		Globe,
		Users,
		Building2,
		BookOpen,
		Tag,
		Calendar,
		MapPin,
		Languages,
		Layers,
		Search
	} from 'lucide-svelte';

	const taxonomyQuery = createQuery({
		queryKey: ['taxonomy'],
		queryFn: () => api.getTaxonomy()
	});

	// Track which fields are expanded
	let expandedFields = $state<Set<string>>(new Set());

	function toggleField(fieldId: string) {
		if (expandedFields.has(fieldId)) {
			expandedFields.delete(fieldId);
		} else {
			expandedFields.add(fieldId);
		}
		expandedFields = new Set(expandedFields); // Trigger reactivity
	}

	// Icon mapping for different field types
	function getFieldIcon(fieldName: string) {
		const iconMap: Record<string, typeof Folder> = {
			'Coverage - Country': Globe,
			'Audience': Users,
			'Publisher': Building2,
			'Creator': Users,
			'Collection': Folder,
			'Subject': Tag,
			'FAST Subject': Tag,
			'Tab/Section': Layers,
			'Resource Type': FileText,
			'Language': Languages,
			'Format': FileText,
			'Series': BookOpen
		};
		return iconMap[fieldName] || Folder;
	}

	// Filter out empty fields and sort by term count
	function getVisibleFields(fields: TaxonomyField[]) {
		return fields
			.filter(f => f.term_count > 0)
			.sort((a, b) => b.term_count - a.term_count);
	}

	// Get top terms for a field (with documents)
	function getTopTerms(field: TaxonomyField, limit = 20) {
		return field.terms
			.filter(t => t.document_count > 0)
			.sort((a, b) => b.document_count - a.document_count)
			.slice(0, limit);
	}

	function formatCount(count: number): string {
		if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
		if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
		return count.toString();
	}
</script>

<svelte:head>
	<title>Browse | HSDL</title>
	<meta name="description" content="Browse the HSDL collection by category" />
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-6 sm:py-8">
	<!-- Page Header -->
	<div class="mb-8">
		<h1 class="text-2xl sm:text-3xl font-bold text-chds-navy mb-2">Browse Collection</h1>
		<p class="text-gray-600">Explore documents by category, subject, or region</p>
	</div>

	{#if $taxonomyQuery.isPending}
		<div class="space-y-4">
			{#each Array(6) as _}
				<div class="card p-4">
					<div class="flex items-center gap-3">
						<div class="skeleton w-10 h-10 rounded-lg"></div>
						<div class="flex-1">
							<div class="skeleton h-5 w-48 rounded mb-2"></div>
							<div class="skeleton h-4 w-24 rounded"></div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if $taxonomyQuery.isError}
		<div class="card p-8 text-center">
			<p class="text-red-500 mb-4">Error loading taxonomy: {$taxonomyQuery.error.message}</p>
			<button onclick={() => $taxonomyQuery.refetch()} class="btn btn-primary">
				Try Again
			</button>
		</div>
	{:else if $taxonomyQuery.data}
		{@const fields = getVisibleFields($taxonomyQuery.data.fields)}

		<!-- Quick Stats -->
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
			<div class="card p-4 text-center">
				<div class="text-2xl font-bold text-chds-blue">{fields.length}</div>
				<div class="text-sm text-gray-500">Categories</div>
			</div>
			<div class="card p-4 text-center">
				<div class="text-2xl font-bold text-chds-blue">
					{formatCount(fields.reduce((sum, f) => sum + f.term_count, 0))}
				</div>
				<div class="text-sm text-gray-500">Total Terms</div>
			</div>
			<div class="card p-4 text-center col-span-2 sm:col-span-2">
				<a href="/search" class="flex items-center justify-center gap-2 text-chds-blue hover:text-chds-navy transition-colors">
					<Search class="w-5 h-5" />
					<span class="font-medium">Search all documents</span>
				</a>
			</div>
		</div>

		<!-- Category List -->
		<div class="space-y-3">
			{#each fields as field}
				{@const IconComponent = getFieldIcon(field.name)}
				{@const isExpanded = expandedFields.has(field.id)}
				{@const topTerms = getTopTerms(field)}

				<div class="card overflow-hidden">
					<!-- Field Header -->
					<button
						onclick={() => toggleField(field.id)}
						class="w-full px-4 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
					>
						<div class="flex items-center justify-center w-10 h-10 rounded-lg bg-chds-blue/10 text-chds-blue flex-shrink-0">
							{#if isExpanded}
								<FolderOpen class="w-5 h-5" />
							{:else}
								<IconComponent class="w-5 h-5" />
							{/if}
						</div>
						<div class="flex-1 min-w-0">
							<h2 class="font-semibold text-gray-900">{field.name}</h2>
							<p class="text-sm text-gray-500">{field.term_count} terms</p>
						</div>
						<div class="flex items-center gap-2 text-gray-400">
							{#if isExpanded}
								<ChevronDown class="w-5 h-5" />
							{:else}
								<ChevronRight class="w-5 h-5" />
							{/if}
						</div>
					</button>

					<!-- Expanded Terms -->
					{#if isExpanded && topTerms.length > 0}
						<div class="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
							<div class="flex flex-wrap gap-2">
								{#each topTerms as term}
									<a
										href="/search?q={encodeURIComponent(term.name)}&mode=keyword"
										class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-white border border-gray-200 text-gray-700 hover:border-chds-blue hover:text-chds-blue transition-colors shadow-sm"
									>
										<span class="truncate max-w-[200px]">{term.name}</span>
										<span class="text-xs text-gray-400 font-medium">
											{formatCount(term.document_count)}
										</span>
									</a>
								{/each}
							</div>
							{#if field.terms.filter(t => t.document_count > 0).length > 20}
								<div class="mt-3 pt-3 border-t border-gray-200">
									<a
										href="/browse/{field.id}"
										class="text-sm text-chds-blue hover:text-chds-navy font-medium"
									>
										View all {field.terms.filter(t => t.document_count > 0).length} terms →
									</a>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Popular Subjects Quick Links -->
		{@const subjectField = fields.find(f => f.name === 'FAST Subject' || f.name === 'Subject')}
		{#if subjectField}
			<section class="mt-10">
				<h2 class="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
					<span class="w-1.5 h-6 bg-chds-gold rounded-full"></span>
					Popular Topics
				</h2>
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
					{#each getTopTerms(subjectField, 12) as term}
						<a
							href="/search?q={encodeURIComponent(term.name)}&mode=keyword"
							class="card p-3 hover:shadow-md hover:border-chds-blue/20 transition-all group"
						>
							<div class="font-medium text-gray-900 group-hover:text-chds-blue transition-colors line-clamp-2 text-sm">
								{term.name}
							</div>
							<div class="text-xs text-gray-400 mt-1">
								{formatCount(term.document_count)} docs
							</div>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Countries Quick Links -->
		{@const countryField = fields.find(f => f.name === 'Coverage - Country')}
		{#if countryField}
			<section class="mt-10">
				<h2 class="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
					<span class="w-1.5 h-6 bg-chds-blue rounded-full"></span>
					<Globe class="w-5 h-5 text-chds-blue" />
					Browse by Region
				</h2>
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
					{#each getTopTerms(countryField, 12) as term}
						<a
							href="/search?q={encodeURIComponent(term.name)}&mode=keyword"
							class="card p-3 hover:shadow-md hover:border-chds-blue/20 transition-all group"
						>
							<div class="font-medium text-gray-900 group-hover:text-chds-blue transition-colors line-clamp-1 text-sm">
								{term.name}
							</div>
							<div class="text-xs text-gray-400 mt-1">
								{formatCount(term.document_count)} docs
							</div>
						</a>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>
