<script lang="ts">
	// Top-level BrowseTree renderer for /ink/browse. Phase 1a: collapse
	// persistence + kind icons + doc-count badges. No drag-and-drop in
	// this revision — svelte-dnd-action triggered a Svelte 5 runtime
	// "subscribe is not a function" at flush time that wouldn't trace
	// back to any store in our code. The reorder backend endpoint is
	// live (POST /api/ink/v1/browse_nodes/:id/reorder) and ready for
	// keyboard controls or a different DnD library in Phase 1.5.

	import BrowseTreeNode from './BrowseTreeNode.svelte';
	import { createBrowseTreeState } from '$lib/composables/useBrowseTreeState.svelte';
	import type { InkBrowseNode } from '$lib/services/ink-api';

	type TreeNode = InkBrowseNode & { childList: TreeNode[] };
	type TreeBucket = { label: string; nodes: TreeNode[] };

	let {
		buckets,
		selectedId,
		creatingNew,
		userId,
		onselect,
		onreordered: _onreordered
	}: {
		buckets: TreeBucket[];
		selectedId: string | null;
		creatingNew: boolean;
		userId: string;
		onselect: (id: string) => void;
		onreordered: () => void;
	} = $props();

	const state = createBrowseTreeState(userId);
</script>

<div class="space-y-4">
	{#each buckets as bucket (bucket.label)}
		{#if bucket.nodes.length > 0}
			<div>
				<div class="text-[10px] font-semibold text-text-theme-tertiary uppercase tracking-wider mb-1 px-1">
					{bucket.label}
				</div>
				<ul class="space-y-0.5">
					{#each bucket.nodes as node (node.id)}
						<BrowseTreeNode
							{node}
							depth={0}
							{state}
							{selectedId}
							{creatingNew}
							{onselect}
						/>
					{/each}
				</ul>
			</div>
		{/if}
	{/each}
</div>
