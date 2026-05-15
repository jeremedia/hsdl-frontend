<script lang="ts">
	// Top-level BrowseTree renderer for /ink/browse. Owns:
	//   - tree-state composable (collapse persistence)
	//   - DnD coordination (consider/finalize events from any subtree)
	//   - Alt-key tracking for move-vs-cross-assign semantics
	//   - dispatch of reorder API calls
	//   - top-level dndzones for the bucket roots (Hubs, Collection Groups)
	//
	// Recursion lives in BrowseTreeNode.svelte.

	import { onMount, onDestroy } from 'svelte';
	import { dndzone, type DndEvent } from 'svelte-dnd-action';
	import BrowseTreeNode from './BrowseTreeNode.svelte';
	import { createBrowseTreeState } from '$lib/composables/useBrowseTreeState';
	import { inkApi, type InkBrowseNode } from '$lib/services/ink-api';

	type TreeNode = InkBrowseNode & { childList: TreeNode[] };
	type TreeBucket = { label: string; nodes: TreeNode[]; topLevelParentId?: string | null };

	let {
		buckets,
		selectedId,
		creatingNew,
		userId,
		onselect,
		onreordered
	}: {
		buckets: TreeBucket[];
		selectedId: string | null;
		creatingNew: boolean;
		userId: string;
		onselect: (id: string) => void;
		// Fired after a successful reorder so the parent can invalidate
		// the BrowseNode list query.
		onreordered: () => void;
	} = $props();

	const state = createBrowseTreeState(userId);

	// Alt-key tracking. svelte-dnd-action doesn't surface modifier state
	// in its events, so we track it via window listeners and read at
	// finalize time. macOS sends Alt as "altKey"/"Alt"; Windows
	// likewise. We expose it via $altDown so the BrowseTreeNode could
	// also surface a "+" hint if we want to add the drag-ghost badge
	// (deferred polish — the operative behavior is in the controller
	// callback below).
	let altDown = $state(false);
	function handleKeyDown(e: KeyboardEvent) {
		if (e.altKey || e.key === 'Alt') altDown = true;
	}
	function handleKeyUp(e: KeyboardEvent) {
		if (!e.altKey || e.key === 'Alt') altDown = false;
	}
	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
	});
	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		}
	});

	// Snapshot of the buckets' top-level nodes for the top-level
	// dndzones. svelte-dnd-action mutates the array it gets, so we
	// keep a local copy per bucket.
	let bucketItems = $state<Record<string, TreeNode[]>>({});
	$effect(() => {
		const next: Record<string, TreeNode[]> = {};
		for (const b of buckets) next[b.label] = b.nodes;
		bucketItems = next;
	});

	// Track in-flight DnD consider state so we can compare before/after
	// for finalize and figure out what moved where. svelte-dnd-action
	// gives us the new items array on finalize but not directly which
	// item moved or its old parent. We diff to discover this.

	// Build a map of all node IDs in the buckets keyed to their parent
	// id ("root:<bucket>") for the diff at finalize time.
	function indexByParent(): Map<string, string | null> {
		const m = new Map<string, string | null>();
		function walk(n: TreeNode, parentId: string | null) {
			m.set(n.id, parentId);
			for (const c of n.childList ?? []) walk(c, n.id);
		}
		for (const b of buckets) for (const n of b.nodes) walk(n, null);
		return m;
	}

	async function reorderNode(
		nodeId: string,
		newParentId: string | null,
		newPosition: number,
		op: 'move' | 'cross_assign'
	) {
		try {
			await inkApi.reorderBrowseNode(nodeId, {
				parent_id: newParentId,
				position: newPosition,
				op
			});
			onreordered();
		} catch (err) {
			console.error('[BrowseTree] reorder failed', err);
			// Force a refetch so the optimistic UI snaps back.
			onreordered();
		}
	}

	// finalize handler for ANY dndzone in the tree. We figure out which
	// node moved by comparing the new items vs the prior parent map.
	function handleSubtreeFinalize(parentId: string | null, items: TreeNode[]) {
		const prior = indexByParent();
		const movedItem = items.find((it) => prior.get(it.id) !== parentId);
		if (!movedItem) return; // Pure reorder within same parent.

		const newPosition = items.findIndex((it) => it.id === movedItem.id);
		const op = altDown ? 'cross_assign' : 'move';
		reorderNode(movedItem.id, parentId, newPosition, op);
	}

	// Handler for top-level bucket dndzones (Hubs, Collection Groups).
	// These nodes are top-level (parent_id = null).
	function handleBucketConsider(label: string, items: TreeNode[]) {
		bucketItems = { ...bucketItems, [label]: items };
	}
	function handleBucketFinalize(label: string, items: TreeNode[]) {
		bucketItems = { ...bucketItems, [label]: items };
		const prior = indexByParent();
		const movedItem = items.find((it) => prior.get(it.id) !== null);
		if (!movedItem) {
			// Pure reorder within top-level: send a move with parent_id=null.
			const reordered = items.find((it, i) => {
				const orig = buckets.find((b) => b.label === label)?.nodes.findIndex((n) => n.id === it.id);
				return orig !== undefined && orig !== i;
			});
			if (reordered) {
				const newPosition = items.findIndex((it) => it.id === reordered.id);
				reorderNode(reordered.id, null, newPosition, 'move');
			}
			return;
		}
		const newPosition = items.findIndex((it) => it.id === movedItem.id);
		const op = altDown ? 'cross_assign' : 'move';
		reorderNode(movedItem.id, null, newPosition, op);
	}
</script>

<div class="space-y-4">
	{#each buckets as bucket (bucket.label)}
		{#if bucket.nodes.length > 0}
			<div>
				<div
					class="text-[10px] font-semibold text-text-theme-tertiary uppercase tracking-wider mb-1 px-1 flex items-center justify-between"
				>
					<span>{bucket.label}</span>
					{#if altDown}
						<span class="text-amber-600 dark:text-amber-400 normal-case" title="Alt held: drag will cross-assign (add a parent edge) rather than move">
							+ cross-assign
						</span>
					{/if}
				</div>
				<ul
					class="space-y-0.5"
					use:dndzone={{
						items: bucketItems[bucket.label] ?? bucket.nodes,
						flipDurationMs: 150,
						type: 'browse-tree',
						dropTargetStyle: { outline: '1px dashed rgba(59,130,246,0.6)' }
					}}
					onconsider={(e: CustomEvent<DndEvent<TreeNode>>) =>
						handleBucketConsider(bucket.label, e.detail.items)}
					onfinalize={(e: CustomEvent<DndEvent<TreeNode>>) =>
						handleBucketFinalize(bucket.label, e.detail.items)}
				>
					{#each bucketItems[bucket.label] ?? bucket.nodes as node (node.id)}
						<BrowseTreeNode
							{node}
							depth={0}
							{state}
							{selectedId}
							{creatingNew}
							{onselect}
							ondndconsider={() => {}}
							ondndfinalize={handleSubtreeFinalize}
						/>
					{/each}
				</ul>
			</div>
		{/if}
	{/each}
</div>
