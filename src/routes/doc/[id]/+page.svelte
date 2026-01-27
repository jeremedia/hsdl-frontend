<script lang="ts">
	import { page } from '$app/stores';
	import { createQuery } from '@tanstack/svelte-query';
	import { api, type FullDocument } from '$lib/services/api';
	import {
		Calendar,
		FileText,
		Download,
		ExternalLink,
		Tag,
		Building2,
		Globe,
		Clock,
		ChevronLeft,
		BookOpen,
		Sparkles,
		ArrowRight,
		Hash,
		User,
		Library,
		Languages,
		Folder,
		MapPin,
		FileType,
		Layers
	} from 'lucide-svelte';

	let id = $derived($page.params.id);

	const docQuery = createQuery({
		queryKey: ['document', id],
		queryFn: () => api.getDocument(id),
		enabled: !!id
	});

	const similarQuery = createQuery({
		queryKey: ['similar', id],
		queryFn: () => api.getSimilarDocuments(id, 5),
		enabled: !!id
	});

	function formatFileSize(bytes: number | null): string {
		if (!bytes) return '';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '';
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function getSimilarityStyles(score: number): { bg: string; text: string } {
		if (score >= 0.9) return { bg: '#dcfce7', text: '#16a34a' }; // green
		if (score >= 0.8) return { bg: '#dbeafe', text: '#2563eb' }; // blue
		if (score >= 0.7) return { bg: '#fef3c7', text: '#d97706' }; // amber
		return { bg: '#f3f4f6', text: '#4b5563' }; // gray
	}

	// Icon mapping for metadata fields
	const fieldIcons: Record<string, typeof Calendar> = {
		'Publisher': Library,
		'Creator': User,
		'Language': Languages,
		'Subject': Tag,
		'Tab/Section': Folder,
		'Coverage - Country': MapPin,
		'Series': Hash,
		'Resource Type': FileType,
		'Format': Layers
	};
</script>

<svelte:head>
	<title>{$docQuery.data?.title || 'Document'} | HSDL</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-6 sm:py-8">
	<!-- Back navigation -->
	<a href="javascript:history.back()" class="inline-flex items-center gap-1.5 text-sm text-text-theme-tertiary hover:text-chds-blue transition-colors mb-6 group">
		<ChevronLeft class="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
		Back to results
	</a>

	{#if $docQuery.isPending}
		<div class="card p-6 sm:p-8 shadow-md">
			<div class="skeleton h-6 w-32 mb-4 rounded-full"></div>
			<div class="skeleton h-10 w-3/4 mb-4 rounded"></div>
			<div class="skeleton h-4 w-full mb-2 rounded"></div>
			<div class="skeleton h-4 w-full mb-2 rounded"></div>
			<div class="skeleton h-4 w-2/3 rounded"></div>
		</div>
	{:else if $docQuery.isError}
		<div class="card p-8 text-center shadow-md">
			<div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
				<FileText class="w-8 h-8 text-red-400" />
			</div>
			<p class="text-red-600 font-medium mb-2">Unable to load document</p>
			<p class="text-text-theme-tertiary text-sm mb-6">{$docQuery.error.message}</p>
			<a href="/" class="btn btn-primary">Return Home</a>
		</div>
	{:else if $docQuery.data}
		{@const doc = $docQuery.data}

		<article class="card shadow-md overflow-hidden">
			<!-- Hero header with gradient accent -->
			<div class="hero-gradient px-6 sm:px-8 py-4">
				<div class="flex flex-wrap items-center gap-2">
					{#if doc.is_chds_thesis}
						<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-chds-gold text-chds-navy shadow-sm">
							<BookOpen class="w-3.5 h-3.5" />
							CHDS Thesis
						</span>
					{:else if doc.is_thesis}
						<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-elevated/20 text-white">
							<BookOpen class="w-3.5 h-3.5" />
							Thesis
						</span>
					{/if}
					{#if doc.access_level}
						<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-surface-elevated/10 text-white/90 backdrop-blur-sm">
							{doc.access_level}
						</span>
					{/if}
				</div>
			</div>

			<div class="p-6 sm:p-8">
				<!-- Title -->
				<header class="mb-6">
					<h1 class="text-2xl sm:text-3xl font-bold text-chds-navy leading-tight tracking-tight">
						{doc.title}
					</h1>

					{#if doc.alternate_title}
						<p class="mt-3 text-lg text-text-theme-tertiary italic">{doc.alternate_title}</p>
					{/if}
				</header>

				<!-- Meta info bar - more prominent -->
				<div class="flex flex-wrap items-center gap-3 sm:gap-4 text-sm mb-6 pb-6 border-b border-border-theme">
					{#if doc.publish_date}
						<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-secondary text-text-theme-secondary font-medium">
							<Calendar class="w-4 h-4 text-chds-blue" />
							{formatDate(doc.publish_date)}
						</span>
					{/if}
					{#if doc.file_extension}
						<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-secondary text-text-theme-secondary">
							<FileText class="w-4 h-4 text-text-theme-tertiary" />
							<span class="font-medium">{doc.file_extension.toUpperCase().replace('.', '')}</span>
							{#if doc.file_size}
								<span class="text-text-theme-tertiary">({formatFileSize(doc.file_size)})</span>
							{/if}
						</span>
					{/if}
					{#if doc.report_number}
						<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-secondary text-text-theme-secondary">
							<Hash class="w-4 h-4 text-text-theme-tertiary" />
							{doc.report_number}
						</span>
					{/if}
				</div>

				<!-- Action buttons - more prominent with better hierarchy -->
				<div class="flex flex-wrap gap-3 mb-8">
					{#if doc.pdf_url}
						<a
							href={doc.pdf_url}
							target="_blank"
							rel="noopener"
							class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white bg-chds-blue hover:bg-chds-navy shadow-md hover:shadow-lg transition-all duration-200"
						>
							<Download class="w-5 h-5" />
							Download PDF
						</a>
					{/if}
					{#if doc.url}
						<a
							href={doc.url}
							target="_blank"
							rel="noopener"
							class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-chds-navy bg-surface-secondary hover:bg-surface-secondary border border-border-theme transition-all duration-200"
						>
							<ExternalLink class="w-5 h-5" />
							View Source
						</a>
					{/if}
				</div>

			<!-- Description -->
			{#if doc.description}
				<section class="mb-8">
					<h2 class="text-base font-semibold text-text-theme-primary mb-3 flex items-center gap-2">
						<span class="w-1 h-5 bg-chds-blue rounded-full"></span>
						Description
					</h2>
					<div class="prose prose-gray max-w-none">
						<p class="text-text-theme-secondary leading-relaxed whitespace-pre-line">{doc.description}</p>
					</div>
				</section>
			{/if}

			<!-- AI Summary -->
			{#if doc.summary}
				<section class="mb-8 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100/50 shadow-sm">
					<h2 class="text-base font-semibold text-chds-navy mb-3 flex items-center gap-2">
						<span class="flex items-center justify-center w-7 h-7 rounded-lg bg-chds-blue/10">
							<Sparkles class="w-4 h-4 text-chds-blue" />
						</span>
						AI Summary
					</h2>
					<p class="text-text-theme-secondary leading-relaxed">{doc.summary}</p>
				</section>
			{/if}

			<!-- Taxonomy (grouped metadata) -->
			{#if Object.keys(doc.taxonomy).length > 0}
				<section class="mb-8">
					<h2 class="text-base font-semibold text-text-theme-primary mb-4 flex items-center gap-2">
						<span class="w-1 h-5 bg-chds-blue rounded-full"></span>
						Metadata
					</h2>
					<div class="bg-surface-secondary/50 rounded-xl border border-border-theme overflow-hidden divide-y divide-border-theme">
						{#each Object.entries(doc.taxonomy) as [field, terms], i}
							{@const IconComponent = fieldIcons[field] || Tag}
							<div class="px-4 py-3 sm:px-5 sm:py-4 hover:bg-surface-secondary/80 transition-colors">
								<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
									<div class="flex items-center gap-2 sm:w-40 flex-shrink-0">
										<IconComponent class="w-4 h-4 text-text-theme-tertiary" />
										<h3 class="text-sm font-medium text-text-theme-tertiary">{field}</h3>
									</div>
									<div class="flex flex-wrap gap-1.5 flex-1">
										{#each terms as term}
											<a
												href="/search?q={encodeURIComponent(term.name)}&mode=keyword"
												class="inline-flex items-center px-2.5 py-1 rounded-md text-sm bg-surface-elevated border border-border-theme text-text-theme-secondary hover:border-chds-blue hover:text-chds-blue transition-colors shadow-sm"
											>
												{term.name}
											</a>
										{/each}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- AI-generated tags -->
			{#if doc.tags && (doc.tags.keywords?.length || doc.tags.organizations?.length || doc.tags.places?.length)}
				<section class="mb-8">
					<h2 class="text-base font-semibold text-text-theme-primary mb-4 flex items-center gap-2">
						<span class="w-1 h-5 bg-chds-gold rounded-full"></span>
						<span class="flex items-center gap-2">
							AI-Generated Tags
							<Sparkles class="w-4 h-4 text-chds-gold" />
						</span>
					</h2>
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{#if doc.tags.keywords?.length}
							<div class="p-4 rounded-xl bg-purple-50/50 border border-purple-100">
								<div class="flex items-center gap-2 mb-3">
									<span class="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-100">
										<Tag class="w-4 h-4 text-purple-600" />
									</span>
									<h3 class="text-sm font-semibold text-purple-900">Keywords</h3>
								</div>
								<div class="flex flex-wrap gap-1.5">
									{#each doc.tags.keywords as keyword}
										<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-700">{keyword}</span>
									{/each}
								</div>
							</div>
						{/if}
						{#if doc.tags.organizations?.length}
							<div class="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
								<div class="flex items-center gap-2 mb-3">
									<span class="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100">
										<Building2 class="w-4 h-4 text-emerald-600" />
									</span>
									<h3 class="text-sm font-semibold text-emerald-900">Organizations</h3>
								</div>
								<div class="flex flex-wrap gap-1.5">
									{#each doc.tags.organizations as org}
										<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-700">{org}</span>
									{/each}
								</div>
							</div>
						{/if}
						{#if doc.tags.places?.length}
							<div class="p-4 rounded-xl bg-amber-50/50 border border-amber-100">
								<div class="flex items-center gap-2 mb-3">
									<span class="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100">
										<Globe class="w-4 h-4 text-amber-600" />
									</span>
									<h3 class="text-sm font-semibold text-amber-900">Places</h3>
								</div>
								<div class="flex flex-wrap gap-1.5">
									{#each doc.tags.places as place}
										<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700">{place}</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</section>
			{/if}

			<!-- Document info footer -->
			<footer class="pt-6 mt-2 border-t border-border-theme">
				<div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-theme-tertiary">
					<span class="flex items-center gap-1.5">
						<Hash class="w-3.5 h-3.5" />
						HSDL ID: {doc.doc_id}
					</span>
					{#if doc.source}
						<span class="flex items-center gap-1.5">
							<Library class="w-3.5 h-3.5" />
							{doc.source}
						</span>
					{/if}
					<span class="flex items-center gap-1.5">
						<Clock class="w-3.5 h-3.5" />
						Updated {formatDate(doc.updated_at)}
					</span>
				</div>
			</footer>
			</div>
		</article>

		<!-- Similar Documents -->
		{#if $similarQuery.data?.similar?.length}
			<section class="mt-8">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-bold text-text-theme-primary flex items-center gap-2">
						<span class="w-1.5 h-6 bg-chds-gold rounded-full"></span>
						Similar Documents
					</h2>
					<span class="text-sm text-text-theme-tertiary">{$similarQuery.data.similar.length} found</span>
				</div>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
					{#each $similarQuery.data.similar as similar, i}
						{@const styles = getSimilarityStyles(similar.relevance_score || 0)}
						<a
							href="/doc/{similar.id}"
							class="group card p-4 sm:p-5 flex flex-col sm:flex-row gap-4 hover:shadow-lg hover:border-chds-blue/20 transition-all duration-200"
						>
							<!-- Similarity indicator -->
							<div class="flex sm:flex-col items-center gap-2 sm:gap-1">
								<div
									class="flex items-center justify-center w-12 h-12 rounded-xl font-bold text-lg"
									style="background-color: {styles.bg}; color: {styles.text};"
								>
									{Math.round((similar.relevance_score || 0) * 100)}%
								</div>
								<span class="text-xs text-text-theme-tertiary hidden sm:block">similar</span>
							</div>

							<!-- Content -->
							<div class="flex-1 min-w-0">
								<h3 class="font-semibold text-text-theme-primary group-hover:text-chds-blue transition-colors line-clamp-2 mb-2">
									{similar.title}
								</h3>
								{#if similar.description}
									<p class="text-sm text-text-theme-tertiary line-clamp-2 mb-3">{similar.description}</p>
								{/if}
								<div class="flex items-center gap-4 text-xs text-text-theme-tertiary">
									{#if similar.publish_year}
										<span class="flex items-center gap-1">
											<Calendar class="w-3.5 h-3.5" />
											{similar.publish_year}
										</span>
									{/if}
									<span class="flex items-center gap-1 text-chds-blue opacity-0 group-hover:opacity-100 transition-opacity">
										View document
										<ArrowRight class="w-3.5 h-3.5" />
									</span>
								</div>
							</div>
						</a>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>

<style>
	.hero-gradient {
		background: linear-gradient(135deg, #002B58 0%, #0268BB 100%);
	}
</style>
