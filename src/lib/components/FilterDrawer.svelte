<script lang="ts">
	import type { FacetsResponse } from '$lib/services/api';
	import FacetSidebar from './FacetSidebar.svelte';
	import { X } from 'lucide-svelte';

	interface Props {
		open: boolean;
		facets: FacetsResponse | null;
		selectedTerms: string[];
		yearStart: string;
		yearEnd: string;
		thesis: 'all' | 'thesis' | 'chds';
		onTermToggle: (termId: string) => void;
		onYearChange: (start: string, end: string) => void;
		onThesisChange: (value: 'all' | 'thesis' | 'chds') => void;
		onClearAll: () => void;
		onClose: () => void;
		loading?: boolean;
	}

	let {
		open,
		facets,
		selectedTerms,
		yearStart,
		yearEnd,
		thesis,
		onTermToggle,
		onYearChange,
		onThesisChange,
		onClearAll,
		onClose,
		loading = false
	}: Props = $props();

	function getActiveFilterCount(): number {
		let count = selectedTerms.length;
		if (yearStart || yearEnd) count++;
		if (thesis !== 'all') count++;
		return count;
	}

	// Close on escape key
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			onClose();
		}
	}

	// Prevent body scroll when drawer is open
	$effect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 z-40 transition-opacity"
		onclick={onClose}
		role="button"
		tabindex="-1"
		aria-label="Close filters"
	></div>

	<!-- Drawer -->
	<div
		class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col transform transition-transform duration-300 ease-out"
		class:translate-y-0={open}
		class:translate-y-full={!open}
		role="dialog"
		aria-modal="true"
		aria-label="Search filters"
	>
		<!-- Handle bar -->
		<div class="flex justify-center pt-3 pb-1">
			<div class="w-10 h-1 bg-gray-300 rounded-full"></div>
		</div>

		<!-- Header -->
		<div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
			<div class="flex items-center gap-2">
				<h2 class="text-lg font-semibold text-gray-900">Filters</h2>
				{#if getActiveFilterCount() > 0}
					<span class="bg-chds-blue text-white text-xs font-medium px-2 py-0.5 rounded-full">
						{getActiveFilterCount()}
					</span>
				{/if}
			</div>
			<button
				onclick={onClose}
				class="p-2 -mr-2 text-gray-500 hover:text-gray-700 transition-colors"
				aria-label="Close filters"
			>
				<X class="w-5 h-5" />
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto">
			<FacetSidebar
				{facets}
				{selectedTerms}
				{yearStart}
				{yearEnd}
				{thesis}
				{onTermToggle}
				{onYearChange}
				{onThesisChange}
				{onClearAll}
				{loading}
			/>
		</div>

		<!-- Footer -->
		<div class="border-t border-gray-200 px-4 py-3 bg-gray-50 flex gap-3">
			<button
				onclick={onClearAll}
				class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
			>
				Clear All
			</button>
			<button
				onclick={onClose}
				class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-chds-blue rounded-lg hover:bg-chds-navy transition-colors"
			>
				Apply Filters
			</button>
		</div>
	</div>
{/if}
