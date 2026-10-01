<script lang="ts">
	// The answer to "what happens for a visitor at this address, and why?".
	// Shows the server's plain-English explanation first, then every address on
	// file that mentions this one: the winner, the ones it overruled, and the
	// ones that would match but are turned off. That last group is usually the
	// answer to "why doesn't this person get access?".
	import { base } from '$app/paths';
	import type { IpTestResult } from '$lib/services/org-access-api';
	import { outcomeInfo, routeLabel, ruleTarget, TONE_CLASSES } from '$lib/utils/org-access';
	import BannerPreview from './BannerPreview.svelte';
	import Chip from './Chip.svelte';

	let { result, compact = false }: { result: IpTestResult; compact?: boolean } = $props();

	let tone = $derived(!result.parsed ? 'error' : result.matched ? 'success' : 'neutral');
</script>

<div class="space-y-3">
	<div class="rounded-md border px-3 py-2 {TONE_CLASSES[tone as 'error' | 'success' | 'neutral']}">
		<p class="text-xs text-text-theme-secondary">
			Address tested: <span class="font-mono text-text-theme-primary">{result.ip || '(blank)'}</span>
			{#if result.parsed}
				· {result.ptr_host
					? `Its network name is ${result.ptr_host}`
					: 'It has no network name (reverse DNS)'}
			{/if}
		</p>
		<p class="mt-1 text-sm font-medium text-text-theme-primary" data-testid="ip-test-explanation">
			{#if !result.parsed && !result.explanation}
				That isn’t an address we can read. Try one like 65.242.55.12.
			{:else}
				{result.explanation}
			{/if}
		</p>
	</div>

	{#if result.parsed}
		{#if result.matched}
			<div class="grid gap-3 sm:grid-cols-2">
				<BannerPreview name={result.matched.organization.name} caption="A visitor at this address sees" />
				<div class="text-sm text-text-theme-secondary">
					<p>
						Granted by
						<a class="text-interactive hover:underline" href="{base}/org-access/orgs/{result.matched.organization.id}"
							>{result.matched.organization.name}</a
						>, address <span class="font-mono text-text-theme-primary">{ruleTarget(result.matched.rule)}</span>.
					</p>
					{#if result.matched.rule.kind === 'domain' && result.matched.matched_on}
						<!-- For a host-name rule, which name matched (reverse DNS, or the address text). -->
						<p class="mt-1 text-xs">Matched the name <span class="font-mono">{result.matched.matched_on}</span>.</p>
					{/if}
				</div>
			</div>
		{:else}
			<p class="text-sm text-text-theme-secondary">
				A visitor at this address sees no organization banner. They see the public collection unless they sign in.
			</p>
		{/if}

		{#if result.candidates.length === 0}
			<p class="text-sm text-text-theme-secondary">No address on file mentions this one, turned on or off.</p>
		{:else if compact}
			<p class="text-xs text-text-theme-secondary">
				{result.candidates.length}
				{result.candidates.length === 1 ? 'address on file mentions' : 'addresses on file mention'} this one.
				<a class="text-interactive hover:underline" href="{base}/org-access/test?ip={encodeURIComponent(result.ip)}"
					>See why</a
				>
			</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<caption class="mb-1 text-left text-xs text-text-theme-secondary">
						Every address on file that covers this one
					</caption>
					<thead>
						<tr class="border-b border-border-theme text-left text-xs text-text-theme-tertiary">
							<th class="py-1.5 pr-3 font-medium">Result</th>
							<th class="py-1.5 pr-3 font-medium">Organization</th>
							<th class="py-1.5 pr-3 font-medium">Address on file</th>
							<th class="py-1.5 font-medium">How they connect</th>
						</tr>
					</thead>
					<tbody>
						{#each result.candidates as c (c.rule.id)}
							{@const info = outcomeInfo(c.outcome)}
							<tr class="border-b border-border-theme last:border-0">
								<td class="py-1.5 pr-3"><Chip tone={info.tone} title={info.help}>{info.label}</Chip></td>
								<td class="py-1.5 pr-3">
									<a class="text-interactive hover:underline" href="{base}/org-access/orgs/{c.organization.id}"
										>{c.organization.name}</a
									>
								</td>
								<td class="py-1.5 pr-3 font-mono text-text-theme-primary">{ruleTarget(c.rule)}</td>
								<td class="py-1.5 text-text-theme-secondary">{routeLabel(c.rule.route)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>
