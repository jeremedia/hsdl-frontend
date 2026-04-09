<script lang="ts">
	import { Info } from 'lucide-svelte';

	let { paramKey, content }: { paramKey: string; content: string } = $props();

	let open = $state(false);
	let wrapperEl: HTMLDivElement | undefined = $state();
	let buttonEl: HTMLButtonElement | undefined = $state();
	let popoverX = $state(0);
	let popoverY = $state(0);

	function updatePosition() {
		if (!buttonEl) return;
		const rect = buttonEl.getBoundingClientRect();
		popoverX = Math.max(8, rect.left);
		popoverY = rect.bottom + 4;
	}

	$effect(() => {
		if (!open) return;

		function handleClickOutside(event: MouseEvent) {
			if (wrapperEl && !wrapperEl.contains(event.target as Node)) {
				open = false;
			}
		}

		window.addEventListener('click', handleClickOutside, true);
		return () => window.removeEventListener('click', handleClickOutside, true);
	});
</script>

<div class="static inline-flex" bind:this={wrapperEl}>
	<button
		type="button"
		class="text-text-theme-tertiary hover:text-interactive transition-colors"
		bind:this={buttonEl}
		onclick={() => { updatePosition(); open = !open; }}
		aria-label="Info for {paramKey}"
	>
		<Info size={12} />
	</button>

	{#if open}
		<div class="fixed z-50 text-[11px] text-text-theme-secondary bg-surface-elevated rounded px-3 py-2 leading-relaxed shadow-lg border border-theme w-72" style="top: {popoverY}px; left: {popoverX}px;">
			{content}
		</div>
	{/if}
</div>
