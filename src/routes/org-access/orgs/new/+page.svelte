<script lang="ts">
	// A new organization. Addresses are added on its page once it exists, where
	// each one is checked as it is typed.
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { orgAccessApi, OrgAccessValidationError, type FieldErrors, type OrgEditable } from '$lib/services/org-access-api';
	import OrgForm from '$lib/components/org-access/OrgForm.svelte';
	import { ArrowLeft } from 'lucide-svelte';

	const queryClient = useQueryClient();
	let errors = $state<FieldErrors>({});
	let submitting = $state(false);

	async function create(values: Partial<OrgEditable>) {
		submitting = true;
		errors = {};
		try {
			const created = await orgAccessApi.createOrganization(values);
			await queryClient.invalidateQueries({ queryKey: ['org-access'] });
			await goto(`${base}/org-access/orgs/${created.organization.id}`);
		} catch (err) {
			if (err instanceof OrgAccessValidationError) errors = err.fields;
			else errors = { base: [err instanceof Error ? err.message : 'Could not create it.'] };
		} finally {
			submitting = false;
		}
	}
</script>

<a href="{base}/org-access/orgs" class="mb-3 inline-flex items-center gap-1 text-xs text-interactive hover:underline">
	<ArrowLeft size={12} /> All organizations
</a>

<section class="card max-w-3xl rounded-md p-5">
	<h2 class="text-lg font-semibold text-text-theme-primary">New organization</h2>
	<p class="mb-4 text-sm text-text-theme-secondary">
		Approving a request from the public form fills this in for you. Next you’ll add its network addresses.
		<a class="text-interactive hover:underline" href="{base}/org-access/requests">See waiting requests</a>.
	</p>
	<OrgForm {errors} {submitting} submitLabel="Create and add addresses" onSubmit={create} onCancel={() => goto(`${base}/org-access/orgs`)} />
</section>
