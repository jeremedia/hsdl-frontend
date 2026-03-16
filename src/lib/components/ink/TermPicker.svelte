<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { inkApi, type VocabularyTerm } from '$lib/services/ink-api';
	import { X, Plus, Loader2 } from 'lucide-svelte';

	let {
		fieldId,
		selectedTerms,
		onadd,
		onremove
	}: {
		fieldId: string;
		selectedTerms: Array<{ id: string; name: string }>;
		onadd: (term: { id: string; name: string }) => void;
		onremove: (termId: string) => void;
	} = $props();

	let searchInput = $state('');
	let showDropdown = $state(false);
	let highlightedIndex = $state(-1);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let debouncedQuery = $state('');
	let inputEl: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
		const value = searchInput;
		debounceTimer = setTimeout(() => {
			debouncedQuery = value;
			highlightedIndex = -1;
		}, 200);
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});

	let queryEnabled = $derived(showDropdown && debouncedQuery.length >= 2);
	let queryKey = $derived(['ink', 'terms', fieldId, debouncedQuery] as const);

	const termsQuery = createQuery({
		get queryKey() { return queryKey; },
		queryFn: () =>
			inkApi.getTerms(fieldId, {
				q: debouncedQuery || undefined,
				per_page: 25
			}),
		get enabled() { return queryEnabled; }
	});

	let selectedIds = $derived(new Set(selectedTerms.map((t) => t.id)));

	let filteredResults = $derived.by(() => {
		if (!$termsQuery.data) return [];
		return $termsQuery.data.results.filter((t: VocabularyTerm) => !selectedIds.has(t.id));
	});

	function handleSelect(term: VocabularyTerm) {
		onadd({ id: term.id, name: term.name });
		searchInput = '';
		showDropdown = false;
		highlightedIndex = -1;
		// Keep focus on input for rapid term addition
		requestAnimationFrame(() => inputEl?.focus());
	}

	function handleInputFocus() {
		showDropdown = true;
	}

	function handleInputBlur() {
		// Delay to allow click on dropdown items
		setTimeout(() => {
			showDropdown = false;
			highlightedIndex = -1;
		}, 200);
	}

	function handleInputKeydown(e: KeyboardEvent) {
		if (!showDropdown || filteredResults.length === 0) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				highlightedIndex = Math.min(highlightedIndex + 1, filteredResults.length - 1);
				scrollHighlightedIntoView();
				break;
			case 'ArrowUp':
				e.preventDefault();
				highlightedIndex = Math.max(highlightedIndex - 1, 0);
				scrollHighlightedIntoView();
				break;
			case 'Enter':
				e.preventDefault();
				if (highlightedIndex >= 0 && filteredResults[highlightedIndex]) {
					handleSelect(filteredResults[highlightedIndex]);
				}
				break;
			case 'Escape':
				showDropdown = false;
				highlightedIndex = -1;
				break;
		}
	}

	function scrollHighlightedIntoView() {
		requestAnimationFrame(() => {
			const el = document.getElementById(`term-option-${fieldId}-${highlightedIndex}`);
			if (el) el.scrollIntoView({ block: 'nearest' });
		});
	}
</script>

<div class="space-y-1.5">
	<!-- Selected terms as chips -->
	{#if selectedTerms.length > 0}
		<div class="flex flex-wrap gap-1">
			{#each selectedTerms as term (term.id)}
				<span class="inline-flex items-center gap-0.5 pl-2 pr-1 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full group">
					<span class="truncate max-w-[200px]">{term.name}</span>
					<button
						type="button"
						onclick={() => onremove(term.id)}
						class="p-0.5 rounded-full hover:bg-primary-200 hover:text-error transition-colors"
						aria-label="Remove {term.name}"
					>
						<X size={10} />
					</button>
				</span>
			{/each}
		</div>
	{/if}

	<!-- Search input -->
	<div class="relative">
		<div class="flex items-center">
			<div class="relative flex-1">
				<Plus size={12} class="absolute left-2 top-1/2 -translate-y-1/2 text-text-theme-tertiary" />
				<input
					bind:this={inputEl}
					type="text"
					bind:value={searchInput}
					onfocus={handleInputFocus}
					onblur={handleInputBlur}
					onkeydown={handleInputKeydown}
					placeholder="Type to search terms..."
					class="input text-xs py-1 pl-6 pr-2"
					role="combobox"
					aria-expanded={showDropdown && debouncedQuery.length >= 2}
					aria-autocomplete="list"
					aria-controls="term-listbox-{fieldId}"
					aria-activedescendant={highlightedIndex >= 0 ? `term-option-${fieldId}-${highlightedIndex}` : undefined}
				/>
				{#if $termsQuery.isPending && queryEnabled}
					<Loader2 size={12} class="absolute right-2 top-1/2 -translate-y-1/2 text-text-theme-tertiary animate-spin" />
				{/if}
			</div>
		</div>

		<!-- Dropdown -->
		{#if showDropdown && debouncedQuery.length >= 2}
			<div
				id="term-listbox-{fieldId}"
				role="listbox"
				class="absolute z-20 mt-0.5 w-full bg-surface-elevated border border-theme rounded shadow-lg max-h-52 overflow-y-auto"
			>
				{#if $termsQuery.isPending}
					<div class="px-3 py-2 text-xs text-text-theme-tertiary flex items-center gap-1.5">
						<Loader2 size={12} class="animate-spin" />
						Searching...
					</div>
				{:else if filteredResults.length === 0}
					<div class="px-3 py-2 text-xs text-text-theme-tertiary">
						{#if $termsQuery.data && $termsQuery.data.results.length > 0}
							All matching terms already assigned
						{:else}
							No matching terms found
						{/if}
					</div>
				{:else}
					{#each filteredResults as term, i (term.id)}
						<button
							id="term-option-{fieldId}-{i}"
							type="button"
							role="option"
							aria-selected={i === highlightedIndex}
							class="w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between gap-2
								{i === highlightedIndex ? 'bg-primary-100 text-primary-700' : 'hover:bg-surface-secondary'}"
							onmousedown={() => handleSelect(term)}
							onmouseenter={() => (highlightedIndex = i)}
						>
							<span class="truncate">{term.name}</span>
							<span class="text-[0.625rem] text-text-theme-tertiary flex-shrink-0 tabular-nums" title="{term.vocabulary_term_relations_count} documents use this term">
								{term.vocabulary_term_relations_count} docs
							</span>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Hint for empty fields -->
	{#if selectedTerms.length === 0 && !showDropdown}
		<p class="text-[0.625rem] text-text-theme-tertiary">No terms assigned. Type at least 2 characters to search.</p>
	{/if}
</div>
