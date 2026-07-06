<script lang="ts">
	import { Regex } from 'lucide-svelte';

	let {
		patterns,
		disabled = false,
		onAdd,
		onRemove
	}: {
		patterns: string[];
		disabled?: boolean;
		onAdd: (pattern: string) => void;
		onRemove: (pattern: string) => void;
	} = $props();

	let newPattern = $state('');
	let patternError = $state<string | null>(null);

	function handleAdd() {
		const pattern = newPattern.trim();
		if (!pattern) return;
		try {
			new RegExp(pattern);
		} catch (e) {
			patternError = e instanceof Error ? e.message : 'Invalid pattern';
			return;
		}
		patternError = null;
		onAdd(pattern);
		newPattern = '';
	}
</script>

<div>
	<h3 class="text-xs font-semibold text-text-theme-secondary uppercase tracking-wider mb-2">Excluded Patterns</h3>
	<p class="text-[11px] text-text-theme-tertiary mb-3 leading-relaxed">Documents whose title matches these regular expressions are filtered from search results. Like Excluded Terms, but for patterns (e.g. <code class="font-mono">\bS\s*//\s*NF\b</code> for marking variants).</p>

	{#if patterns.length === 0}
		<div class="py-6 text-center">
			<Regex size={24} class="mx-auto mb-2 text-text-theme-tertiary opacity-40" />
			<p class="text-xs text-text-theme-tertiary">No excluded patterns. Add a regular expression below.</p>
		</div>
	{:else}
		<div class="flex flex-wrap gap-1.5">
			{#each patterns as pattern (pattern)}
				<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 transition-colors">
					{pattern}
					{#if !disabled}
						<button onclick={() => onRemove(pattern)} class="hover:text-red-900 dark:hover:text-red-100 transition-colors ml-0.5">&times;</button>
					{/if}
				</span>
			{/each}
		</div>
	{/if}

	{#if !disabled}
		<div class="flex gap-2 mt-3">
			<input
				bind:value={newPattern}
				class="input text-xs py-1.5 flex-1 font-mono"
				placeholder="Regex pattern to exclude"
				onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
			/>
			<button onclick={handleAdd} class="btn btn-outline text-xs py-1.5 px-3">Add</button>
		</div>
		{#if patternError}
			<p class="text-[11px] text-red-600 dark:text-red-400 mt-1.5">Invalid pattern: {patternError}</p>
		{/if}
	{/if}
</div>
