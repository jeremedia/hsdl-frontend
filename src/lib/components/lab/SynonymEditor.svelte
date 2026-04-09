<script lang="ts">
	import { BookOpen } from 'lucide-svelte';

	let {
		synonyms,
		disabled = false,
		onAdd,
		onRemove
	}: {
		synonyms: Record<string, string[]>;
		disabled?: boolean;
		onAdd: (term: string, expansions: string[]) => void;
		onRemove: (term: string) => void;
	} = $props();

	let newTerm = $state('');
	let newExpansions = $state('');

	function handleAdd() {
		const term = newTerm.trim();
		const exps = newExpansions
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		if (!term || exps.length === 0) return;
		onAdd(term, exps);
		newTerm = '';
		newExpansions = '';
	}

	let entries = $derived(Object.entries(synonyms));
</script>

<div>
	<h3 class="text-xs font-semibold text-text-theme-secondary uppercase tracking-wider mb-2">Query Synonyms</h3>
	<p class="text-[11px] text-text-theme-tertiary mb-3 leading-relaxed">When someone searches for a term on the left, results for the terms on the right are also included.</p>

	{#if entries.length === 0}
		<div class="py-6 text-center">
			<BookOpen size={24} class="mx-auto mb-2 text-text-theme-tertiary opacity-40" />
			<p class="text-xs text-text-theme-tertiary">No synonyms defined. Add pairs below to expand search coverage.</p>
		</div>
	{:else}
		<div class="space-y-0 max-h-80 overflow-y-auto rounded border border-theme">
			{#each entries as [term, expansions], i (term)}
				<div class="flex items-center gap-3 text-xs py-2.5 px-3 {i > 0 ? 'border-t border-theme' : ''} hover:bg-surface-secondary transition-colors">
					<span class="font-mono font-medium text-text-theme-primary min-w-[120px]">{term}</span>
					<span class="text-text-theme-tertiary select-none">&rarr;</span>
					<span class="text-text-theme-secondary flex-1">{expansions.join(', ')}</span>
					{#if !disabled}
						<button onclick={() => onRemove(term)} class="text-red-400 hover:text-red-500 shrink-0 transition-colors p-0.5">&times;</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if !disabled}
		<div class="flex gap-2 mt-3">
			<input
				bind:value={newTerm}
				class="input text-xs py-1.5 w-32"
				placeholder="Term"
			/>
			<input
				bind:value={newExpansions}
				class="input text-xs py-1.5 flex-1"
				placeholder="Expansions (comma-separated)"
				onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
			/>
			<button onclick={handleAdd} class="btn btn-outline text-xs py-1.5 px-3">Add</button>
		</div>
	{/if}
</div>
