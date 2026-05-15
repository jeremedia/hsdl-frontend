<script lang="ts">
	// Recursive renderer for one BrowseNode + its subtree. Handles:
	// collapse toggle, kind icon, name + doc count, drag-and-drop on
	// children (via svelte-dnd-action). DnD events bubble up to the
	// parent BrowseTree which dispatches reorder requests to the API.
	//
	// Alt-key state (for move-vs-cross-assign) is captured at the
	// BrowseTree level on window listeners and passed in; this
	// component just needs to render and report.

	import { Folder, FolderTree, Box, FileText, ChevronRight, ChevronDown } from 'lucide-svelte';
	import type { InkBrowseNode } from '$lib/services/ink-api';
	import type { BrowseTreeState } from '$lib/composables/useBrowseTreeState.svelte';

	type TreeNode = InkBrowseNode & { childList: TreeNode[] };

	let {
		node,
		depth,
		state,
		selectedId,
		creatingNew,
		onselect
	}: {
		node: TreeNode;
		depth: number;
		state: BrowseTreeState;
		selectedId: string | null;
		creatingNew: boolean;
		onselect: (id: string) => void;
	} = $props();

	// BrowseTreeState is a class with runes-state inside; reading
	// `state.collapsedIds.has(id)` from within a $derived gives us
	// the same reactivity Svelte applies to plain runes-state property
	// access. No store, no auto-subscribe — that path triggered
	// "subscribe is not a function" at flush time in the previous
	// store-based version.
	let isCollapsed = $derived(state.collapsedIds.has(node.id));
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

	// DnD removed in Phase 1a — children render as a plain nested <ul>.
	// Drag-and-drop will return in Phase 1.5 once svelte-dnd-action's
	// Svelte 5.15 compatibility is verified (an initial flush threw
	// "subscribe is not a function" inside the runtime that didn't
	// trace back to any store in our code). The /reorder API endpoint
	// is already live and unused — keyboard-based reorder controls or
	// a different DnD library can drive it later without backend work.
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
			<span class="truncate min-w-0 flex-1">{node.name || node.slug}</span>
			<!-- Metadata cluster — pushed to the right edge of the row so
			     short names don't drag their badges into the middle of
			     the column and long names truncate cleanly with the
			     badges flush to the right. -->
			<span class="ml-auto flex items-center gap-1.5 flex-shrink-0">
				{#if hasChildren}
					<span class="text-[10px] tabular-nums text-text-theme-tertiary">
						· {node.childList.length}
					</span>
				{/if}
				{#if typeof node.cached_doc_count === 'number'}
					<span
						class="text-[10px] tabular-nums
						{node.cached_doc_count === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-text-theme-tertiary'}"
						title={node.cached_doc_count === 0
							? 'Zero docs match this collection — check filters or query.'
							: `${node.cached_doc_count.toLocaleString()} docs`}
					>
						· {node.cached_doc_count.toLocaleString()} docs
					</span>
				{/if}
				<span class="text-[9px] uppercase tracking-wider text-text-theme-tertiary">
					{kindLabel(node.kind)}
				</span>
			</span>
		</button>
	</div>

	{#if hasChildren && !isCollapsed}
		<ul class="mt-0.5 ml-3 border-l border-theme pl-2 space-y-0.5">
			{#each node.childList as child (child.id)}
				<svelte:self
					node={child}
					depth={depth + 1}
					{state}
					{selectedId}
					{creatingNew}
					{onselect}
				/>
			{/each}
		</ul>
	{/if}
</li>
