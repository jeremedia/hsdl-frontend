<script lang="ts">
	// What the server says about an address while it is being typed. Pure
	// render: AddressFields owns the request; this only turns the answer into
	// sentences and one-click fixes.
	import { CheckCircle2, AlertTriangle, XCircle, Loader2, Lightbulb } from 'lucide-svelte';
	import { messageText, type RuleValidation, type Route } from '$lib/services/org-access-api';
	import { routeLabel, TONE_CLASSES } from '$lib/utils/org-access';

	let {
		validation,
		pending = false,
		error = null,
		value,
		route,
		onUseNormalized,
		onUseRoute
	}: {
		validation: RuleValidation | null;
		pending?: boolean;
		error?: string | null;
		value: string;
		route: Route;
		onUseNormalized?: (normalized: string) => void;
		onUseRoute?: (route: Route) => void;
	} = $props();

	let errors = $derived((validation?.errors ?? []).map(messageText).filter(Boolean));
	let warnings = $derived((validation?.warnings ?? []).map(messageText).filter(Boolean));
	let correction = $derived(
		// Only offered when the typed text is wrong; a valid entry that is merely
		// normalized ("1.2.3.4" stored as 1.2.3.4/32) is already shown above.
		validation && !validation.valid && validation.normalized && validation.normalized !== value.trim() ? validation.normalized : null
	);
	let suggestion = $derived(
		validation?.suggested_route && validation.suggested_route !== route && validation.suggested_route !== 'unknown'
			? validation.suggested_route
			: null
	);
</script>

<div class="space-y-1.5 text-xs" aria-live="polite">
	{#if pending}
		<p class="flex items-center gap-1.5 text-text-theme-tertiary">
			<Loader2 size={13} class="animate-spin" /> Checking this address…
		</p>
	{:else if error}
		<p class="flex items-center gap-1.5 text-text-theme-secondary">
			<AlertTriangle size={13} />
			Couldn’t check this address just now ({error}). It will be checked again when you save.
		</p>
	{:else if validation}
		{#if validation.valid && errors.length === 0}
			<p class="flex flex-wrap items-center gap-1.5 text-text-theme-primary">
				<CheckCircle2 size={13} class="text-success" />
				<span>
					Looks right{#if validation.normalized}: <span class="font-mono">{validation.normalized}</span>{/if}.
					{#if validation.breadth}
						This covers <strong>{validation.breadth.label}</strong>.
					{/if}
				</span>
			</p>
		{/if}

		{#each errors as msg}
			<p class="flex items-start gap-1.5 rounded border px-2 py-1 {TONE_CLASSES.error}" role="alert">
				<XCircle size={13} class="mt-0.5 flex-shrink-0 text-error" />
				<span>{msg}</span>
			</p>
		{/each}

		{#if correction}
			<p class="flex flex-wrap items-center gap-2 text-text-theme-secondary">
				<span>Did you mean <span class="font-mono text-text-theme-primary">{correction}</span>?</span>
				<button
					type="button"
					class="rounded border border-border-theme bg-surface-elevated px-2 py-0.5 text-interactive hover:bg-surface-secondary"
					onclick={() => onUseNormalized?.(correction!)}
				>
					Use {correction}
				</button>
			</p>
		{/if}

		{#if !validation.valid && validation.breadth}
			<p class="text-text-theme-secondary">As typed, this would cover {validation.breadth.label}.</p>
		{/if}

		{#each warnings as msg}
			<p class="flex items-start gap-1.5 rounded border px-2 py-1 {TONE_CLASSES.warning}">
				<AlertTriangle size={13} class="mt-0.5 flex-shrink-0" />
				<span>{msg}</span>
			</p>
		{/each}

		{#if suggestion}
			<p class="flex flex-wrap items-center gap-2 text-text-theme-secondary">
				<Lightbulb size={13} />
				<span>This looks like a <strong class="text-text-theme-primary">{routeLabel(suggestion)}</strong> address.</span>
				<button
					type="button"
					class="rounded border border-border-theme bg-surface-elevated px-2 py-0.5 text-interactive hover:bg-surface-secondary"
					onclick={() => onUseRoute?.(suggestion!)}
				>
					Set “How they connect” to {routeLabel(suggestion)}
				</button>
			</p>
		{/if}
	{/if}
</div>
