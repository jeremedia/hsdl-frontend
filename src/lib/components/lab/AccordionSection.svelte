<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChevronDown } from 'lucide-svelte';

	let {
		title,
		badge,
		open = true,
		children
	}: {
		title: string;
		badge?: string | number;
		open?: boolean;
		children: Snippet;
	} = $props();

	let isOpen = $state(open);
</script>

<div class="card overflow-hidden">
	<button
		onclick={() => (isOpen = !isOpen)}
		class="section-header w-full flex items-center justify-between px-4 py-3 text-left
			hover:bg-surface-secondary transition-colors"
	>
		<h2 class="text-sm font-semibold text-text-theme-primary">
			{title}
			{#if badge !== undefined}
				<span class="font-normal text-text-theme-tertiary ml-1.5 text-xs">({badge})</span>
			{/if}
		</h2>
		<ChevronDown
			size={16}
			class="text-text-theme-tertiary transition-transform duration-200
				{isOpen ? '' : '-rotate-90'}"
		/>
	</button>
	{#if isOpen}
		<div class="border-t border-theme px-4 pb-5 pt-4 space-y-6">
			{#if children}{@render children()}{/if}
		</div>
	{/if}
</div>

<style>
	.section-header:focus-visible {
		outline: none;
		box-shadow: inset 0 0 0 2px var(--color-interactive);
	}
</style>
