<script lang="ts">
	// Machine access keys: which outside systems (CHDS Pulse) can read
	// organization usage data, when they last did, and a way to cut one off.
	// There is no "create" here on purpose: a new key is shown exactly once,
	// at the command line, so the secret never passes through a web page.
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { orgAccessApi, type ServiceKey } from '$lib/services/org-access-api';
	import { InkApiError } from '$lib/services/ink-api';
	import { fmtDate, fmtDateTime, relativeDays, SCOPE_INFO, scopeLabel } from '$lib/utils/org-access';
	import Chip from '$lib/components/org-access/Chip.svelte';
	import { KeyRound } from 'lucide-svelte';

	const queryClient = useQueryClient();
	const keysQuery = createQuery({
		queryKey: ['org-access', 'service-keys'],
		queryFn: () => orgAccessApi.listServiceKeys()
	});

	let keys = $derived($keysQuery.data?.service_keys ?? []);
	let active = $derived(keys.filter((k) => !k.revoked));
	let revoked = $derived(keys.filter((k) => k.revoked));

	let busyId = $state<number | null>(null);
	let notice = $state<{ ok: boolean; text: string } | null>(null);

	function readers(k: ServiceKey): string {
		return k.scopes.map(scopeLabel).join(', ') || 'nothing';
	}

	async function revoke(k: ServiceKey) {
		const msg =
			`Revoke “${k.name}” (${k.token_prefix}…)?\n\n` +
			`Whatever uses this key (for example CHDS Pulse) stops getting data immediately, ` +
			`starting with its next request. This can’t be undone: to restore access, a new key has to be made and installed.`;
		if (!confirm(msg)) return;
		busyId = k.id;
		notice = null;
		try {
			await orgAccessApi.revokeServiceKey(k.id);
			notice = { ok: true, text: `“${k.name}” is revoked. It no longer gets any data.` };
			await queryClient.invalidateQueries({ queryKey: ['org-access', 'service-keys'] });
		} catch (err) {
			const gone = err instanceof InkApiError && err.status === 404;
			notice = {
				ok: false,
				text: gone ? 'That key no longer exists.' : err instanceof Error ? err.message : 'Could not revoke the key.'
			};
			if (gone) await queryClient.invalidateQueries({ queryKey: ['org-access', 'service-keys'] });
		} finally {
			busyId = null;
		}
	}
</script>

<section class="card rounded-md p-5">
	<h2 class="flex items-center gap-2 text-lg font-semibold text-text-theme-primary">
		<KeyRound size={18} /> Machine access keys
	</h2>
	<p class="mb-1 max-w-3xl text-sm text-text-theme-secondary">
		Keys that let other systems read organization access data, such as CHDS Pulse’s daily usage counts. They
		never include visitor addresses or personal details.
	</p>
	<p class="mb-4 max-w-3xl text-xs text-text-theme-tertiary">
		New keys aren’t made here: the key is shown only once, so it’s created at the command line. Ask Jeremy, or run
		<code class="rounded bg-surface-secondary px-1 font-mono text-text-theme-secondary"
			>bin/rails service_keys:create NAME=… SCOPES=org_access_feed</code
		>.
	</p>

	{#if notice}
		<p class="mb-3 text-sm {notice.ok ? 'text-text-theme-primary' : 'text-error'}" role="status">{notice.text}</p>
	{/if}

	{#if $keysQuery.isPending}
		<p class="text-sm text-text-theme-secondary">Loading…</p>
	{:else if $keysQuery.isError}
		<p class="text-sm text-error" role="alert">Couldn’t load the keys: {$keysQuery.error.message}</p>
	{:else if keys.length === 0}
		<p class="text-sm text-text-theme-secondary">No keys yet. Nothing outside HSDL can read this data.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border-theme text-left text-xs text-text-theme-tertiary">
						<th class="py-2 pr-3 font-medium">Name</th>
						<th class="py-2 pr-3 font-medium">Key starts with</th>
						<th class="py-2 pr-3 font-medium">Can read</th>
						<th class="py-2 pr-3 font-medium">Last used</th>
						<th class="py-2 pr-3 font-medium">Status</th>
						<th class="py-2 font-medium"><span class="sr-only">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each [...active, ...revoked] as k (k.id)}
						<tr class="border-b border-border-theme align-top last:border-0 {k.revoked ? 'opacity-70' : ''}">
							<td class="py-2 pr-3">
								<span class="font-medium text-text-theme-primary">{k.name}</span>
								<span class="block text-xs text-text-theme-tertiary">
									Made {fmtDate(k.created_at)}{k.created_by ? ` by ${k.created_by.name}` : ''}
								</span>
							</td>
							<td class="py-2 pr-3 font-mono text-text-theme-secondary">{k.token_prefix}…</td>
							<td class="py-2 pr-3 text-text-theme-secondary">
								{#each k.scopes as scope}
									<span class="block" title={SCOPE_INFO[scope]?.help ?? ''}>{scopeLabel(scope)}</span>
								{:else}
									—
								{/each}
							</td>
							<td class="whitespace-nowrap py-2 pr-3 text-text-theme-secondary">
								{#if k.last_used_at}
									{relativeDays(k.last_used_at)}
									<span class="block text-xs text-text-theme-tertiary">{fmtDateTime(k.last_used_at)}</span>
								{:else}
									Never
								{/if}
							</td>
							<td class="py-2 pr-3">
								{#if k.revoked}
									<Chip title={fmtDateTime(k.revoked_at)}>Revoked {fmtDate(k.revoked_at)}</Chip>
								{:else}
									<Chip tone="success">Active</Chip>
								{/if}
							</td>
							<td class="py-2 text-right">
								{#if !k.revoked}
									<button
										class="btn btn-outline text-xs disabled:opacity-50"
										disabled={busyId === k.id}
										title="Stop {k.name} from reading: {readers(k)}"
										onclick={() => revoke(k)}>{busyId === k.id ? 'Revoking…' : 'Revoke'}</button
									>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
