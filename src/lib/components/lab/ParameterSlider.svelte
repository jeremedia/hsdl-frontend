<script lang="ts">
	import InfoPopover from './InfoPopover.svelte';

	let {
		label,
		paramKey,
		value,
		min,
		max,
		step,
		description,
		detailedDescription,
		scaleLabels,
		disabled = false,
		formatValue,
		oninput
	}: {
		label: string;
		paramKey: string;
		value: number;
		min: number;
		max: number;
		step: number;
		description: string;
		detailedDescription: string;
		scaleLabels: [string, string, string];
		disabled?: boolean;
		formatValue?: (v: number) => string;
		oninput: (value: number) => void;
	} = $props();

	let displayValue = $derived(formatValue ? formatValue(value) : String(value));

	function handleInput(e: Event) {
		const raw = (e.target as HTMLInputElement).value;
		const parsed = step >= 1 ? parseInt(raw, 10) : parseFloat(raw);
		oninput(parsed);
	}
</script>

<div class="param-group">
	<div class="flex items-center justify-between mb-0.5">
		<div class="flex items-center gap-1.5">
			<span class="text-xs font-medium text-text-theme-primary">{label}</span>
			<InfoPopover {paramKey} content={detailedDescription} />
		</div>
		<span class="text-xs font-mono text-interactive tabular-nums">{displayValue}</span>
	</div>
	<p class="text-[11px] text-text-theme-tertiary mb-1.5 leading-snug">{description}</p>
	<input
		type="range"
		{min}
		{max}
		{step}
		{value}
		{disabled}
		aria-label={label}
		class="lab-slider w-full"
		oninput={handleInput}
	/>
	<div class="flex justify-between text-[10px] text-text-theme-tertiary mt-1 opacity-70">
		<span>{scaleLabels[0]}</span>
		<span>{scaleLabels[1]}</span>
		<span>{scaleLabels[2]}</span>
	</div>
</div>

<style>
	.lab-slider {
		-webkit-appearance: none;
		appearance: none;
		height: 6px;
		border-radius: 3px;
		background: var(--color-gray-300);
		outline: none;
		cursor: pointer;
	}
	.lab-slider:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.lab-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--color-interactive);
		border: 2px solid var(--color-surface-elevated);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
		cursor: pointer;
		transition: transform 150ms ease, box-shadow 150ms ease;
	}
	.lab-slider::-webkit-slider-thumb:hover {
		transform: scale(1.15);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
	}
	.lab-slider::-webkit-slider-thumb:active {
		transform: scale(1.05);
	}
	.lab-slider:focus-visible::-webkit-slider-thumb {
		box-shadow: 0 0 0 3px var(--color-interactive), 0 0 0 5px rgba(0, 0, 0, 0.1);
	}
	.lab-slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--color-interactive);
		border: 2px solid var(--color-surface-elevated);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
		cursor: pointer;
		transition: transform 150ms ease, box-shadow 150ms ease;
	}
	.lab-slider::-moz-range-thumb:hover {
		transform: scale(1.15);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
	}
	.lab-slider::-moz-range-track {
		height: 6px;
		border-radius: 3px;
		background: var(--color-gray-300);
	}
	:global(.param-group + .param-group) {
		padding-top: 0.75rem;
		margin-top: 0.75rem;
		border-top: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
	}
</style>
