<script lang="ts">
	// One network address being added or edited, with the server's verdict shown
	// while it is typed (debounced POST org_access/rules/validate). Used by the
	// org page's add/edit form and, once per address, by the approve flow.
	import { untrack } from 'svelte';
	import { orgAccessApi, ROUTES, type FieldErrors, type Route, type RuleValidation } from '$lib/services/org-access-api';
	import {
		detectKind,
		draftToInput,
		needsJustification,
		ROUTE_INFO,
		type RuleDraft
	} from '$lib/utils/org-access';
	import ValidationFeedback from './ValidationFeedback.svelte';

	let {
		draft = $bindable(),
		organizationId,
		ruleId,
		serverErrors = {},
		idPrefix = 'addr',
		onValidation
	}: {
		draft: RuleDraft;
		organizationId?: number;
		ruleId?: number;
		serverErrors?: FieldErrors;
		idPrefix?: string;
		onValidation?: (v: RuleValidation | null) => void;
	} = $props();

	const DEBOUNCE_MS = 400;

	let validation = $state<RuleValidation | null>(null);
	let pending = $state(false);
	let checkError = $state<string | null>(null);

	// Errors from the last save describe the address as it was then. Once the
	// address is edited they no longer apply, and live validation takes over.
	let erroredValue = $state<string | null>(null);
	$effect.pre(() => {
		void serverErrors;
		erroredValue = untrack(() => draft.value);
	});
	let liveServerErrors = $derived<FieldErrors>(draft.value === erroredValue ? serverErrors : {});

	let kind = $derived(detectKind(draft.value));
	let addressErrors = $derived([
		...(liveServerErrors.cidr_text ?? []),
		...(liveServerErrors.domain_pattern ?? []),
		...(liveServerErrors.kind ?? []),
		...(liveServerErrors.base ?? [])
	]);
	let showReason = $derived(
		needsJustification(kind, draft.value) ||
			draft.justification.trim() !== '' ||
			(liveServerErrors.justification?.length ?? 0) > 0 ||
			(validation?.errors ?? []).some((e) => /justif|reason/i.test(typeof e === 'string' ? e : e.message))
	);

	$effect(() => {
		// Tracked: what changes the verdict. The route is read untracked below so
		// filling in a suggested route doesn't send the same address again.
		const value = draft.value.trim();
		void draft.justification;
		const orgId = organizationId;
		const editing = ruleId;

		if (!value) {
			validation = null;
			pending = false;
			checkError = null;
			onValidation?.(null);
			return;
		}

		pending = true;
		const ac = new AbortController();
		const timer = setTimeout(() => {
			const body = untrack(() => ({
				...draftToInput(draft),
				...(orgId ? { organization_id: orgId } : {}),
				...(editing ? { rule_id: editing } : {})
			}));
			orgAccessApi
				.validateRule(body, ac.signal)
				.then((v) => {
					validation = v;
					checkError = null;
					pending = false;
					onValidation?.(v);
					if (!draft.routeTouched) draft.route = v.suggested_route ?? 'unknown';
				})
				.catch((err: unknown) => {
					if (ac.signal.aborted) return;
					checkError = err instanceof Error ? err.message : 'network error';
					validation = null;
					pending = false;
					onValidation?.(null);
				});
		}, DEBOUNCE_MS);

		return () => {
			clearTimeout(timer);
			ac.abort();
		};
	});

	function pickRoute(r: Route) {
		draft.route = r;
		draft.routeTouched = true;
	}
</script>

<div class="space-y-3">
	<div>
		<label for="{idPrefix}-value" class="block text-xs font-medium text-text-theme-secondary">Address or range</label>
		<input
			id="{idPrefix}-value"
			type="text"
			bind:value={draft.value}
			autocomplete="off"
			spellcheck="false"
			placeholder="e.g. 65.242.55.0/24, 132.174.12.5, or *.example.edu"
			aria-invalid={addressErrors.length > 0 || (validation ? !validation.valid : undefined)}
			class="mt-1 w-full rounded-md border border-border-theme bg-surface-elevated px-3 py-2 font-mono text-sm text-text-theme-primary"
		/>
		<p class="mt-1 text-[11px] text-text-theme-tertiary">
			{#if draft.value.trim()}
				{kind === 'cidr'
					? 'Read as a network range: visitors whose address falls inside it get access.'
					: 'Read as a host name: matched against the name a visitor’s address resolves to.'}
			{:else}
				A single address, a range like 65.242.55.0/24, or a host name pattern like *.example.edu.
			{/if}
		</p>
		{#each addressErrors as msg}
			<p class="mt-1 text-xs text-error" role="alert">{msg}</p>
		{/each}
		<div class="mt-1.5">
			<ValidationFeedback
				{validation}
				{pending}
				error={checkError}
				value={draft.value}
				route={draft.route}
				onUseNormalized={(n) => (draft.value = n)}
				onUseRoute={pickRoute}
			/>
		</div>
	</div>

	<div class="grid gap-3 sm:grid-cols-2">
		<div>
			<label for="{idPrefix}-route" class="block text-xs font-medium text-text-theme-secondary">How they connect</label>
			<select
				id="{idPrefix}-route"
				value={draft.route}
				onchange={(e) => pickRoute((e.currentTarget as HTMLSelectElement).value as Route)}
				class="mt-1 w-full rounded-md border border-border-theme bg-surface-elevated px-3 py-2 text-sm text-text-theme-primary"
			>
				{#each ROUTES as r}
					<option value={r}>{ROUTE_INFO[r].label}</option>
				{/each}
			</select>
			<p class="mt-1 text-[11px] text-text-theme-tertiary">{ROUTE_INFO[draft.route]?.help}</p>
			{#each liveServerErrors.route ?? [] as msg}
				<p class="mt-1 text-xs text-error" role="alert">{msg}</p>
			{/each}
		</div>
		<div>
			<label for="{idPrefix}-note" class="block text-xs font-medium text-text-theme-secondary">Note for staff (optional)</label>
			<input
				id="{idPrefix}-note"
				type="text"
				bind:value={draft.note}
				placeholder="e.g. Main library building, from Jane’s email of Oct 1"
				class="mt-1 w-full rounded-md border border-border-theme bg-surface-elevated px-3 py-2 text-sm text-text-theme-primary"
			/>
			{#each liveServerErrors.note ?? [] as msg}
				<p class="mt-1 text-xs text-error" role="alert">{msg}</p>
			{/each}
		</div>
	</div>

	{#if showReason}
		<div>
			<label for="{idPrefix}-reason" class="block text-xs font-medium text-text-theme-secondary">
				Why this whole range belongs to them
			</label>
			<textarea
				id="{idPrefix}-reason"
				rows="2"
				bind:value={draft.justification}
				placeholder="e.g. ARIN lists the whole block as registered to the university (checked Oct 1)."
				class="mt-1 w-full rounded-md border border-border-theme bg-surface-elevated px-3 py-2 text-sm text-text-theme-primary"
			></textarea>
			<p class="mt-1 text-[11px] text-text-theme-tertiary">
				Required for very broad ranges and catch-all names: everyone inside counts as a registered user under our
				publishers’ terms.
			</p>
			{#each liveServerErrors.justification ?? [] as msg}
				<p class="mt-1 text-xs text-error" role="alert">{msg}</p>
			{/each}
		</div>
	{/if}
</div>
