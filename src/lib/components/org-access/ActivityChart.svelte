<script lang="ts">
	// Daily visits from this organization's networks, one bar per day. Plain
	// SVG; the totals line underneath carries the same facts as text.
	import { fmtDate, fmtNumber } from '$lib/utils/org-access';

	let { daily }: { daily: Array<{ date: string; visits: number }> } = $props();

	const W = 540;
	const H = 72;
	let max = $derived(Math.max(1, ...daily.map((d) => d.visits)));
	let total = $derived(daily.reduce((s, d) => s + d.visits, 0));
	let activeDays = $derived(daily.filter((d) => d.visits > 0).length);
	let barW = $derived(daily.length ? W / daily.length : W);
</script>

{#if daily.length === 0}
	<p class="text-sm text-text-theme-secondary">No visit data yet.</p>
{:else}
	<figure>
		<svg
			viewBox="0 0 {W} {H}"
			preserveAspectRatio="none"
			class="h-20 w-full text-interactive"
			role="img"
			aria-label="{fmtNumber(total)} visits over the last {daily.length} days"
		>
			<line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} stroke="var(--color-border)" />
			{#each daily as d, i}
				{@const h = d.visits === 0 ? 0 : Math.max(2, (d.visits / max) * (H - 4))}
				<rect x={i * barW + 0.5} y={H - h} width={Math.max(1, barW - 1)} height={h} fill="currentColor" opacity="0.8">
					<title>{fmtDate(d.date)}: {fmtNumber(d.visits)} visits</title>
				</rect>
			{/each}
		</svg>
		<figcaption class="mt-1 flex justify-between text-[11px] text-text-theme-tertiary">
			<span>{fmtDate(daily[0].date)}</span>
			<span>
				{fmtNumber(total)} visits on {activeDays} of {daily.length} days · busiest day {fmtNumber(total === 0 ? 0 : max)}
			</span>
			<span>{fmtDate(daily[daily.length - 1].date)}</span>
		</figcaption>
	</figure>
{/if}
