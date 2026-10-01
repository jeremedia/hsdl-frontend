<script lang="ts">
	// "Test an address": type an address someone reported (or test your own)
	// and see what a visitor there gets, and why.
	import { onMount, untrack } from 'svelte';
	import { Search, MapPin } from 'lucide-svelte';
	import { orgAccessApi, type IpTestResult } from '$lib/services/org-access-api';
	import IpTestResultView from './IpTestResultView.svelte';

	let {
		initialIp = '',
		autoRun = false,
		compact = false,
		onTested
	}: {
		initialIp?: string;
		autoRun?: boolean;
		compact?: boolean;
		onTested?: (ip: string) => void;
	} = $props();

	let ip = $state(untrack(() => initialIp));
	let running = $state(false);
	let result = $state<IpTestResult | null>(null);
	let error = $state<string | null>(null);

	async function run(target?: string) {
		running = true;
		error = null;
		try {
			result = await orgAccessApi.ipTest(target);
			if (!target) ip = result.ip;
			onTested?.(result.ip);
		} catch (err: unknown) {
			result = null;
			error = err instanceof Error ? err.message : 'The test could not run.';
		} finally {
			running = false;
		}
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const v = ip.trim();
		if (v) run(v);
	}

	onMount(() => {
		if (autoRun && initialIp.trim()) run(initialIp.trim());
	});
</script>

<div class="space-y-3">
	<form onsubmit={submit} class="flex flex-wrap items-center gap-2">
		<label for="ip-test-input" class="sr-only">Address to test</label>
		<input
			id="ip-test-input"
			type="text"
			bind:value={ip}
			autocomplete="off"
			spellcheck="false"
			placeholder="An address someone sent, e.g. 65.242.55.12"
			class="min-w-0 flex-1 rounded-md border border-border-theme bg-surface-elevated px-3 py-2 font-mono text-sm text-text-theme-primary"
		/>
		<button type="submit" class="btn btn-primary text-sm disabled:opacity-50" disabled={running || !ip.trim()}>
			<Search size={14} />
			{running ? 'Testing…' : 'Test'}
		</button>
		<button
			type="button"
			class="btn btn-outline text-sm disabled:opacity-50"
			disabled={running}
			title="Test the address this computer is using right now"
			onclick={() => run()}
		>
			<MapPin size={14} /> Test my address
		</button>
	</form>

	{#if error}
		<p class="text-sm text-error" role="alert">{error}</p>
	{:else if result}
		<IpTestResultView {result} {compact} />
	{/if}
</div>
