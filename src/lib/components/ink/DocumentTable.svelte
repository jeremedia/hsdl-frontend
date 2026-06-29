<script lang="ts">
	import type { InkDocument } from '$lib/services/ink-api';
	import HealthBar from './HealthBar.svelte';
	import { ArrowUp, ArrowDown, CheckSquare, Square } from 'lucide-svelte';

	let {
		documents,
		selectedIds,
		focusedRow,
		sort,
		direction,
		onsort,
		onselect,
		onnavigate
	}: {
		documents: InkDocument[];
		selectedIds: Set<string>;
		focusedRow: number;
		sort: string;
		direction: string;
		onsort: (field: string) => void;
		onselect: (id: string) => void;
		onnavigate: (id: string) => void;
	} = $props();

	let allSelected = $derived(
		documents.length > 0 && documents.every((d) => selectedIds.has(d.id))
	);

	function toggleAll() {
		if (allSelected) {
			documents.forEach((d) => onselect(d.id));
		} else {
			documents.filter((d) => !selectedIds.has(d.id)).forEach((d) => onselect(d.id));
		}
	}

	function statusBadgeClass(status: string): string {
		switch (status) {
			case 'enabled':
				return 'bg-success-light text-green-700 dark:text-green-300';
			case 'disabled':
				return 'bg-error-light text-red-700 dark:text-red-300';
			default:
				return 'bg-surface-secondary text-text-theme-secondary';
		}
	}

	interface Column {
		key: string;
		label: string;
		sortable: boolean;
		class: string;
	}

	const columns: Column[] = [
		{ key: 'title', label: 'Title', sortable: true, class: 'flex-1 min-w-0' },
		{ key: 'source', label: 'Source', sortable: true, class: 'w-24 hidden lg:block' },
		{ key: 'term_count', label: 'Terms', sortable: true, class: 'w-12 hidden lg:block text-right' },
		{ key: 'health_score', label: 'Health', sortable: true, class: 'w-20 hidden sm:block' },
		{ key: 'publish_year', label: 'Year', sortable: true, class: 'w-12 hidden md:block' },
		{ key: 'enable_status', label: 'Status', sortable: true, class: 'w-16' },
		{ key: 'updated_at', label: 'Modified', sortable: true, class: 'w-20 hidden lg:block' }
	];

	// Scroll focused row into view
	$effect(() => {
		const el = document.getElementById(`ink-row-${focusedRow}`);
		if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	});
</script>

<div class="overflow-hidden text-xs">
	<!-- Header -->
	<div class="flex items-center gap-2 px-2.5 py-1.5 bg-surface-secondary border-b border-theme font-medium text-text-theme-secondary uppercase tracking-wider" style="font-size: 0.625rem;">
		<button
			type="button"
			onclick={toggleAll}
			class="flex-shrink-0 w-4 h-4 flex items-center justify-center"
			aria-label="{allSelected ? 'Deselect' : 'Select'} all"
		>
			{#if allSelected}
				<CheckSquare size={13} class="text-interactive" />
			{:else}
				<Square size={13} />
			{/if}
		</button>

		{#each columns as col}
			<div class={col.class}>
				{#if col.sortable}
					<button
						type="button"
						onclick={() => onsort(col.key)}
						class="flex items-center gap-0.5 hover:text-text-theme-primary transition-colors"
					>
						{col.label}
						{#if sort === col.key}
							{#if direction === 'asc'}
								<ArrowUp size={10} />
							{:else}
								<ArrowDown size={10} />
							{/if}
						{/if}
					</button>
				{:else}
					{col.label}
				{/if}
			</div>
		{/each}
	</div>

	<!-- Rows -->
	{#each documents as doc, i (doc.id)}
		<button
			id="ink-row-{i}"
			type="button"
			class="w-full flex items-center gap-2 px-2.5 py-1.5 border-b border-theme transition-colors text-left
				{i === focusedRow ? 'bg-primary-100 ring-1 ring-inset ring-primary-300' : 'hover:bg-surface-secondary'}
				{selectedIds.has(doc.id) ? 'bg-info-light' : ''}"
			onclick={() => onnavigate(doc.id)}
		>
			<!-- Checkbox -->
			<div
				class="flex-shrink-0 w-4 h-4 flex items-center justify-center"
				onclick={(e: MouseEvent) => { e.stopPropagation(); onselect(doc.id); }}
				onkeydown={(e: KeyboardEvent) => { if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); onselect(doc.id); } }}
				role="checkbox"
				aria-checked={selectedIds.has(doc.id)}
				tabindex={-1}
			>
				{#if selectedIds.has(doc.id)}
					<CheckSquare size={13} class="text-interactive" />
				{:else}
					<Square size={13} class="text-text-theme-tertiary" />
				{/if}
			</div>

			<!-- Title -->
			<div class="flex-1 min-w-0">
				<span class="truncate block font-medium text-text-theme-primary">{doc.title}</span>
			</div>

			<!-- Source -->
			<div class="w-24 hidden lg:block truncate text-text-theme-tertiary">
				{doc.source || '--'}
			</div>

			<!-- Term count -->
			<div class="w-12 hidden lg:block text-right text-text-theme-tertiary tabular-nums">
				{doc.term_count ?? '--'}
			</div>

			<!-- Health -->
			<div class="w-20 hidden sm:block">
				<HealthBar score={doc.health_score} size="sm" />
			</div>

			<!-- Year -->
			<div class="w-12 hidden md:block text-text-theme-tertiary tabular-nums">
				{doc.publish_year || '--'}
			</div>

			<!-- Status -->
			<div class="w-16">
				<span class="badge text-[0.625rem] {statusBadgeClass(doc.enable_status)}">
					{doc.enable_status === 'not_set' ? 'unset' : doc.enable_status}
				</span>
			</div>

			<!-- Modified -->
			<div class="w-20 hidden lg:block text-text-theme-tertiary tabular-nums">
				{new Date(doc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
			</div>
		</button>
	{/each}

	{#if documents.length === 0}
		<div class="py-8 text-center text-text-theme-tertiary text-sm">
			No documents match the current filters.
		</div>
	{/if}
</div>
