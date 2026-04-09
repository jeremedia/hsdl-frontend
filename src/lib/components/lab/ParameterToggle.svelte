<script lang="ts">
	import InfoPopover from './InfoPopover.svelte';

	let {
		label,
		paramKey,
		value,
		description,
		detailedDescription,
		disabled = false,
		onchange
	}: {
		label: string;
		paramKey: string;
		value: boolean;
		description: string;
		detailedDescription: string;
		disabled?: boolean;
		onchange: (value: boolean) => void;
	} = $props();
</script>

<div class="param-group flex items-center justify-between">
	<div>
		<div class="flex items-center gap-1.5">
			<span class="text-xs font-medium text-text-theme-primary">{label}</span>
			<InfoPopover {paramKey} content={detailedDescription} />
		</div>
		<p class="text-[11px] text-text-theme-tertiary mt-0.5 leading-relaxed">{description}</p>
	</div>
	<button
		onclick={() => onchange(!value)}
		{disabled}
		class="relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0
			{value ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}
			{disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
		aria-checked={value}
		aria-label={label}
		role="switch"
	>
		<span
			class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm
				transition-transform duration-200 {value ? 'translate-x-5' : ''}"
		></span>
	</button>
</div>

<style>
	.param-group + :global(.param-group) {
		padding-top: 0.25rem;
		border-top: 1px solid var(--color-border);
	}
</style>
