<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { inkApi } from '$lib/services/ink-api';
	import { inkPrefs } from '$lib/stores/ink-preferences.svelte';
	import MetadataForm from '$lib/components/ink/MetadataForm.svelte';
	import HealthBar from '$lib/components/ink/HealthBar.svelte';
	import { ArrowLeft, ExternalLink, FileText, Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-svelte';

	let docId = $derived($page.params.id ?? '');

	const documentQuery = createQuery({
		queryKey: ['ink', 'document', docId],
		queryFn: () => inkApi.getDocument(docId)
	});

	let showPreview = $state(inkPrefs.get<boolean>('editor.showPdf', true));
	let previewWidth = $state(50); // percentage of the right panel

	function togglePreview() {
		showPreview = !showPreview;
		inkPrefs.set('editor.showPdf', showPreview);
	}

	// Keyboard shortcut: Cmd/Ctrl+Shift+P to toggle preview
	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
			e.preventDefault();
			togglePreview();
		}
	}
</script>

<svelte:head>
	<title>{$documentQuery.data?.title || 'Document'} | INK</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="h-full flex flex-col">
	<!-- Compact Header Bar -->
	<div class="flex items-center gap-2 py-2 flex-shrink-0 border-b border-theme mb-0">
		<a
			href="{base}/documents"
			class="p-1 rounded hover:bg-surface-secondary transition-colors flex-shrink-0"
			aria-label="Back to documents"
			title="Back to documents (or use browser back)"
		>
			<ArrowLeft size={16} />
		</a>

		{#if $documentQuery.data}
			<div class="min-w-0 flex-1">
				<h1 class="text-sm font-semibold text-text-theme-primary truncate">{$documentQuery.data.title}</h1>
				<p class="text-[0.625rem] text-text-theme-tertiary truncate">
					ID: {$documentQuery.data.doc_id}
					{#if $documentQuery.data.source}
						-- {$documentQuery.data.source}
					{/if}
					{#if $documentQuery.data.health_score !== null}
						-- Health: {Math.round($documentQuery.data.health_score * 100)}%
					{/if}
				</p>
			</div>
			<div class="flex items-center gap-1.5 flex-shrink-0">
				<button
					onclick={togglePreview}
					class="btn btn-outline text-xs py-1 px-2 hidden lg:flex"
					aria-label="{showPreview ? 'Hide' : 'Show'} preview"
					title="{showPreview ? 'Hide' : 'Show'} preview (Ctrl+Shift+P)"
				>
					{#if showPreview}
						<EyeOff size={13} />
						Hide PDF
					{:else}
						<Eye size={13} />
						Show PDF
					{/if}
				</button>
				{#if $documentQuery.data.url}
					<a
						href={$documentQuery.data.url}
						target="_blank"
						rel="noopener noreferrer"
						class="btn btn-outline text-xs py-1 px-2"
						title="Open source URL in new tab"
					>
						<ExternalLink size={13} /> Open
					</a>
				{/if}
			</div>
		{/if}
	</div>

	{#if $documentQuery.isPending}
		<div class="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3 min-h-0">
			<div class="card p-4 space-y-3 overflow-y-auto">
				{#each Array(8) as _}
					<div>
						<div class="skeleton h-3 w-16 mb-1.5 rounded"></div>
						<div class="skeleton h-7 w-full rounded"></div>
					</div>
				{/each}
			</div>
			<div class="card p-4 hidden lg:block">
				<div class="skeleton h-full w-full rounded"></div>
			</div>
		</div>
	{:else if $documentQuery.isError}
		<div class="card p-4 text-center mt-4">
			<p class="text-error text-sm mb-3">{$documentQuery.error.message}</p>
			<button onclick={() => $documentQuery.refetch()} class="btn btn-primary text-xs py-1 px-3">Retry</button>
		</div>
	{:else if $documentQuery.data}
		{@const doc = $documentQuery.data}

		<div class="flex-1 grid grid-cols-1 {showPreview ? 'lg:grid-cols-2' : ''} gap-3 pt-2 min-h-0">
			<!-- Left: Metadata Form (scrollable) -->
			<div class="card overflow-y-auto min-h-0 px-4 py-3">
				<MetadataForm document={doc} />
			</div>

			<!-- Right: PDF/Document Preview (fills remaining height) -->
			{#if showPreview}
				<div class="card overflow-hidden flex flex-col min-h-0 hidden lg:flex">
					<!-- Preview header -->
					<div class="flex items-center justify-between px-3 py-1.5 border-b border-theme flex-shrink-0">
						<h2 class="text-[0.625rem] font-semibold text-text-theme-tertiary uppercase tracking-wider flex items-center gap-1.5">
							<FileText size={12} /> Document Preview
						</h2>
						{#if doc.pdf_url}
							<a
								href={doc.pdf_url}
								target="_blank"
								rel="noopener noreferrer"
								class="text-[0.625rem] text-interactive hover:underline"
							>
								Open PDF
							</a>
						{/if}
					</div>

					<!-- Preview content (fills all remaining space) -->
					{#if doc.pdf_url}
						<iframe
							src={doc.pdf_url}
							title="PDF preview"
							class="flex-1 w-full min-h-0"
						></iframe>
					{:else if doc.has_docling_markdown}
						<div class="flex-1 overflow-y-auto p-3 prose prose-sm max-w-none text-text-theme-primary">
							<p class="text-text-theme-tertiary italic text-xs">Markdown preview available at document URL</p>
						</div>
					{:else if doc.url}
						<div class="flex-1 flex flex-col items-center justify-center text-text-theme-tertiary gap-2">
							<ExternalLink size={24} class="opacity-40" />
							<p class="text-xs">No inline preview available</p>
							<a
								href={doc.url}
								target="_blank"
								rel="noopener noreferrer"
								class="btn btn-primary text-xs py-1 px-3"
							>
								Open in new tab
							</a>
						</div>
					{:else}
						<div class="flex-1 flex items-center justify-center text-text-theme-tertiary">
							<p class="text-xs">No document content available</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
