<script lang="ts">
	// Filter picker for BrowseNode.filters.terms[]. Replaces the raw-JSON
	// textarea so curators (Amber, Donna, Courtney, Erin) can build
	// structural filters without writing JSON.
	//
	// UX contract:
	//   - The `terms` field is the only structured editor here. Other
	//     filter keys (sort, fielded_*, restricted, etc.) round-trip
	//     through `restJson` unchanged — surfaced under the "Advanced
	//     JSON" disclosure as a fallback for fields the picker doesn't
	//     model yet.
	//   - Selected terms render as chips grouped by vocabulary field.
	//     Same-field chips OR together at query time; different-field
	//     chips AND together (this is the controller's filter semantics).
	//   - The autocomplete searches across ALL vocabulary fields by
	//     usage, so a curator typing "thesis" sees Thesis (NPS), Thesis
	//     (CHDS), and Theses and dissertations alongside any Publisher
	//     or Subject matches.

	import { createQuery } from '@tanstack/svelte-query';
	import { inkApi, type FilterTerm } from '$lib/services/ink-api';
	import { X, Plus, Loader2 } from 'lucide-svelte';

	let {
		filters,
		onchange
	}: {
		filters: Record<string, unknown>;
		onchange: (next: Record<string, unknown>) => void;
	} = $props();

	// Pull terms array out of the filters object. Tolerant: accepts
	// missing key, non-array value, or array of non-strings.
	let termIds = $derived(
		Array.isArray(filters?.terms)
			? (filters.terms as unknown[]).filter((x): x is string => typeof x === 'string')
			: []
	);

	// Everything in filters EXCEPT terms — round-tripped untouched.
	let restJson = $derived(() => {
		const { terms: _, ...rest } = (filters ?? {}) as Record<string, unknown>;
		return JSON.stringify(rest, null, 2);
	});

	// Resolve chip metadata for the currently-selected term IDs.
	const chipsQuery = createQuery({
		get queryKey() {
			return ['ink', 'vocab-terms', 'lookup', termIds.slice().sort().join(',')] as const;
		},
		queryFn: () => inkApi.lookupVocabTerms(termIds),
		get enabled() {
			return termIds.length > 0;
		}
	});

	// Group resolved chips by field name so same-field selections sit
	// together visually (this also mirrors the controller's OR-within /
	// AND-across grouping).
	let chipsByField = $derived(() => {
		const data = $chipsQuery.data ?? [];
		const byId = new Map(data.map((t) => [t.id, t]));
		const groups = new Map<string, FilterTerm[]>();
		// Preserve termIds order within each field.
		for (const id of termIds) {
			const t = byId.get(id);
			if (!t) continue;
			const field = t.field ?? 'Unknown field';
			if (!groups.has(field)) groups.set(field, []);
			groups.get(field)!.push(t);
		}
		return Array.from(groups.entries());
	});

	// Autocomplete state.
	let searchInput = $state('');
	let showDropdown = $state(false);
	let debouncedQuery = $state('');
	let highlightedIndex = $state(-1);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
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

	let dropdownEnabled = $derived(showDropdown && debouncedQuery.length >= 2);
	const searchQuery = createQuery({
		get queryKey() {
			return ['ink', 'vocab-terms', 'search', debouncedQuery] as const;
		},
		queryFn: () => inkApi.searchVocabTerms(debouncedQuery, 15),
		get enabled() {
			return dropdownEnabled;
		}
	});

	let candidates = $derived(() => {
		const data = $searchQuery.data ?? [];
		const already = new Set(termIds);
		return data.filter((t) => !already.has(t.id));
	});

	function emit(next_terms: string[]) {
		const next = { ...(filters ?? {}) } as Record<string, unknown>;
		if (next_terms.length === 0) delete next.terms;
		else next.terms = next_terms;
		onchange(next);
	}

	function addTerm(t: FilterTerm) {
		if (termIds.includes(t.id)) return;
		emit([...termIds, t.id]);
		searchInput = '';
		debouncedQuery = '';
		showDropdown = false;
		highlightedIndex = -1;
		setTimeout(() => inputEl?.focus(), 0);
	}

	function removeTerm(id: string) {
		emit(termIds.filter((tid) => tid !== id));
	}

	function onKeydown(e: KeyboardEvent) {
		const items = candidates();
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (!items.length) return;
			highlightedIndex = (highlightedIndex + 1) % items.length;
			showDropdown = true;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (!items.length) return;
			highlightedIndex = (highlightedIndex - 1 + items.length) % items.length;
		} else if (e.key === 'Enter') {
			if (highlightedIndex >= 0 && items[highlightedIndex]) {
				e.preventDefault();
				addTerm(items[highlightedIndex]);
			}
		} else if (e.key === 'Escape') {
			showDropdown = false;
			highlightedIndex = -1;
		}
	}

	// Advanced raw-JSON fallback for the non-terms keys.
	let advancedOpen = $state(false);
	let restText = $state('');
	let restError = $state<string | null>(null);
	$effect(() => {
		// Re-sync the textarea when filters change externally.
		restText = restJson();
	});

	function applyRestJson() {
		try {
			const parsed = restText.trim() ? JSON.parse(restText) : {};
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
				restError = 'Advanced filters must be a JSON object.';
				return;
			}
			restError = null;
			const merged: Record<string, unknown> = { ...parsed };
			if (termIds.length) merged.terms = termIds;
			else delete merged.terms;
			onchange(merged);
		} catch (e) {
			restError = `Invalid JSON: ${(e as Error).message}`;
		}
	}
</script>

<div class="space-y-3">
	<!-- Selected term chips, grouped by field -->
	{#if termIds.length === 0}
		<p class="text-[11px] text-text-theme-tertiary italic">No filters set. Add one below to scope this collection to a vocabulary term.</p>
	{:else if $chipsQuery.isPending}
		<p class="text-[11px] text-text-theme-tertiary inline-flex items-center gap-1">
			<Loader2 class="w-3 h-3 animate-spin" /> Resolving filter labels…
		</p>
	{:else}
		<div class="space-y-2">
			{#each chipsByField() as [field, chips] (field)}
				<div class="space-y-1">
					<p class="text-[10px] uppercase tracking-wider text-text-theme-tertiary">
						{field}
						{#if chips.length > 1}
							<span class="ml-1 normal-case text-[9px] text-text-theme-tertiary">· any of these</span>
						{/if}
					</p>
					<div class="flex flex-wrap gap-1.5">
						{#each chips as chip (chip.id)}
							<span
								class="inline-flex items-start gap-1 rounded border border-border-theme bg-surface-elevated px-2 py-[3px] text-[11px]"
							>
								<span class="font-medium">{chip.name}</span>
								<span class="text-text-theme-tertiary tabular-nums text-[10px]">({chip.document_count.toLocaleString()})</span>
								<button
									type="button"
									class="ml-1 hover:text-red-600 text-text-theme-tertiary"
									title="Remove this filter"
									aria-label="Remove filter: {field} {chip.name}"
									onclick={() => removeTerm(chip.id)}
								>
									<X class="w-3 h-3" />
								</button>
							</span>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Autocomplete input -->
	<div class="relative">
		<div class="relative">
			<input
				bind:this={inputEl}
				type="text"
				bind:value={searchInput}
				oninput={() => (showDropdown = true)}
				onfocus={() => (showDropdown = true)}
				onblur={() => setTimeout(() => (showDropdown = false), 150)}
				onkeydown={onKeydown}
				placeholder="Add a filter — type a Tab/Section, Publisher, Subject, etc."
				class="input text-[12px] pr-8"
				autocomplete="off"
			/>
			<span class="absolute right-2 top-1/2 -translate-y-1/2 text-text-theme-tertiary">
				{#if $searchQuery.isFetching}
					<Loader2 class="w-3 h-3 animate-spin" />
				{:else}
					<Plus class="w-3 h-3" />
				{/if}
			</span>
		</div>

		{#if dropdownEnabled && candidates().length > 0}
			<ul
				class="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded border border-border-theme bg-surface-elevated shadow-lg"
				role="listbox"
			>
				{#each candidates() as t, i (t.id)}
					<li>
						<button
							type="button"
							class="w-full text-left px-3 py-1.5 text-[12px] flex items-center justify-between gap-3 hover:bg-surface-secondary"
							class:bg-surface-secondary={i === highlightedIndex}
							onmousedown={(e) => {
								e.preventDefault();
								addTerm(t);
							}}
						>
							<span class="flex items-baseline gap-2 min-w-0">
								<span class="truncate font-medium">{t.name}</span>
								<span class="text-[10px] uppercase tracking-wider text-text-theme-tertiary whitespace-nowrap">{t.field}</span>
							</span>
							<span class="text-[10px] tabular-nums text-text-theme-tertiary whitespace-nowrap">{t.document_count.toLocaleString()} docs</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else if dropdownEnabled && !$searchQuery.isFetching && debouncedQuery.length >= 2 && candidates().length === 0}
			<div class="absolute z-10 mt-1 w-full rounded border border-border-theme bg-surface-elevated px-3 py-2 text-[11px] text-text-theme-tertiary">
				No vocabulary terms start with "{debouncedQuery}".
			</div>
		{/if}
	</div>

	<!-- Advanced (non-terms keys) -->
	<details bind:open={advancedOpen} class="border-t border-border-theme pt-2 mt-2">
		<summary class="cursor-pointer text-[10px] uppercase tracking-wider text-text-theme-tertiary">
			Advanced — other filter keys (sort, fielded_*, restricted, …)
		</summary>
		<div class="mt-2 space-y-1">
			<textarea
				class="input font-mono text-[11px]"
				rows="4"
				bind:value={restText}
				onblur={applyRestJson}
			></textarea>
			{#if restError}
				<p class="text-[10px] text-red-600">{restError}</p>
			{:else}
				<p class="text-[10px] text-text-theme-tertiary">
					JSON for filter keys other than <code class="text-[10px]">terms</code>. Picker-managed terms above are merged in on save.
				</p>
			{/if}
		</div>
	</details>
</div>
