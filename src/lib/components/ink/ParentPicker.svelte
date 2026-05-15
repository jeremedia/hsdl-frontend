<script lang="ts">
	// Parent picker for BrowseNode.parent_ids. Replaces the comma-
	// separated UUID textbox with a chip + autocomplete UX that knows
	// the kind→parent_kind rules:
	//
	//   hub               → no parent (top-level)
	//   sub_hub           → hub(s)
	//   collection_group  → no parent (top-level)
	//   collection_item   → collection_group(s)
	//
	// Top-level kinds render a small explanatory note and skip the
	// picker. Sub-types render the picker scoped to the right parent
	// kind, so a sub_hub editor can only pick hubs and a
	// collection_item editor can only pick collection_groups.

	import { createQuery } from '@tanstack/svelte-query';
	import { derived, writable } from 'svelte/store';
	import { inkApi, type InkBrowseNode, type BrowseNodeKind } from '$lib/services/ink-api';
	import { X, Plus, Loader2 } from 'lucide-svelte';

	let {
		parentIds,
		nodeKind,
		nodeId,
		onchange
	}: {
		parentIds: string[];
		nodeKind: BrowseNodeKind | undefined;
		nodeId: string | null;
		onchange: (next: string[]) => void;
	} = $props();

	// Parent-kind rules. Returns the kind we should autocomplete against,
	// or null if this kind doesn't take parents.
	function parentKindFor(kind: BrowseNodeKind | undefined): BrowseNodeKind | null {
		switch (kind) {
			case 'sub_hub':
				return 'hub';
			case 'collection_item':
				return 'collection_group';
			default:
				return null; // hub / collection_group are top-level
		}
	}

	let parentKind = $derived(parentKindFor(nodeKind));

	// Resolve chip metadata for currently-selected parent IDs. Uses the
	// same writable+derived bridge as FilterPicker because TanStack 5.90
	// reactive options must come through a Svelte store.
	const parentIdsStore = writable<string[]>([]);
	$effect(() => {
		parentIdsStore.set(parentIds);
	});

	const chipsQuery = createQuery(
		derived(parentIdsStore, ($ids) => ({
			queryKey: ['ink', 'browse_nodes', 'parent-chips', $ids.slice().sort().join(',')] as const,
			queryFn: async () => {
				if ($ids.length === 0) return [] as InkBrowseNode[];
				// listBrowseNodes returns the full collection; filter to the
				// IDs we need. With ~100 BrowseNodes total a single fetch is
				// cheaper than N round trips and we'd want the cached list
				// for the autocomplete anyway.
				const all = await inkApi.listBrowseNodes({});
				const byId = new Map(all.map((n) => [n.id, n]));
				return $ids.map((id) => byId.get(id)).filter((n): n is InkBrowseNode => !!n);
			},
			enabled: $ids.length > 0
		}))
	);

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

	const searchStateStore = writable<{ q: string; kind: BrowseNodeKind | null; enabled: boolean }>({
		q: '',
		kind: null,
		enabled: false
	});
	$effect(() => {
		searchStateStore.set({
			q: debouncedQuery,
			kind: parentKind,
			enabled: !!parentKind && showDropdown
		});
	});

	const searchQuery = createQuery(
		derived(searchStateStore, ($s) => ({
			queryKey: ['ink', 'browse_nodes', 'parent-candidates', $s.kind ?? '', $s.q] as const,
			queryFn: () =>
				inkApi.listBrowseNodes({
					kind: $s.kind ?? undefined,
					q: $s.q || undefined,
					limit: 25
				}),
			enabled: $s.enabled
		}))
	);

	let candidates = $derived(() => {
		const data = $searchQuery.data ?? [];
		const already = new Set(parentIds);
		// Exclude self (a node can't be its own parent) and any
		// already-selected parents.
		return data.filter((n) => n.id !== nodeId && !already.has(n.id));
	});

	function addParent(n: InkBrowseNode) {
		if (parentIds.includes(n.id)) return;
		onchange([...parentIds, n.id]);
		searchInput = '';
		debouncedQuery = '';
		showDropdown = false;
		highlightedIndex = -1;
		setTimeout(() => inputEl?.focus(), 0);
	}

	function removeParent(id: string) {
		onchange(parentIds.filter((pid) => pid !== id));
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
				addParent(items[highlightedIndex]);
			}
		} else if (e.key === 'Escape') {
			showDropdown = false;
			highlightedIndex = -1;
		}
	}

	let kindLabel = $derived(
		parentKind === 'hub'
			? 'hub'
			: parentKind === 'collection_group'
				? 'collection group'
				: ''
	);
</script>

<div class="space-y-3">
	{#if !parentKind}
		<!-- Top-level kinds (hub, collection_group) — no parent picker. -->
		<p class="text-[11px] text-text-theme-tertiary italic">
			{nodeKind === 'hub' || nodeKind === 'collection_group'
				? `${nodeKind === 'hub' ? 'Hubs' : 'Collection groups'} are top-level and don't have parents.`
				: 'Select a kind to choose parents.'}
		</p>
	{:else}
		<!-- Selected parent chips -->
		{#if parentIds.length === 0}
			<p class="text-[11px] text-text-theme-tertiary italic">
				No parent selected. {nodeKind === 'sub_hub'
					? 'A sub-hub must belong to at least one hub.'
					: 'A collection item must belong to at least one collection group.'}
			</p>
		{:else if $chipsQuery.isPending}
			<p class="text-[11px] text-text-theme-tertiary inline-flex items-center gap-1">
				<Loader2 class="w-3 h-3 animate-spin" /> Resolving parent names…
			</p>
		{:else}
			<div class="flex flex-wrap gap-1.5">
				{#each $chipsQuery.data ?? [] as chip (chip.id)}
					<span
						class="inline-flex items-center gap-1 rounded border border-border-theme bg-surface-elevated px-2 py-[3px] text-[11px]"
					>
						<span class="text-[10px] uppercase tracking-wider text-text-theme-tertiary">{chip.kind}</span>
						<span class="font-medium">{chip.name}</span>
						<button
							type="button"
							class="ml-1 hover:text-red-600 text-text-theme-tertiary"
							title="Remove this parent"
							aria-label="Remove parent: {chip.name}"
							onclick={() => removeParent(chip.id)}
						>
							<X class="w-3 h-3" />
						</button>
					</span>
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
					placeholder={`Add a ${kindLabel} parent — start typing a name`}
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

			{#if showDropdown && candidates().length > 0}
				<ul
					class="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded border border-border-theme bg-surface-elevated shadow-lg"
					role="listbox"
				>
					{#each candidates() as n, i (n.id)}
						<li>
							<button
								type="button"
								class="w-full text-left px-3 py-1.5 text-[12px] flex items-center justify-between gap-3 hover:bg-surface-secondary"
								class:bg-surface-secondary={i === highlightedIndex}
								onmousedown={(e) => {
									e.preventDefault();
									addParent(n);
								}}
							>
								<span class="flex items-baseline gap-2 min-w-0">
									<span class="text-[10px] uppercase tracking-wider text-text-theme-tertiary whitespace-nowrap">{n.kind}</span>
									<span class="truncate font-medium">{n.name}</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else if showDropdown && !$searchQuery.isFetching && debouncedQuery.length >= 1 && candidates().length === 0}
				<div class="absolute z-10 mt-1 w-full rounded border border-border-theme bg-surface-elevated px-3 py-2 text-[11px] text-text-theme-tertiary">
					No {kindLabel}s {debouncedQuery ? `start with "${debouncedQuery}"` : 'available'}.
				</div>
			{/if}
		</div>
	{/if}
</div>
