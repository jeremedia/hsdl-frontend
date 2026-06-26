<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { inkApi, type AdminUserRow } from '$lib/services/ink-api';
	import { ShieldCheck, Shield, AlertCircle } from 'lucide-svelte';

	const queryClient = useQueryClient();

	const usersQuery = createQuery({
		queryKey: ['ink-users'],
		queryFn: () => inkApi.getUsers()
	});

	let filter = $state('');
	let editingId = $state<string | null>(null);
	let editValue = $state('');
	let rowError = $state<{ id: string; message: string } | null>(null);
	let busyId = $state<string | null>(null);

	let rows = $derived.by(() => {
		const data = $usersQuery.data?.users ?? [];
		const f = filter.trim().toLowerCase();
		if (!f) return data;
		return data.filter(
			(u) =>
				(u.name ?? '').toLowerCase().includes(f) || u.email.toLowerCase().includes(f)
		);
	});

	let reporters = $derived($usersQuery.data?.reporters ?? []);

	function startEdit(u: AdminUserRow) {
		editingId = u.id;
		editValue = u.slack_user_id ?? '';
		rowError = null;
	}

	function cancelEdit() {
		editingId = null;
		editValue = '';
		rowError = null;
	}

	async function saveSlackId(u: AdminUserRow) {
		busyId = u.id;
		rowError = null;
		try {
			await inkApi.updateUserSlackId(u.id, editValue.trim());
			editingId = null;
			await queryClient.invalidateQueries({ queryKey: ['ink-users'] });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Update failed';
			rowError = { id: u.id, message: msg };
		} finally {
			busyId = null;
		}
	}

	async function toggleAdmin(u: AdminUserRow) {
		const granting = !u.admin_granted;
		const verb = granting ? 'grant admin to' : 'revoke admin from';
		if (!confirm(`Are you sure you want to ${verb} ${u.name ?? u.email}?`)) return;
		busyId = u.id;
		rowError = null;
		try {
			if (granting) await inkApi.grantAdmin(u.id);
			else await inkApi.revokeAdmin(u.id);
			await queryClient.invalidateQueries({ queryKey: ['ink-users'] });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Action failed';
			rowError = { id: u.id, message: msg };
		} finally {
			busyId = null;
		}
	}

	function canToggleGrant(u: AdminUserRow): boolean {
		if (u.admin_granted) return true;
		return true;
	}

	function adminBadge(u: AdminUserRow): string {
		if (!u.admin) return 'No';
		return u.admin_sources.join(', ');
	}
</script>

<div class="p-6 max-w-6xl mx-auto">
	<header class="mb-4">
		<h1 class="text-2xl font-semibold text-text-theme-primary">Users</h1>
		<p class="text-text-theme-secondary text-sm">
			Link accounts to their Slack reporter identity and manage admin access.
		</p>
	</header>

	<input
		type="text"
		placeholder="Filter by name or email…"
		bind:value={filter}
		class="mb-4 w-full max-w-sm rounded-md border border-border-theme bg-surface-elevated px-3 py-2 text-sm text-text-theme-primary"
	/>

	{#if $usersQuery.isPending}
		<p class="text-text-theme-secondary">Loading users…</p>
	{:else if $usersQuery.isError}
		<p class="text-red-600 flex items-center gap-2">
			<AlertCircle class="w-4 h-4" /> Failed to load users.
		</p>
	{:else}
		<div class="overflow-x-auto rounded-lg border border-border-theme">
			<table class="w-full text-sm">
				<thead class="bg-surface-secondary text-text-theme-secondary text-left">
					<tr>
						<th class="px-3 py-2 font-medium">Name / Email</th>
						<th class="px-3 py-2 font-medium">Role</th>
						<th class="px-3 py-2 font-medium">Admin</th>
						<th class="px-3 py-2 font-medium">Slack ID</th>
						<th class="px-3 py-2 font-medium">Reporter</th>
						<th class="px-3 py-2 font-medium">Joined</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as u (u.id)}
						<tr class="border-t border-border-theme align-top">
							<td class="px-3 py-2">
								<div class="font-medium text-text-theme-primary">{u.name ?? '—'}</div>
								<div class="text-text-theme-tertiary text-xs">{u.email}</div>
							</td>
							<td class="px-3 py-2">
								<span
									class="inline-block rounded px-1.5 py-0.5 text-xs bg-surface-secondary text-text-theme-secondary"
									title="Set by CHDS Pulse, overwritten each login"
								>
									{u.chds_role ?? '—'}
								</span>
							</td>
							<td class="px-3 py-2">
								<div class="flex items-center gap-2">
									{#if u.admin}
										<ShieldCheck class="w-4 h-4 text-green-600" />
									{:else}
										<Shield class="w-4 h-4 text-text-theme-tertiary" />
									{/if}
									<span class="text-xs text-text-theme-secondary">{adminBadge(u)}</span>
									<button
										class="ml-1 text-xs underline text-interactive disabled:opacity-40"
										disabled={busyId === u.id || !canToggleGrant(u)}
										onclick={() => toggleAdmin(u)}
									>
										{u.admin_granted ? 'Revoke grant' : 'Grant'}
									</button>
								</div>
								{#if u.admin_granted && u.admin_granted_by}
									<div class="text-[11px] text-text-theme-tertiary mt-0.5">
										granted by {u.admin_granted_by}
									</div>
								{/if}
							</td>
							<td class="px-3 py-2">
								{#if editingId === u.id}
									<input
										type="text"
										list="reporter-suggestions"
										bind:value={editValue}
										placeholder="U…"
										class="w-36 rounded border border-border-theme bg-surface px-2 py-1 text-xs"
									/>
									<div class="mt-1 flex gap-2">
										<button
											class="text-xs text-interactive underline disabled:opacity-40"
											disabled={busyId === u.id}
											onclick={() => saveSlackId(u)}>Save</button
										>
										<button class="text-xs text-text-theme-tertiary underline" onclick={cancelEdit}
											>Cancel</button
										>
									</div>
								{:else}
									<button class="text-left" onclick={() => startEdit(u)}>
										<span class="font-mono text-xs text-text-theme-primary"
											>{u.slack_user_id ?? '— link —'}</span
										>
									</button>
								{/if}
								{#if rowError && rowError.id === u.id}
									<div class="mt-1 text-[11px] text-red-600">{rowError.message}</div>
								{/if}
							</td>
							<td class="px-3 py-2 text-xs text-text-theme-secondary">
								{#if u.reporter.slack_user_id}
									{u.reporter.issues_filed} filed
									{#if u.reporter.verify_pending > 0}
										· <span class="text-amber-600 font-medium"
											>{u.reporter.verify_pending} pending</span
										>
									{/if}
								{:else}
									—
								{/if}
							</td>
							<td class="px-3 py-2 text-xs text-text-theme-tertiary">
								{new Date(u.created_at).toLocaleDateString()}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<datalist id="reporter-suggestions">
			{#each reporters as r}
				<option value={r.slack_user_id}>{r.name} — {r.slack_user_id} · {r.pending} pending</option>
			{/each}
		</datalist>
	{/if}
</div>
