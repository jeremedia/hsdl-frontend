<script lang="ts">
	// Position picker for the BrowseNode editor (Option A from the
	// 2026-05-15 design conversation). Replaces the bare number input
	// with a sibling-context list and ↑/↓ + ↑↑/↓↓ buttons that drive
	// the /reorder endpoint directly.
	//
	// Why not just keep the number input: setting "Position = 3" is a
	// math problem that requires knowing every sibling's current
	// position. With this picker the curator sees the actual order,
	// where they sit in it (► marker), and reorders by clicking
	// neighbors — no math, no collisions, no remembered numbers.

	import { onMount } from 'svelte';
	import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Loader2 } from 'lucide-svelte';
	import { inkApi, type InkBrowseNode } from '$lib/services/ink-api';

	let {
		// The node we're positioning. Null when creating-new (the
		// picker hides itself in that case — you can't reorder
		// something that doesn't exist yet).
		nodeId,
		// First parent's id, used to scope the siblings list. Null
		// means top-level (rare; hubs / collection_groups). Picker
		// hides itself for top-level nodes since there's no parent
		// scope to reorder within.
		parentId,
		// All BrowseNodes — passed in instead of refetching. The
		// editor page already holds the full list via TanStack
		// query.
		allNodes,
		// Currently selected node's position. Read once on mount;
		// updated locally after each reorder.
		initialPosition,
		// Called after every successful reorder so the parent can
		// invalidate its BrowseNode list query and resync.
		onreordered
	}: {
		nodeId: string | null;
		parentId: string | null;
		allNodes: InkBrowseNode[];
		initialPosition: number;
		onreordered: () => void;
	} = $props();

	let busy = $state(false);
	let lastError = $state<string | null>(null);
	let currentPosition = $state(initialPosition);

	$effect(() => {
		// Resync when the user switches nodes in the tree (initial
		// position comes from the server payload for the new node).
		currentPosition = initialPosition;
	});

	// Siblings under the same parent, ordered by (position ASC, name).
	// Includes self so the picker can render the ► marker. Excludes
	// the current node when computing the list bounds but it stays
	// visible in the rendered order.
	let siblings = $derived(() => {
		if (!parentId) return [] as InkBrowseNode[];
		const list = allNodes.filter((n) => (n.parent_ids ?? []).includes(parentId));
		return list.slice().sort((a, b) => {
			const ap = a.position ?? 0;
			const bp = b.position ?? 0;
			if (ap !== bp) return ap - bp;
			return (a.name ?? '').localeCompare(b.name ?? '');
		});
	});

	// Where the current node currently sits in that ordering.
	let currentIndex = $derived(() => {
		if (!nodeId) return -1;
		return siblings().findIndex((n) => n.id === nodeId);
	});

	// Reorder driver. Calls the /reorder endpoint with action=move,
	// updates local position state on success, bubbles refresh up so
	// the tree resorts.
	async function moveTo(newPosition: number) {
		if (!nodeId || !parentId) return;
		if (newPosition === currentPosition) return;
		busy = true;
		lastError = null;
		try {
			const updated = await inkApi.reorderBrowseNode(nodeId, {
				parent_id: parentId,
				position: newPosition,
				op: 'move'
			});
			// The endpoint returns the full detail payload after
			// renumber_children! has rebalanced siblings 0..N-1.
			// Pick the new position from the relevant parent edge.
			const edge = (updated.parents ?? []).find((p: any) => p.id === parentId);
			currentPosition = edge?.position ?? newPosition;
			onreordered();
		} catch (err) {
			lastError = (err as Error).message || 'Reorder failed';
		} finally {
			busy = false;
		}
	}

	function moveUp() {
		const idx = currentIndex();
		if (idx <= 0) return;
		moveTo(Math.max(0, currentPosition - 1));
	}
	function moveDown() {
		const idx = currentIndex();
		const list = siblings();
		if (idx === -1 || idx >= list.length - 1) return;
		moveTo(currentPosition + 1);
	}
	function moveToTop() {
		if (currentIndex() <= 0) return;
		moveTo(0);
	}
	function moveToBottom() {
		const list = siblings();
		if (currentIndex() === list.length - 1) return;
		moveTo(list.length - 1);
	}

	// Quick lookup so the parent name renders without an extra query.
	let parentName = $derived(() => {
		if (!parentId) return null;
		return allNodes.find((n) => n.id === parentId)?.name ?? null;
	});

	let atTop = $derived(currentIndex() <= 0);
	let atBottom = $derived(currentIndex() === -1 || currentIndex() === siblings().length - 1);
	let multiParent = $derived(
		!!nodeId &&
			(allNodes.find((n) => n.id === nodeId)?.parent_ids?.length ?? 0) > 1
	);
</script>

{#if !nodeId || !parentId}
	<p class="text-[11px] text-text-theme-tertiary italic">
		{#if !nodeId}
			Position becomes editable after the node is saved.
		{:else}
			Top-level nodes (hubs, collection groups) don't have a parent to sort within.
		{/if}
	</p>
{:else}
	<div class="space-y-2">
		<!-- Header row: position + parent context + buttons -->
		<div class="flex items-center justify-between gap-2">
			<div class="text-[11px] text-text-theme-secondary">
				<span class="tabular-nums">{currentPosition + 1}</span>
				of
				<span class="tabular-nums">{siblings().length}</span>
				{#if parentName()}
					<span class="text-text-theme-tertiary">in {parentName()}</span>
				{/if}
			</div>
			<div class="flex items-center gap-1">
				<button
					type="button"
					class="btn btn-outline px-1.5 py-0.5 text-[11px] disabled:opacity-40"
					title="Move to top"
					aria-label="Move to top"
					disabled={busy || atTop}
					onclick={moveToTop}
				>
					<ChevronsUp size={12} />
				</button>
				<button
					type="button"
					class="btn btn-outline px-1.5 py-0.5 text-[11px] disabled:opacity-40"
					title="Move up"
					aria-label="Move up"
					disabled={busy || atTop}
					onclick={moveUp}
				>
					<ChevronUp size={12} />
				</button>
				<button
					type="button"
					class="btn btn-outline px-1.5 py-0.5 text-[11px] disabled:opacity-40"
					title="Move down"
					aria-label="Move down"
					disabled={busy || atBottom}
					onclick={moveDown}
				>
					<ChevronDown size={12} />
				</button>
				<button
					type="button"
					class="btn btn-outline px-1.5 py-0.5 text-[11px] disabled:opacity-40"
					title="Move to bottom"
					aria-label="Move to bottom"
					disabled={busy || atBottom}
					onclick={moveToBottom}
				>
					<ChevronsDown size={12} />
				</button>
				{#if busy}
					<Loader2 size={12} class="ml-1 animate-spin text-text-theme-tertiary" />
				{/if}
			</div>
		</div>

		{#if multiParent}
			<p class="text-[10px] text-amber-600 dark:text-amber-400 leading-snug">
				This node has multiple parents. The picker reorders within the first parent only.
			</p>
		{/if}

		<!-- Siblings list. Read-only context. -->
		<ul class="border border-border-theme rounded text-[11px] divide-y divide-border-theme max-h-56 overflow-y-auto bg-surface-elevated">
			{#each siblings() as sib, i (sib.id)}
				<li
					class="flex items-center gap-2 px-2 py-1
					{sib.id === nodeId ? 'bg-primary-100 dark:bg-primary-900/40 font-medium' : ''}"
				>
					<span class="w-3 text-text-theme-tertiary text-[10px]">
						{#if sib.id === nodeId}►{:else}&nbsp;{/if}
					</span>
					<span class="tabular-nums text-text-theme-tertiary w-5 text-right">{i}</span>
					<span class="truncate flex-1 min-w-0">{sib.name}</span>
				</li>
			{/each}
		</ul>

		{#if lastError}
			<p class="text-[10px] text-red-600 dark:text-red-400">{lastError}</p>
		{/if}
	</div>
{/if}
