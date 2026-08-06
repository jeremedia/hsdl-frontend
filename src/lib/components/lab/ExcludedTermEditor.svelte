<script lang="ts">
	import { Ban } from 'lucide-svelte';

	let {
		terms,
		builtInTerms = [],
		disabled = false,
		onAdd,
		onRemove
	}: {
		terms: string[];
		// Non-removable platform exclusions (FOUO etc) — display-only, never
		// part of the saved list (issue 77f780c0).
		builtInTerms?: string[];
		disabled?: boolean;
		onAdd: (term: string) => void;
		onRemove: (term: string) => void;
	} = $props();

	let newTerm = $state('');

	function handleAdd() {
		const term = newTerm.trim();
		if (!term) return;
		onAdd(term);
		newTerm = '';
	}
</script>

<div>
	<h3 class="text-xs font-semibold text-text-theme-secondary uppercase tracking-wider mb-2">Excluded Terms</h3>
	<p class="text-[11px] text-text-theme-tertiary mb-3 leading-relaxed">Documents whose title contains these terms are filtered from search results.</p>

	{#if builtInTerms.length > 0}
		<div class="flex flex-wrap gap-1.5 mb-2">
			{#each builtInTerms as term (term)}
				<span
					class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
					title="Built-in platform exclusion — always applied, cannot be removed"
				>
					{term}
					<span class="text-[9px] uppercase tracking-wider opacity-70">built-in</span>
				</span>
			{/each}
		</div>
	{/if}

	{#if terms.length === 0}
		<div class="py-6 text-center">
			<Ban size={24} class="mx-auto mb-2 text-text-theme-tertiary opacity-40" />
			<p class="text-xs text-text-theme-tertiary">No excluded terms beyond the built-ins. Add terms below to filter them from results.</p>
		</div>
	{:else}
		<div class="flex flex-wrap gap-1.5">
			{#each terms as term (term)}
				<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 transition-colors">
					{term}
					{#if !disabled}
						<button onclick={() => onRemove(term)} class="hover:text-red-900 dark:hover:text-red-100 transition-colors ml-0.5">&times;</button>
					{/if}
				</span>
			{/each}
		</div>
	{/if}

	{#if !disabled}
		<div class="flex gap-2 mt-3">
			<input
				bind:value={newTerm}
				class="input text-xs py-1.5 flex-1"
				placeholder="Term to exclude"
				onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
			/>
			<button onclick={handleAdd} class="btn btn-outline text-xs py-1.5 px-3">Add</button>
		</div>
	{/if}
</div>
