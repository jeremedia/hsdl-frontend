<script lang="ts">
	import type { FacetsResponse, FacetField } from '$lib/services/api';
	import {
		ChevronDown,
		ChevronRight,
		Calendar,
		GraduationCap,
		Tag,
		Globe,
		Users,
		Building2,
		FileText,
		Search,
		X
	} from 'lucide-svelte';

	interface Props {
		facets: FacetsResponse | null;
		selectedTerms: string[];
		yearStart: string;
		yearEnd: string;
		thesis: 'all' | 'thesis' | 'chds';
		onTermToggle: (termId: string) => void;
		onYearChange: (start: string, end: string) => void;
		onThesisChange: (value: 'all' | 'thesis' | 'chds') => void;
		onClearAll: () => void;
		loading?: boolean;
	}

	let {
		facets,
		selectedTerms,
		yearStart,
		yearEnd,
		thesis,
		onTermToggle,
		onYearChange,
		onThesisChange,
		onClearAll,
		loading = false
	}: Props = $props();

	// Track expanded fields
	let expandedFields = $state<Set<string>>(new Set());

	// Track "show more" state per field
	let expandedTerms = $state<Set<string>>(new Set());

	// Search within field
	let fieldSearches = $state<Record<string, string>>({});

	// Local year inputs
	let localYearStart = $state(yearStart);
	let localYearEnd = $state(yearEnd);

	// Sync local years with props
	$effect(() => {
		localYearStart = yearStart;
		localYearEnd = yearEnd;
	});

	// Field icon mapping
	function getFieldIcon(fieldName: string) {
		const iconMap: Record<string, typeof Tag> = {
			'Coverage - Country': Globe,
			Audience: Users,
			Publisher: Building2,
			Creator: Users,
			Subject: Tag,
			'FAST Subject': Tag,
			'Resource Type': FileText
		};
		return iconMap[fieldName] || Tag;
	}

	function toggleField(fieldId: string) {
		if (expandedFields.has(fieldId)) {
			expandedFields.delete(fieldId);
		} else {
			expandedFields.add(fieldId);
		}
		expandedFields = new Set(expandedFields);
	}

	function toggleShowMore(fieldId: string) {
		if (expandedTerms.has(fieldId)) {
			expandedTerms.delete(fieldId);
		} else {
			expandedTerms.add(fieldId);
		}
		expandedTerms = new Set(expandedTerms);
	}

	function getVisibleTerms(field: FacetField) {
		let terms = field.terms;

		// Apply search filter
		const search = fieldSearches[field.id]?.toLowerCase();
		if (search) {
			terms = terms.filter((t) => t.name.toLowerCase().includes(search));
		}

		// Limit to 10 unless expanded
		if (!expandedTerms.has(field.id) && terms.length > 10) {
			return terms.slice(0, 10);
		}

		return terms;
	}

	function getHiddenCount(field: FacetField) {
		const search = fieldSearches[field.id]?.toLowerCase();
		let terms = field.terms;
		if (search) {
			terms = terms.filter((t) => t.name.toLowerCase().includes(search));
		}
		return Math.max(0, terms.length - 10);
	}

	function formatCount(count: number): string {
		if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
		if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
		return count.toString();
	}

	function hasActiveFilters(): boolean {
		return selectedTerms.length > 0 || yearStart !== '' || yearEnd !== '' || thesis !== 'all';
	}

	function applyYearFilter() {
		onYearChange(localYearStart, localYearEnd);
	}

	// Auto-expand fields that have selected terms
	$effect(() => {
		if (facets && selectedTerms.length > 0) {
			for (const field of facets.fields) {
				const hasSelected = field.terms.some((t) => selectedTerms.includes(t.id));
				if (hasSelected && !expandedFields.has(field.id)) {
					expandedFields.add(field.id);
					expandedFields = new Set(expandedFields);
				}
			}
		}
	});
</script>

<aside class="w-full h-full overflow-y-auto bg-white">
	<!-- Header -->
	<div class="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-10">
		<div class="flex items-center justify-between">
			<h2 class="font-semibold text-gray-900">Filters</h2>
			{#if hasActiveFilters()}
				<button
					onclick={onClearAll}
					class="text-sm text-chds-blue hover:text-chds-navy transition-colors"
				>
					Clear all
				</button>
			{/if}
		</div>
	</div>

	{#if loading}
		<div class="p-4 space-y-4">
			{#each Array(4) as _}
				<div class="space-y-2">
					<div class="skeleton h-5 w-32 rounded"></div>
					<div class="skeleton h-4 w-full rounded"></div>
					<div class="skeleton h-4 w-3/4 rounded"></div>
				</div>
			{/each}
		</div>
	{:else if facets}
		<div class="p-4 space-y-4">
			<!-- Year Range -->
			<div class="border-b border-gray-100 pb-4">
				<button
					onclick={() => toggleField('_year')}
					class="w-full flex items-center gap-2 text-left"
				>
					{#if expandedFields.has('_year')}
						<ChevronDown class="w-4 h-4 text-gray-400" />
					{:else}
						<ChevronRight class="w-4 h-4 text-gray-400" />
					{/if}
					<Calendar class="w-4 h-4 text-chds-blue" />
					<span class="font-medium text-gray-900">Year</span>
					{#if yearStart || yearEnd}
						<span class="ml-auto text-xs bg-chds-blue text-white px-1.5 py-0.5 rounded">
							{yearStart || '...'} - {yearEnd || '...'}
						</span>
					{/if}
				</button>

				{#if expandedFields.has('_year')}
					<div class="mt-3 flex items-center gap-2">
						<input
							type="number"
							placeholder="From"
							bind:value={localYearStart}
							onblur={applyYearFilter}
							onkeydown={(e) => e.key === 'Enter' && applyYearFilter()}
							class="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-chds-blue focus:border-chds-blue"
							min="1900"
							max="2030"
						/>
						<span class="text-gray-400">-</span>
						<input
							type="number"
							placeholder="To"
							bind:value={localYearEnd}
							onblur={applyYearFilter}
							onkeydown={(e) => e.key === 'Enter' && applyYearFilter()}
							class="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-chds-blue focus:border-chds-blue"
							min="1900"
							max="2030"
						/>
					</div>
				{/if}
			</div>

			<!-- Thesis Type -->
			<div class="border-b border-gray-100 pb-4">
				<button
					onclick={() => toggleField('_thesis')}
					class="w-full flex items-center gap-2 text-left"
				>
					{#if expandedFields.has('_thesis')}
						<ChevronDown class="w-4 h-4 text-gray-400" />
					{:else}
						<ChevronRight class="w-4 h-4 text-gray-400" />
					{/if}
					<GraduationCap class="w-4 h-4 text-chds-blue" />
					<span class="font-medium text-gray-900">Document Type</span>
					{#if thesis !== 'all'}
						<span class="ml-auto text-xs bg-chds-blue text-white px-1.5 py-0.5 rounded">
							{thesis === 'thesis' ? 'Theses' : 'CHDS'}
						</span>
					{/if}
				</button>

				{#if expandedFields.has('_thesis')}
					<div class="mt-3 space-y-2">
						<label class="flex items-center gap-2 cursor-pointer group">
							<input
								type="radio"
								name="thesis"
								value="all"
								checked={thesis === 'all'}
								onchange={() => onThesisChange('all')}
								class="w-4 h-4 text-chds-blue focus:ring-chds-blue"
							/>
							<span class="text-sm text-gray-700 group-hover:text-gray-900">All Documents</span>
							<span class="ml-auto text-xs text-gray-400">
								{formatCount(facets.thesis_counts.all)}
							</span>
						</label>
						<label class="flex items-center gap-2 cursor-pointer group">
							<input
								type="radio"
								name="thesis"
								value="thesis"
								checked={thesis === 'thesis'}
								onchange={() => onThesisChange('thesis')}
								class="w-4 h-4 text-chds-blue focus:ring-chds-blue"
							/>
							<span class="text-sm text-gray-700 group-hover:text-gray-900">Theses Only</span>
							<span class="ml-auto text-xs text-gray-400">
								{formatCount(facets.thesis_counts.thesis)}
							</span>
						</label>
						<label class="flex items-center gap-2 cursor-pointer group">
							<input
								type="radio"
								name="thesis"
								value="chds"
								checked={thesis === 'chds'}
								onchange={() => onThesisChange('chds')}
								class="w-4 h-4 text-chds-blue focus:ring-chds-blue"
							/>
							<span class="text-sm text-gray-700 group-hover:text-gray-900">CHDS Theses</span>
							<span class="ml-auto text-xs text-gray-400">
								{formatCount(facets.thesis_counts.chds)}
							</span>
						</label>
					</div>
				{/if}
			</div>

			<!-- Vocabulary Fields -->
			{#each facets.fields as field}
				{@const IconComponent = getFieldIcon(field.name)}
				{@const visibleTerms = getVisibleTerms(field)}
				{@const hiddenCount = getHiddenCount(field)}
				{@const selectedCount = field.terms.filter((t) => selectedTerms.includes(t.id)).length}

				<div class="border-b border-gray-100 pb-4 last:border-0">
					<button
						onclick={() => toggleField(field.id)}
						class="w-full flex items-center gap-2 text-left"
					>
						{#if expandedFields.has(field.id)}
							<ChevronDown class="w-4 h-4 text-gray-400" />
						{:else}
							<ChevronRight class="w-4 h-4 text-gray-400" />
						{/if}
						<IconComponent class="w-4 h-4 text-chds-blue" />
						<span class="font-medium text-gray-900 truncate">{field.name}</span>
						{#if selectedCount > 0}
							<span class="ml-auto text-xs bg-chds-blue text-white px-1.5 py-0.5 rounded">
								{selectedCount}
							</span>
						{:else}
							<span class="ml-auto text-xs text-gray-400">{field.terms.length}</span>
						{/if}
					</button>

					{#if expandedFields.has(field.id)}
						<div class="mt-3 space-y-2">
							<!-- Search within field -->
							{#if field.terms.length > 10}
								<div class="relative">
									<Search
										class="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
									/>
									<input
										type="text"
										placeholder="Filter..."
										bind:value={fieldSearches[field.id]}
										class="w-full pl-7 pr-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-chds-blue focus:border-chds-blue"
									/>
								</div>
							{/if}

							<!-- Term checkboxes -->
							<div class="space-y-1 max-h-64 overflow-y-auto">
								{#each visibleTerms as term}
									<label class="flex items-center gap-2 cursor-pointer group py-0.5">
										<input
											type="checkbox"
											checked={selectedTerms.includes(term.id)}
											onchange={() => onTermToggle(term.id)}
											class="w-4 h-4 rounded text-chds-blue focus:ring-chds-blue"
										/>
										<span
											class="text-sm text-gray-700 group-hover:text-gray-900 truncate flex-1"
											title={term.name}
										>
											{term.name}
										</span>
										<span class="text-xs text-gray-400 tabular-nums">
											{formatCount(term.count)}
										</span>
									</label>
								{/each}
							</div>

							<!-- Show more -->
							{#if hiddenCount > 0 && !expandedTerms.has(field.id)}
								<button
									onclick={() => toggleShowMore(field.id)}
									class="text-sm text-chds-blue hover:text-chds-navy"
								>
									Show {hiddenCount} more
								</button>
							{:else if expandedTerms.has(field.id) && field.terms.length > 10}
								<button
									onclick={() => toggleShowMore(field.id)}
									class="text-sm text-chds-blue hover:text-chds-navy"
								>
									Show less
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<div class="p-4 text-center text-gray-500">
			<p>Enter a search query to see filters</p>
		</div>
	{/if}
</aside>
