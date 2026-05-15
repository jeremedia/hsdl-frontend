<script lang="ts">
	// Recursive renderer for one BrowseNode + its subtree. Handles:
	// collapse toggle, kind icon, name + doc count, drag-and-drop on
	// children (via svelte-dnd-action). DnD events bubble up to the
	// parent BrowseTree which dispatches reorder requests to the API.
	//
	// Alt-key state (for move-vs-cross-assign) is captured at the
	// BrowseTree level on window listeners and passed in; this
	// component just needs to render and report.

	import { onMount } from 'svelte';
	import { Folder, FolderTree, Box, FileText, ChevronRight, ChevronDown } from 'lucide-svelte';
	import { dndzone, type DndEvent } from 'svelte-dnd-action';
	import type { InkBrowseNode } from '$lib/services/ink-api';
	import type { BrowseTreeState } from '$lib/composables/useBrowseTreeState';

	type TreeNode = InkBrowseNode & { childList: TreeNode[] };

	let {
		node,
		depth,
		state,
		selectedId,
		creatingNew,
		onselect,
		ondndconsider,
		ondndfinalize
	}: {
		node: TreeNode;
		depth: number;
		state: BrowseTreeState;
		selectedId: string | null;
		creatingNew: boolean;
		onselect: (id: string) => void;
		ondndconsider: (parentId: string, items: TreeNode[]) => void;
		ondndfinalize: (parentId: string, items: TreeNode[]) => void;
	} = $props();

	let collapsedSet = $derived($state.collapsed);
	let isCollapsed = $derived(collapsedSet.has(node.id));
	let hasChildren = $derived((node.childList?.length ?? 0) > 0);
	let isTop = $derived(depth === 0);

	function iconForKind(kind: string) {
		switch (kind) {
			case 'hub':
				return Folder;
			case 'sub_hub':
				return FolderTree;
			case 'collection_group':
				return Box;
			case 'collection_item':
				return FileText;
			default:
				return Folder;
		}
	}
	let Icon = $derived(iconForKind(node.kind));

	function kindLabel(kind: string): string {
		switch (kind) {
			case 'sub_hub':
				return 'sub-hub';
			case 'collection_group':
				return 'group';
			case 'collection_item':
				return 'item';
			default:
				return kind;
		}
	}

	// Local working list of children for the dndzone. svelte-dnd-action
	// mutates this array during drag; we restore on cancel by resyncing
	// from props when childList changes externally.
	let dndItems = $state<TreeNode[]>([]);
	$effect(() => {
		dndItems = node.childList ?? [];
	});

	function handleConsider(e: CustomEvent<DndEvent<TreeNode>>) {
		dndItems = e.detail.items;
		ondndconsider(node.id, e.detail.items);
	}
	function handleFinalize(e: CustomEvent<DndEvent<TreeNode>>) {
		dndItems = e.detail.items;
		ondndfinalize(node.id, e.detail.items);
	}
</script>

<li>
	<div
		class="group flex items-center gap-1 rounded transition-colors
		{isTop ? 'py-1.5 text-xs' : 'py-1 text-[11px]'}
		{selectedId === node.id && !creatingNew
			? 'bg-primary-100 text-primary-700'
			: 'text-text-theme-secondary hover:bg-surface-secondary hover:text-text-theme-primary'}"
	>
		<!-- Collapse toggle (or spacer when no children) -->
		<button
			type="button"
			class="flex-shrink-0 w-4 h-4 inline-flex items-center justify-center rounded hover:bg-surface-secondary/60"
			class:invisible={!hasChildren}
			aria-label={isCollapsed ? `Expand ${node.name}` : `Collapse ${node.name}`}
			onclick={(e) => {
				e.stopPropagation();
				state.toggle(node.id);
			}}
		>
			{#if isCollapsed}
				<ChevronRight size={12} />
			{:else}
				<ChevronDown size={12} />
			{/if}
		</button>

		<!-- Kind icon -->
		<Icon
			size={isTop ? 13 : 12}
			class="flex-shrink-0 text-text-theme-tertiary"
		/>

		<!-- Name + visibility dot -->
		<button
			type="button"
			class="flex-1 flex items-center gap-1.5 min-w-0 text-left px-1 py-0.5 rounded"
			onclick={() => onselect(node.id)}
		>
			<span
				class="flex-shrink-0 inline-block rounded-full
				{isTop ? 'w-2 h-2' : 'w-1.5 h-1.5'}
				{node.visibility === 'published'
					? 'bg-green-500'
					: 'border border-text-theme-tertiary'}"
				title={node.visibility}
			></span>
			<span class="truncate">{node.name || node.slug}</span>
			{#if hasChildren}
				<span class="text-[10px] tabular-nums text-text-theme-tertiary flex-shrink-0">
					· {node.childList.length}
				</span>
			{/if}
			{#if typeof node.cached_doc_count === 'number'}
				<span
					class="text-[10px] tabular-nums flex-shrink-0
					{node.cached_doc_count === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-text-theme-tertiary'}"
					title={node.cached_doc_count === 0
						? 'Zero docs match this collection — check filters or query.'
						: `${node.cached_doc_count.toLocaleString()} docs`}
				>
					· {node.cached_doc_count.toLocaleString()} docs
				</span>
			{/if}
			<span class="text-[9px] uppercase tracking-wider text-text-theme-tertiary flex-shrink-0">
				{kindLabel(node.kind)}
			</span>
		</button>
	</div>

	{#if hasChildren && !isCollapsed}
		<ul
			class="mt-0.5 ml-3 border-l border-theme pl-2 space-y-0.5"
			use:dndzone={{
				items: dndItems,
				flipDurationMs: 150,
				type: 'browse-tree',
				dropTargetStyle: { outline: '1px dashed rgba(59,130,246,0.6)' }
			}}
			onconsider={handleConsider}
			onfinalize={handleFinalize}
		>
			{#each dndItems as child (child.id)}
				<svelte:self
					node={child}
					depth={depth + 1}
					{state}
					{selectedId}
					{creatingNew}
					{onselect}
					{ondndconsider}
					{ondndfinalize}
				/>
			{/each}
		</ul>
	{/if}
</li>
