<script lang="ts">
	// Requests from the public "request organization access" form.
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { derived } from 'svelte/store';
	import { orgAccessApi, type RequestStatus } from '$lib/services/org-access-api';
	import { fmtDate, orgTypeLabel, REQUEST_STATUS_INFO } from '$lib/utils/org-access';
	import Chip from '$lib/components/org-access/Chip.svelte';

	const TABS: Array<{ value: RequestStatus | 'all'; label: string }> = [
		{ value: 'pending', label: 'Waiting' },
		{ value: 'approved', label: 'Approved' },
		{ value: 'declined', label: 'Declined' },
		{ value: 'spam', label: 'Spam' },
		{ value: 'all', label: 'All' }
	];

	const statusOf = (sp: URLSearchParams) => (sp.get('status') as RequestStatus | 'all') || 'pending';

	const listQuery = createQuery(
		derived(page, ($p) => {
			const status = statusOf($p.url.searchParams);
			return {
				queryKey: ['org-access', 'requests', status],
				queryFn: () => orgAccessApi.listRequests(status)
			};
		})
	);

	let status = $derived(statusOf($page.url.searchParams));
	let rows = $derived($listQuery.data?.requests ?? []);
</script>

<div class="mb-4 flex flex-wrap gap-1" role="tablist" aria-label="Request status">
	{#each TABS as t}
		<button
			role="tab"
			aria-selected={status === t.value}
			onclick={() => goto(`${base}/org-access/requests?status=${t.value}`, { replaceState: true, noScroll: true })}
			class="rounded-full border px-3 py-1 text-xs transition-colors
				{status === t.value
				? 'border-interactive bg-surface-secondary font-medium text-text-theme-primary'
				: 'border-border-theme text-text-theme-secondary hover:bg-surface-secondary'}"
		>
			{t.label}
		</button>
	{/each}
</div>

{#if $listQuery.isPending}
	<p class="text-sm text-text-theme-secondary">Loading…</p>
{:else if $listQuery.isError}
	<p class="text-sm text-error" role="alert">Couldn’t load requests: {$listQuery.error.message}</p>
{:else if rows.length === 0}
	<p class="card rounded-md p-6 text-center text-sm text-text-theme-secondary">
		{status === 'pending' ? 'No requests are waiting. New ones from the public form show up here.' : 'Nothing here.'}
	</p>
{:else}
	<div class="card overflow-x-auto rounded-md">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-border-theme text-left text-xs text-text-theme-tertiary">
					<th class="px-3 py-2 font-medium">Organization</th>
					<th class="px-3 py-2 font-medium">Type</th>
					<th class="px-3 py-2 font-medium">Contact</th>
					<th class="px-3 py-2 font-medium">Sent</th>
					<th class="px-3 py-2 font-medium">Status</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r (r.id)}
					{@const st = REQUEST_STATUS_INFO[r.status] ?? { label: r.status, tone: 'neutral' }}
					<tr class="border-b border-border-theme last:border-0 hover:bg-surface-secondary">
						<td class="px-3 py-2">
							<a href="{base}/org-access/requests/{r.id}" class="font-medium text-interactive hover:underline">
								{r.display_name || r.org_name}
							</a>
							{#if r.display_name && r.display_name !== r.org_name}
								<span class="block text-xs text-text-theme-tertiary">{r.org_name}</span>
							{/if}
						</td>
						<td class="px-3 py-2 text-text-theme-secondary">{orgTypeLabel(r.org_type)}</td>
						<td class="px-3 py-2 text-text-theme-secondary">
							{r.contact_name ?? '—'}{#if r.contact_email}<span class="block text-xs">{r.contact_email}</span>{/if}
						</td>
						<td class="whitespace-nowrap px-3 py-2 text-text-theme-secondary">{fmtDate(r.created_at)}</td>
						<td class="px-3 py-2"><Chip tone={st.tone}>{st.label}</Chip></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
