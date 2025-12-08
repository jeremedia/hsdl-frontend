<script lang="ts">
	import type { FacetsResponse } from '$lib/services/api';
	import { X } from 'lucide-svelte';

	interface ActiveFilter {
		type: 'term' | 'year' | 'thesis';
		id: string;
		label: string;
		fieldName?: string;
	}

	interface Props {
		facets: FacetsResponse | null;
		selectedTerms: string[];
		yearStart: string;
		yearEnd: string;
		thesis: 'all' | 'thesis' | 'chds';
		onRemoveTerm: (termId: string) => void;
		onClearYears: () => void;
		onClearThesis: () => void;
		onClearAll: () => void;
	}

	let {
		facets,
		selectedTerms,
		yearStart,
		yearEnd,
		thesis,
		onRemoveTerm,
		onClearYears,
		onClearThesis,
		onClearAll
	}: Props = $props();

	// Build list of active filters
	let activeFilters = $derived.by(() => {
		const filters: ActiveFilter[] = [];

		// Year range filter
		if (yearStart || yearEnd) {
			const label =
				yearStart && yearEnd
					? `${yearStart} - ${yearEnd}`
					: yearStart
						? `From ${yearStart}`
						: `To ${yearEnd}`;
			filters.push({
				type: 'year',
				id: '_year',
				label
			});
		}

		// Thesis filter
		if (thesis !== 'all') {
			filters.push({
				type: 'thesis',
				id: '_thesis',
				label: thesis === 'thesis' ? 'Theses Only' : 'CHDS Theses'
			});
		}

		// Term filters
		if (facets) {
			for (const field of facets.fields) {
				for (const term of field.terms) {
					if (selectedTerms.includes(term.id)) {
						filters.push({
							type: 'term',
							id: term.id,
							label: term.name,
							fieldName: field.name
						});
					}
				}
			}
		}

		return filters;
	});

	function removeFilter(filter: ActiveFilter) {
		switch (filter.type) {
			case 'term':
				onRemoveTerm(filter.id);
				break;
			case 'year':
				onClearYears();
				break;
			case 'thesis':
				onClearThesis();
				break;
		}
	}
</script>

{#if activeFilters.length > 0}
	<div class="flex flex-wrap items-center gap-2 mb-4">
		<span class="text-sm text-gray-500">Filters:</span>

		{#each activeFilters as filter}
			<span
				class="inline-flex items-center gap-1 px-2.5 py-1 text-sm bg-chds-blue/10 text-chds-navy rounded-full"
			>
				{#if filter.fieldName}
					<span class="text-gray-500">{filter.fieldName}:</span>
				{/if}
				<span class="font-medium truncate max-w-[150px]" title={filter.label}>
					{filter.label}
				</span>
				<button
					onclick={() => removeFilter(filter)}
					class="ml-0.5 p-0.5 hover:bg-chds-blue/20 rounded-full transition-colors"
					aria-label="Remove filter"
				>
					<X class="w-3.5 h-3.5" />
				</button>
			</span>
		{/each}

		{#if activeFilters.length > 1}
			<button
				onclick={onClearAll}
				class="text-sm text-chds-blue hover:text-chds-navy hover:underline transition-colors"
			>
				Clear all
			</button>
		{/if}
	</div>
{/if}
