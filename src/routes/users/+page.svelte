<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { inkApi, type AdminUserRow, type SlackIdLookupResult } from '$lib/services/ink-api';
	import { ShieldCheck, Shield, AlertCircle, Search } from 'lucide-svelte';

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
	let lookupRunning = $state(false);
	let lookupResult = $state<SlackIdLookupResult | null>(null);
	let lookupError = $state<string | null>(null);

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

	const ADMIN_SOURCE_LABELS: Record<string, string> = {
		pulse_role: 'Pulse role',
		email_allowlist: 'Email allowlist',
		granted: 'Granted'
	};

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

	function adminBadge(u: AdminUserRow): string {
		if (!u.admin) return 'No';
		return u.admin_sources.map((s) => ADMIN_SOURCE_LABELS[s] ?? s).join(', ');
	}

	async function lookupMissing() {
		lookupRunning = true;
		lookupResult = null;
		lookupError = null;
		try {
			lookupResult = await inkApi.lookupSlackIds();
			await queryClient.invalidateQueries({ queryKey: ['ink-users'] });
		} catch (err: unknown) {
			lookupError = err instanceof Error ? err.message : 'Lookup failed';
		} finally {
			lookupRunning = false;
		}
	}
</script>

<div class="p-6 max-w-6xl mx-auto">
	<header class="mb-4">
		<h1 class="text-2xl font-semibold text-text-theme-primary">Users</h1>
		<p class="text-text-theme-secondary text-sm">
			Link accounts to their Slack reporter identity and manage admin access.
		</p>
	</header>

	<div class="mb-4 flex flex-wrap items-center gap-3">
		<input
			type="text"
			placeholder="Filter by name or email…"
			aria-label="Filter users by name or email"
			bind:value={filter}
			class="w-full max-w-sm rounded-md border border-border-theme bg-surface-elevated px-3 py-2 text-sm text-text-theme-primary"
		/>
		<button
			class="inline-flex items-center gap-1.5 rounded-md border border-border-theme bg-surface-elevated px-3 py-2 text-sm text-interactive disabled:opacity-40"
			disabled={lookupRunning}
			title="For every account without a Slack ID, ask Slack for the account behind its email"
			onclick={lookupMissing}
		>
			<Search class="h-4 w-4" />
			{lookupRunning ? 'Looking up…' : 'Look up missing IDs via Slack'}
		</button>
	</div>

	{#if lookupError}
		<p class="mb-3 flex items-center gap-2 text-sm text-red-600">
			<AlertCircle class="h-4 w-4" />
			{lookupError}
		</p>
	{:else if lookupResult}
		<div class="mb-3 rounded-md border border-border-theme bg-surface-secondary px-3 py-2 text-xs text-text-theme-secondary">
			<span class="font-medium text-text-theme-primary">
				Linked {lookupResult.linked.length}{lookupResult.linked.length > 0
					? `: ${lookupResult.linked.map((l) => l.email).join(', ')}`
					: ''}
			</span>
			{#if lookupResult.not_found.length > 0}
				· no Slack account for {lookupResult.not_found.join(', ')}
			{/if}
			{#each lookupResult.errors as e (e.email)}
				<div class="mt-0.5 text-red-600">{e.email}: {e.error}</div>
			{/each}
		</div>
	{/if}

	{#if $usersQuery.isPending}
		<p class="text-text-theme-secondary">Loading users…</p>
	{:else if $usersQuery.isError}
		<p class="text-red-600 flex items-center gap-2">
			<AlertCircle class="w-4 h-4" /> Failed to load users.
		</p>
	{:else}
		<div class="overflow-x-auto rounded-lg border border-border-theme bg-surface-elevated">
			<table class="w-full text-sm">
				<thead class="bg-surface-secondary text-text-theme-secondary text-left">
					<tr>
						<th scope="col" class="px-3 py-2 font-medium">Name / Email</th>
						<th scope="col" class="px-3 py-2 font-medium">Pulse role</th>
						<th scope="col" class="px-3 py-2 font-medium">Admin</th>
						<th scope="col" class="px-3 py-2 font-medium">Slack ID</th>
						<th scope="col" class="px-3 py-2 font-medium">Reporter</th>
						<th scope="col" class="px-3 py-2 font-medium">Joined</th>
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
										disabled={busyId === u.id}
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
										aria-label="Slack user ID"
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
									<button class="text-left" aria-label="Edit Slack ID" onclick={() => startEdit(u)}>
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
					{:else}
						<tr><td colspan="6" class="px-3 py-6 text-center text-text-theme-tertiary">No users match.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>

		<datalist id="reporter-suggestions">
			{#each reporters as r (r.slack_user_id)}
				<option value={r.slack_user_id}>{r.name} — {r.slack_user_id} · {r.pending} pending</option>
			{/each}
		</datalist>
	{/if}

	<details class="mt-6 rounded-lg border border-border-theme bg-surface-secondary text-sm">
		<summary class="cursor-pointer select-none px-4 py-3 font-medium text-text-theme-primary">
			About this page
		</summary>
		<div class="space-y-4 border-t border-border-theme px-4 py-4 text-text-theme-secondary">
			<section>
				<h2 class="mb-1 font-semibold text-text-theme-primary">What this is</h2>
				<p>
					The admin-only user panel for INK. It lists every account that has signed into
					INK/HSDL and lets admins manage two things per account: which <strong>Slack reporter
					identity</strong> it's linked to, and whether it has <strong>admin access</strong>.
				</p>
			</section>
			<section>
				<h2 class="mb-1 font-semibold text-text-theme-primary">Why it's needed</h2>
				<ul class="list-disc space-y-1 pl-5">
					<li>
						<strong>Reporter linkage.</strong> The feedback verification queue
						(<span class="font-mono text-xs">/ink/feedback/verify</span>) scopes a person's
						issues to their Slack id. If an account isn't linked, a librarian who reported
						issues sees an empty verify queue even when fixes are waiting for their sign-off.
						This page links them without a console.
					</li>
					<li>
						<strong>Admin grants.</strong> Admin access used to require a code/env change plus
						a server restart. Here an admin grants or revokes it at runtime.
					</li>
				</ul>
			</section>
			<section>
				<h2 class="mb-1 font-semibold text-text-theme-primary">Columns</h2>
				<ul class="list-disc space-y-1 pl-5">
					<li><strong>Name / Email</strong> — the account.</li>
					<li>
						<strong>Pulse role</strong> — the role assigned by CHDS Pulse (the login provider).
						Read-only here: Pulse overwrites it on every login, so it can't be edited in INK.
					</li>
					<li>
						<strong>Admin</strong> — whether the account is an admin, and <em>why</em>. Sources:
						<em>Pulse role</em> (Pulse marked them admin), <em>Email allowlist</em> (on the
						built-in admin email list — a permanent floor that can't be locked out), and
						<em>Granted</em> (granted here). The Grant / Revoke button toggles only the
						<em>Granted</em> source; an account can be admin via more than one at once.
					</li>
					<li>
						<strong>Slack ID</strong> — the Slack identity this account's reported issues are
						filed under. Click to edit; the dropdown suggests known reporters. It must be
						unique — linking an id already held by another account is blocked.
					</li>
					<li>
						<strong>Reporter</strong> — how many issues this account has filed (via its linked
						Slack id) and how many fixes are live awaiting their verify sign-off.
					</li>
					<li><strong>Joined</strong> — when the account was created.</li>
				</ul>
			</section>
			<section>
				<h2 class="mb-1 font-semibold text-text-theme-primary">
					What an admin can do here (non-admins can't)
				</h2>
				<ul class="list-disc space-y-1 pl-5">
					<li>
						Reach this page at all — it's admin-only (no nav entry for non-admins; the API
						returns 403).
					</li>
					<li>Edit any account's Slack-ID linkage.</li>
					<li>
						Run <em>Look up missing IDs via Slack</em> — for every unlinked account, asks Slack
						for the account behind its email and links what it finds.
					</li>
					<li>
						Grant or revoke the durable admin flag. You can't revoke your own admin (no
						self-lockout).
					</li>
				</ul>
			</section>
			<section>
				<h2 class="mb-1 font-semibold text-text-theme-primary">Good to know</h2>
				<ul class="list-disc space-y-1 pl-5">
					<li>
						A Pulse role of <em>viewer</em> alongside Admin <em>Granted</em> is normal — admin
						is separate from the Pulse role and never changes it.
					</li>
					<li>
						Granting admin to someone already admin via Pulse/email pins it durably (it survives
						a future Pulse role change) — harmless if otherwise redundant.
					</li>
					<li>
						New accounts get one automatic email→Slack lookup at creation, so most users
						self-link; the button above is the backstop for anyone that missed.
					</li>
				</ul>
			</section>
		</div>
	</details>
</div>
