<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { inkApi, type InkDocumentFull, type VocabularyField } from '$lib/services/ink-api';
	import { inkPrefs } from '$lib/stores/ink-preferences.svelte';
	import HealthBar from './HealthBar.svelte';
	import TermPicker from './TermPicker.svelte';
	import { Save, Loader2, ChevronDown, ChevronRight, Check, AlertCircle } from 'lucide-svelte';

	let { document }: { document: InkDocumentFull } = $props();

	const queryClient = useQueryClient();

	// Editable fields -- initialized and synced via $effect when document prop changes
	let title = $state('');
	let description = $state('');
	let publishDate = $state('');
	let url = $state('');
	let reportNumber = $state('');
	let enableStatus = $state<'not_set' | 'enabled' | 'disabled'>('not_set');
	let selectedAudience = $state('');

	// Section collapse state -- persisted so the editor remembers your layout
	const collapsed = inkPrefs.get<string[]>('editor.collapsedSections', []);
	let showClassification = $state(!collapsed.includes('classification'));
	let showVocabTerms = $state(!collapsed.includes('vocabTerms'));
	let showHealth = $state(!collapsed.includes('health'));
	let showAiContent = $state(!collapsed.includes('aiContent'));
	let showMarcSubjects = $state(!collapsed.includes('marcSubjects'));

	// Persist collapsed sections on toggle (not via $effect to avoid infinite loop)
	function persistCollapsed() {
		const sections: string[] = [];
		if (!showClassification) sections.push('classification');
		if (!showVocabTerms) sections.push('vocabTerms');
		if (!showHealth) sections.push('health');
		if (!showAiContent) sections.push('aiContent');
		if (!showMarcSubjects) sections.push('marcSubjects');
		inkPrefs.set('editor.collapsedSections', sections);
	}

	// Sync form fields when document prop changes
	$effect(() => {
		title = document.title;
		description = document.description || '';
		publishDate = document.publish_date || '';
		url = document.url || '';
		reportNumber = document.report_number || '';
		enableStatus = document.enable_status;
		selectedAudience = document.selected_audience || '';
	});

	let isDirty = $derived(
		title !== document.title ||
		description !== (document.description || '') ||
		publishDate !== (document.publish_date || '') ||
		url !== (document.url || '') ||
		reportNumber !== (document.report_number || '') ||
		enableStatus !== document.enable_status ||
		selectedAudience !== (document.selected_audience || '')
	);

	// Character/word count for description
	let descWordCount = $derived(
		description.trim() ? description.trim().split(/\s+/).length : 0
	);
	let descCharCount = $derived(description.length);

	// Vocabulary fields query
	const vocabFieldsQuery = createQuery({
		queryKey: ['ink', 'vocabulary_fields'],
		queryFn: () => inkApi.getVocabularyFields(),
		staleTime: 10 * 60 * 1000
	});

	// Save mutation
	let saveFlash = $state<'success' | 'error' | null>(null);
	let saveFlashTimer: ReturnType<typeof setTimeout> | null = null;

	const saveMutation = createMutation({
		mutationFn: (data: Record<string, unknown>) => inkApi.updateDocument(document.id, data),
		onSuccess: (updated: InkDocumentFull) => {
			queryClient.setQueryData(['ink', 'document', document.id], updated);
			queryClient.invalidateQueries({ queryKey: ['ink', 'documents'] });
			saveFlash = 'success';
			if (saveFlashTimer) clearTimeout(saveFlashTimer);
			saveFlashTimer = setTimeout(() => { saveFlash = null; }, 3000);
		},
		onError: () => {
			saveFlash = 'error';
			if (saveFlashTimer) clearTimeout(saveFlashTimer);
			saveFlashTimer = setTimeout(() => { saveFlash = null; }, 5000);
		}
	});

	function handleSave() {
		$saveMutation.mutate({
			title,
			description: description || null,
			publish_date: publishDate || null,
			url: url || null,
			report_number: reportNumber || null,
			enable_status: enableStatus,
			selected_audience: selectedAudience || null
		});
	}

	// Cmd/Ctrl+S to save
	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			if (isDirty && !$saveMutation.isPending) {
				handleSave();
			}
		}
	}

	// Term mutations
	const addTermMutation = createMutation({
		mutationFn: ({ termId }: { termId: string }) => inkApi.addDocumentTerm(document.id, termId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['ink', 'document', document.id] });
		}
	});

	const removeTermMutation = createMutation({
		mutationFn: ({ termId }: { termId: string }) => inkApi.removeDocumentTerm(document.id, termId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['ink', 'document', document.id] });
		}
	});

	function handleAddTerm(fieldName: string, term: { id: string; name: string }) {
		$addTermMutation.mutate({ termId: term.id });
	}

	function handleRemoveTerm(fieldName: string, termId: string) {
		$removeTermMutation.mutate({ termId });
	}

	// Health data signals
	let healthSignals = $derived.by(() => {
		if (!document.health_data) return [];
		const labels: Record<string, string> = {
			has_pdf: 'PDF',
			has_docling_markdown: 'Markdown',
			has_embedding: 'Embedding',
			has_full_text_embedding: 'Full-text Emb.',
			has_marc_subjects: 'MARC Subjects',
			has_entity_mentions: 'Entities',
			has_tags: 'Tags',
			has_summary: 'Summary',
			url_alive: 'URL Active',
			has_vocab_terms: 'Vocab Terms',
			has_title: 'Title',
			has_description: 'Description'
		};
		return Object.entries(document.health_data)
			.filter(([key]) => key.startsWith('has_') || key === 'url_alive')
			.map(([key, value]) => ({
				label: labels[key] || key,
				present: Boolean(value)
			}));
	});

	// Count vocabulary terms across all fields
	let totalTermCount = $derived.by(() => {
		let count = 0;
		for (const terms of Object.values(document.taxonomy)) {
			count += terms.length;
		}
		return count;
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="space-y-4 text-sm">
	<!-- Core Metadata (always visible) -->
	<section>
		<div class="space-y-2.5">
			<div>
				<label for="doc-title" class="block text-xs font-medium text-text-theme-secondary mb-0.5">Title</label>
				<input id="doc-title" type="text" bind:value={title} class="input text-sm py-1.5" />
			</div>

			<!-- Description: the #1 editing surface. Give it prime real estate. -->
			<div>
				<div class="flex items-center justify-between mb-0.5">
					<label for="doc-description" class="block text-xs font-medium text-text-theme-secondary">Description</label>
					<span class="text-[0.625rem] text-text-theme-tertiary tabular-nums">
						{descWordCount} words / {descCharCount} chars
					</span>
				</div>
				<textarea
					id="doc-description"
					bind:value={description}
					rows={10}
					class="input text-sm resize-y leading-relaxed"
					placeholder="Write or paste description here. 80% of descriptions use quoted material from the PDF."
				></textarea>
			</div>

			<div class="grid grid-cols-3 gap-2">
				<div>
					<label for="doc-date" class="block text-xs font-medium text-text-theme-secondary mb-0.5">Publish Date</label>
					<input id="doc-date" type="date" bind:value={publishDate} class="input text-xs py-1.5" />
				</div>
				<div>
					<label for="doc-report" class="block text-xs font-medium text-text-theme-secondary mb-0.5">Report #</label>
					<input id="doc-report" type="text" bind:value={reportNumber} class="input text-xs py-1.5" />
				</div>
				<div>
					<label for="doc-audience" class="block text-xs font-medium text-text-theme-secondary mb-0.5">Audience</label>
					<input id="doc-audience" type="text" bind:value={selectedAudience} class="input text-xs py-1.5" />
				</div>
			</div>

			<div>
				<label for="doc-url" class="block text-xs font-medium text-text-theme-secondary mb-0.5">URL</label>
				<input id="doc-url" type="url" bind:value={url} class="input text-xs py-1.5" />
			</div>
		</div>
	</section>

	<!-- Classification (collapsible) -->
	<section class="border-t border-theme pt-3">
		<button type="button" onclick={() => { showClassification = !showClassification; persistCollapsed(); }} class="flex items-center gap-1.5 w-full text-left mb-2">
			{#if showClassification}
				<ChevronDown size={14} class="text-text-theme-tertiary" />
			{:else}
				<ChevronRight size={14} class="text-text-theme-tertiary" />
			{/if}
			<h3 class="text-xs font-semibold text-text-theme-secondary uppercase tracking-wide">Classification</h3>
		</button>
		{#if showClassification}
			<div>
				<span class="block text-xs font-medium text-text-theme-secondary mb-1.5" id="enable-status-label">Enable Status</span>
				<div class="flex gap-3" role="radiogroup" aria-labelledby="enable-status-label">
					{#each ['not_set', 'enabled', 'disabled'] as status}
						<label class="flex items-center gap-1.5 text-xs cursor-pointer">
							<input
								type="radio"
								name="enable_status"
								value={status}
								checked={enableStatus === status}
								onchange={() => enableStatus = status as 'not_set' | 'enabled' | 'disabled'}
								class="text-interactive"
							/>
							<span class="capitalize">{status === 'not_set' ? 'Not Set' : status}</span>
						</label>
					{/each}
				</div>
			</div>
		{/if}
	</section>

	<!-- Vocabulary Terms (collapsible, high priority) -->
	{#if $vocabFieldsQuery.data}
		<section class="border-t border-theme pt-3">
			<button type="button" onclick={() => { showVocabTerms = !showVocabTerms; persistCollapsed(); }} class="flex items-center gap-1.5 w-full text-left mb-2">
				{#if showVocabTerms}
					<ChevronDown size={14} class="text-text-theme-tertiary" />
				{:else}
					<ChevronRight size={14} class="text-text-theme-tertiary" />
				{/if}
				<h3 class="text-xs font-semibold text-text-theme-secondary uppercase tracking-wide">Vocabulary Terms</h3>
				<span class="text-[0.625rem] text-text-theme-tertiary ml-auto">{totalTermCount} assigned</span>
			</button>
			{#if showVocabTerms}
				<div class="space-y-3">
					{#each $vocabFieldsQuery.data as field (field.id)}
						{@const fieldTerms = document.taxonomy[field.name] || []}
						<div>
							<div class="flex items-center justify-between mb-0.5">
								<span class="text-xs font-medium text-text-theme-primary">{field.name}</span>
								{#if fieldTerms.length > 0}
									<span class="text-[0.625rem] text-text-theme-tertiary">{fieldTerms.length}</span>
								{/if}
							</div>
							<TermPicker
								fieldId={field.id}
								selectedTerms={fieldTerms}
								onadd={(term) => handleAddTerm(field.name, term)}
								onremove={(termId) => handleRemoveTerm(field.name, termId)}
							/>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	<!-- Health Score (collapsible, starts collapsed) -->
	<section class="border-t border-theme pt-3">
		<button type="button" onclick={() => { showHealth = !showHealth; persistCollapsed(); }} class="flex items-center gap-1.5 w-full text-left mb-2">
			{#if showHealth}
				<ChevronDown size={14} class="text-text-theme-tertiary" />
			{:else}
				<ChevronRight size={14} class="text-text-theme-tertiary" />
			{/if}
			<h3 class="text-xs font-semibold text-text-theme-secondary uppercase tracking-wide">Document Health</h3>
			<span class="text-[0.625rem] text-text-theme-tertiary ml-auto">
				{document.health_score !== null ? Math.round(document.health_score * 100) + '%' : '--'}
			</span>
		</button>
		{#if showHealth}
			<div class="space-y-2">
				<div>
					<div class="flex items-center justify-between mb-1">
						<span class="text-xs font-medium">Overall Score</span>
						<span class="text-xs text-text-theme-secondary">
							{document.health_score !== null ? Math.round(document.health_score * 100) : '--'}%
						</span>
					</div>
					<HealthBar score={document.health_score} size="lg" />
				</div>

				{#if healthSignals.length > 0}
					<div class="grid grid-cols-2 gap-x-3 gap-y-0.5">
						{#each healthSignals as signal}
							<div class="flex items-center gap-1.5 text-xs">
								<span class="w-2 h-2 rounded-full flex-shrink-0 {signal.present ? 'bg-success' : 'bg-error'}"></span>
								<span class="text-text-theme-secondary">{signal.label}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</section>

	<!-- AI Content (read-only, collapsible) -->
	{#if document.tag_data || document.summary_data}
		<section class="border-t border-theme pt-3">
			<button type="button" onclick={() => { showAiContent = !showAiContent; persistCollapsed(); }} class="flex items-center gap-1.5 w-full text-left mb-2">
				{#if showAiContent}
					<ChevronDown size={14} class="text-text-theme-tertiary" />
				{:else}
					<ChevronRight size={14} class="text-text-theme-tertiary" />
				{/if}
				<h3 class="text-xs font-semibold text-text-theme-secondary uppercase tracking-wide">AI Content</h3>
			</button>
			{#if showAiContent}
				{#if document.summary_data}
					<div class="mb-2.5">
						<span class="text-xs font-medium text-text-theme-primary">Summary</span>
						<p class="text-xs text-text-theme-secondary mt-0.5 leading-relaxed">
							{typeof document.summary_data === 'string' ? document.summary_data : JSON.stringify(document.summary_data)}
						</p>
					</div>
				{/if}
				{#if document.tag_data}
					<div>
						<span class="text-xs font-medium text-text-theme-primary">Tags</span>
						<div class="flex flex-wrap gap-1 mt-0.5">
							{#each Object.entries(document.tag_data) as [category, tags]}
								{#if Array.isArray(tags)}
									{#each tags as tag}
										<span class="badge badge-secondary text-[0.625rem]">{tag}</span>
									{/each}
								{/if}
							{/each}
						</div>
					</div>
				{/if}
			{/if}
		</section>
	{/if}

	<!-- MARC Subjects (read-only, collapsible) -->
	{#if document.marc_subjects.length > 0}
		<section class="border-t border-theme pt-3">
			<button type="button" onclick={() => { showMarcSubjects = !showMarcSubjects; persistCollapsed(); }} class="flex items-center gap-1.5 w-full text-left mb-2">
				{#if showMarcSubjects}
					<ChevronDown size={14} class="text-text-theme-tertiary" />
				{:else}
					<ChevronRight size={14} class="text-text-theme-tertiary" />
				{/if}
				<h3 class="text-xs font-semibold text-text-theme-secondary uppercase tracking-wide">MARC Subjects</h3>
				<span class="text-[0.625rem] text-text-theme-tertiary ml-auto">{document.marc_subjects.length}</span>
			</button>
			{#if showMarcSubjects}
				<div class="flex flex-wrap gap-1">
					{#each document.marc_subjects as subject}
						<span class="badge badge-secondary text-[0.625rem]" title="{subject.heading_type}">
							{subject.heading}
						</span>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	<!-- Sticky Save Bar -->
	<div class="sticky bottom-0 bg-surface-elevated pt-2 pb-1 border-t border-theme -mx-4 px-4">
		<div class="flex items-center gap-2">
			<button
				type="submit"
				disabled={!isDirty || $saveMutation.isPending}
				class="btn btn-primary text-xs py-1.5 px-4 flex-1"
			>
				{#if $saveMutation.isPending}
					<Loader2 size={14} class="animate-spin" />
					Saving...
				{:else}
					<Save size={14} />
					Save Changes
				{/if}
			</button>
			{#if isDirty}
				<span class="text-[0.625rem] text-warning flex-shrink-0">Unsaved</span>
			{/if}
		</div>

		<!-- Flash messages -->
		{#if saveFlash === 'success'}
			<div class="flex items-center gap-1 mt-1 text-xs text-success">
				<Check size={12} />
				<span>Saved</span>
			</div>
		{/if}
		{#if saveFlash === 'error'}
			<div class="flex items-center gap-1 mt-1 text-xs text-error">
				<AlertCircle size={12} />
				<span>Save failed: {$saveMutation.error?.message || 'Unknown error'}</span>
			</div>
		{/if}

		<!-- Keyboard hint -->
		<div class="text-[0.5625rem] text-text-theme-tertiary mt-1">
			<kbd class="kbd" style="font-size: 0.5625rem; padding: 0 0.25rem; min-width: auto;">Cmd+S</kbd> to save
		</div>
	</div>
</form>
