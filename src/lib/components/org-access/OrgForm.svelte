<script lang="ts">
	// Organization details: create, edit, and the "new organization" half of
	// approving a request. The banner preview follows the name field so the
	// person typing sees the exact line visitors will read.
	import { untrack } from 'svelte';
	import { ORG_TYPES, type FieldErrors, type OrgEditable } from '$lib/services/org-access-api';
	import { ORG_TYPE_LABELS } from '$lib/utils/org-access';
	import BannerPreview from './BannerPreview.svelte';

	type Values = { [K in keyof OrgEditable]: string | boolean };

	let {
		initial = {},
		errors = {},
		submitting = false,
		submitLabel = 'Save',
		showDisabled = false,
		embedded = false,
		values = $bindable(),
		onSubmit,
		onCancel
	}: {
		initial?: Partial<OrgEditable>;
		errors?: FieldErrors;
		submitting?: boolean;
		submitLabel?: string;
		showDisabled?: boolean;
		// Embedded: no form element or buttons; the parent reads `values` and saves.
		embedded?: boolean;
		values?: Partial<OrgEditable>;
		onSubmit?: (values: Partial<OrgEditable>) => void;
		onCancel?: () => void;
	} = $props();

	// A local copy, taken once: the form edits it and hands back a clean object.
	const s = (v: unknown) => (v == null ? '' : String(v));
	const seed = untrack(() => initial);
	let form = $state({
		name: s(seed.name),
		disabled: !!seed.disabled,
		org_type: s(seed.org_type),
		jurisdiction: s(seed.jurisdiction),
		city: s(seed.city),
		state: s(seed.state),
		contact_name: s(seed.contact_name),
		contact_email: s(seed.contact_email),
		contact_phone: s(seed.contact_phone),
		secondary_contact: s(seed.secondary_contact),
		notes: s(seed.notes),
		review_by: s(seed.review_by).slice(0, 10)
	} satisfies Values);

	let cleaned = $derived.by((): Partial<OrgEditable> => {
		const blank = (v: string) => (v.trim() === '' ? null : v.trim());
		return {
			name: form.name.trim(),
			...(showDisabled ? { disabled: form.disabled } : {}),
			org_type: blank(form.org_type) as OrgEditable['org_type'],
			jurisdiction: blank(form.jurisdiction),
			city: blank(form.city),
			state: blank(form.state),
			contact_name: blank(form.contact_name),
			contact_email: blank(form.contact_email),
			contact_phone: blank(form.contact_phone),
			secondary_contact: blank(form.secondary_contact),
			notes: blank(form.notes),
			review_by: blank(form.review_by)
		};
	});

	// Bridge the derived object to the bindable prop (a bindable can't be $derived).
	$effect(() => {
		values = cleaned;
	});

	function submit(e: SubmitEvent) {
		e.preventDefault();
		onSubmit?.(cleaned);
	}

	const input =
		'mt-1 w-full rounded-md border border-border-theme bg-surface-elevated px-3 py-2 text-sm text-text-theme-primary';
	const label = 'block text-xs font-medium text-text-theme-secondary';
</script>

{#snippet fieldErrors(field: string)}
	{#each errors[field] ?? [] as msg}
		<p class="mt-1 text-xs text-error" role="alert">{msg}</p>
	{/each}
{/snippet}

{#snippet fields()}
	<div class="space-y-4">
		{#each errors.base ?? [] as msg}
			<p class="text-sm text-error" role="alert">{msg}</p>
		{/each}

		<div>
			<label for="org-name" class={label}>Name visitors see</label>
			<input id="org-name" type="text" bind:value={form.name} required class={input} />
			<p class="mt-1 text-[11px] text-text-theme-tertiary">
				Shown on every page to everyone on this organization’s network, exactly as typed.
			</p>
			{@render fieldErrors('name')}
			<div class="mt-2"><BannerPreview name={form.name} /></div>
		</div>

		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<label for="org-type" class={label}>Type</label>
				<select id="org-type" bind:value={form.org_type} class={input}>
					<option value=''>Not set</option>
					{#each ORG_TYPES as t}
						<option value={t}>{ORG_TYPE_LABELS[t]}</option>
					{/each}
				</select>
				{@render fieldErrors('org_type')}
			</div>
			<div>
				<label for="org-jurisdiction" class={label}>Jurisdiction</label>
				<input id="org-jurisdiction" type="text" bind:value={form.jurisdiction} class={input} />
				{@render fieldErrors('jurisdiction')}
			</div>
			<div>
				<label for="org-city" class={label}>City</label>
				<input id="org-city" type="text" bind:value={form.city} class={input} />
				{@render fieldErrors('city')}
			</div>
			<div>
				<label for="org-state" class={label}>State</label>
				<input id="org-state" type="text" bind:value={form.state} class={input} />
				{@render fieldErrors('state')}
			</div>
		</div>

		<fieldset class="grid gap-3 sm:grid-cols-3">
			<legend class="mb-1 text-xs font-semibold uppercase tracking-wide text-text-theme-tertiary">Contact</legend>
			<div>
				<label for="org-contact-name" class={label}>Name</label>
				<input id="org-contact-name" type="text" bind:value={form.contact_name} class={input} />
				{@render fieldErrors('contact_name')}
			</div>
			<div>
				<label for="org-contact-email" class={label}>Email</label>
				<input id="org-contact-email" type="email" bind:value={form.contact_email} class={input} />
				{@render fieldErrors('contact_email')}
			</div>
			<div>
				<label for="org-contact-phone" class={label}>Phone</label>
				<input id="org-contact-phone" type="tel" bind:value={form.contact_phone} class={input} />
				{@render fieldErrors('contact_phone')}
			</div>
			<div class="sm:col-span-3">
				<label for="org-secondary" class={label}>Other contacts</label>
				<textarea id="org-secondary" rows="2" bind:value={form.secondary_contact} class={input}></textarea>
				{@render fieldErrors('secondary_contact')}
			</div>
		</fieldset>

		<div class="grid gap-3 sm:grid-cols-[1fr_12rem]">
			<div>
				<label for="org-notes" class={label}>Notes</label>
				<textarea id="org-notes" rows="3" bind:value={form.notes} class={input}></textarea>
				{@render fieldErrors('notes')}
			</div>
			<div>
				<label for="org-review" class={label}>Review by</label>
				<input id="org-review" type="date" bind:value={form.review_by} class={input} />
				<p class="mt-1 text-[11px] text-text-theme-tertiary">Flagged “Review due” after this date.</p>
				{@render fieldErrors('review_by')}
			</div>
		</div>

		{#if showDisabled}
			<label class="flex items-start gap-2 text-sm text-text-theme-primary">
				<input type="checkbox" bind:checked={form.disabled} class="mt-1" />
				<span>
					Turned off
					<span class="block text-xs text-text-theme-secondary">
						Nobody gets organization access through this organization while it is turned off. Its addresses and
						history are kept.
					</span>
				</span>
			</label>
			{@render fieldErrors('disabled')}
		{/if}
	</div>
{/snippet}

{#if embedded}
	{@render fields()}
{:else}
	<form onsubmit={submit} class="space-y-4">
		{@render fields()}
		<div class="flex items-center gap-2 pt-2">
			<button
				type="submit"
				disabled={submitting || !form.name.trim()}
				class="btn btn-primary text-sm disabled:opacity-50"
			>
				{submitting ? 'Saving…' : submitLabel}
			</button>
			{#if onCancel}
				<button
					type="button"
					onclick={() => onCancel?.()}
					class="btn btn-outline text-sm"
				>
					Cancel
				</button>
			{/if}
		</div>
	</form>
{/if}
