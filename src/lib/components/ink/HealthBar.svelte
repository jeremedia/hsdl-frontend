<script lang="ts">
	let { score, size = 'md' }: { score: number | null; size?: 'sm' | 'md' | 'lg' } = $props();

	let color = $derived.by(() => {
		if (score === null) return 'bg-gray-300';
		if (score >= 0.8) return 'bg-green-500';
		if (score >= 0.6) return 'bg-blue-500';
		if (score >= 0.4) return 'bg-yellow-500';
		return 'bg-red-500';
	});

	let label = $derived.by(() => {
		if (score === null) return 'N/A';
		if (score >= 0.8) return 'Excellent';
		if (score >= 0.6) return 'Good';
		if (score >= 0.4) return 'Fair';
		return 'Poor';
	});

	let width = $derived(score !== null ? `${Math.round(score * 100)}%` : '0%');
	let pct = $derived(score !== null ? Math.round(score * 100) : null);

	let barHeight = $derived(
		size === 'sm' ? 'h-1' : size === 'lg' ? 'h-2.5' : 'h-1.5'
	);
</script>

<div
	class="flex items-center gap-1.5"
	title="{label}: {pct !== null ? pct : 0}%"
	role="meter"
	aria-label="Health score"
	aria-valuenow={pct ?? 0}
	aria-valuemin={0}
	aria-valuemax={100}
>
	<div class="flex-1 {barHeight} bg-surface-secondary rounded-full overflow-hidden">
		<div
			class="{barHeight} {color} transition-all duration-300 rounded-full"
			style="width: {width}"
		></div>
	</div>
	<span class="text-[0.625rem] text-text-theme-tertiary tabular-nums w-6 text-right leading-none">
		{pct !== null ? pct : '--'}
	</span>
</div>
