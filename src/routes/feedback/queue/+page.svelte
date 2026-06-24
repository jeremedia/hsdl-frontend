<script lang="ts">
	// Developer work-queue board (/ink/feedback/queue). Kanban: one column per
	// developer, each holding ordered WorkGroup cards of ordered issues; an inbox
	// lane spans the bottom to drag from. The horizontal scheduling axis on top of
	// each issue's lifecycle — see Api::Ink::V1::WorkGroupsController.
	//
	// DnD is NATIVE HTML5 (draggable + dragover/drop), NOT svelte-dnd-action: that
	// library throws "subscribe is not a function" at flush time on Svelte 5.15 in
	// this codebase (see BrowseTree.svelte). ▲▼ buttons are a guaranteed-correct
	// ordering fallback regardless of drag.
	//
	// State is plain runes ($state) + direct inkApi calls (no TanStack Query): the
	// board's model is mutate-then-replace-from-server (move_issue returns the full
	// recomputed board — the server is the source of truth for sibling positions),
	// which doesn't benefit from query caching and sidesteps the TanStack+runes
	// friction noted in CLAUDE.md.
	import { onMount } from 'svelte';
	import {
		inkApi,
		type WorkGroupBoard,
		type WorkGroup,
		type WorkGroupMember
	} from '$lib/services/ink-api';
	import { Anchor, Ship, Trash2, ArrowUp, ArrowDown, Plus, Inbox as InboxIcon } from 'lucide-svelte';

	const INBOX = '__inbox__';

	let board = $state<WorkGroupBoard | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let busy = $state(false);

	// Drag state
	let dragIssueId = $state<string | null>(null);
	let dropHint = $state<{ zone: string; beforeIssueId: string | null } | null>(null);

	// Per-group inline UI state (keyed by group full_id)
	let newGroupName = $state<Record<string, string>>({}); // keyed by assignee
	let shipVersion = $state<Record<string, string>>({}); // keyed by group full_id
	let shippingId = $state<string | null>(null); // group whose ship input is open
	let confirmDeleteId = $state<string | null>(null);
	let shipNotice = $state<{ name: string; version: string; notReady: ShipNotReady[] } | null>(null);

	type ShipNotReady = { id: string; short_id: string; status: string; title: string };

	let columns = $derived(
		board
			? board.filters.assignees.map((assignee) => ({
					assignee,
					groups: board!.groups.filter((g) => g.assignee === assignee)
				}))
			: []
	);

	onMount(reload);

	async function reload() {
		try {
			error = null;
			board = await inkApi.getWorkGroupBoard();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load the board';
		} finally {
			loading = false;
		}
	}

	async function withBusy<T>(fn: () => Promise<T>): Promise<T | undefined> {
		if (busy) return;
		busy = true;
		try {
			return await fn();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Action failed';
		} finally {
			busy = false;
		}
	}

	// ── Drag ────────────────────────────────────────────────────────────
	function onDragStart(issueId: string) {
		dragIssueId = issueId;
	}
	function onDragEnd() {
		dragIssueId = null;
		dropHint = null;
	}
	function overCard(e: DragEvent, zone: string, beforeIssueId: string) {
		if (!dragIssueId) return;
		e.preventDefault();
		e.stopPropagation();
		dropHint = { zone, beforeIssueId };
	}
	function overZone(e: DragEvent, zone: string) {
		if (!dragIssueId) return;
		e.preventDefault();
		dropHint = { zone, beforeIssueId: null };
	}
	async function dropOn(e: DragEvent, zone: string, beforeIssue: WorkGroupMember | null) {
		e.preventDefault();
		e.stopPropagation();
		const issueId = dragIssueId;
		dropHint = null;
		dragIssueId = null;
		if (!issueId) return;

		if (zone === INBOX) {
			await withBusy(async () => {
				board = await inkApi.moveIssue(issueId, null);
			});
			return;
		}
		// Insert before a specific card → take its slot; else append.
		const position = beforeIssue ? beforeIssue.position : undefined;
		await withBusy(async () => {
			board = await inkApi.moveIssue(issueId, zone, position);
		});
	}

	// ── Buttons (guaranteed-correct fallback) ───────────────────────────
	async function nudgeIssue(group: WorkGroup, issue: WorkGroupMember, delta: number) {
		await withBusy(async () => {
			board = await inkApi.moveIssue(issue.full_id, group.full_id, issue.position + delta);
		});
	}
	async function toInbox(issue: WorkGroupMember) {
		await withBusy(async () => {
			board = await inkApi.moveIssue(issue.full_id, null);
		});
	}
	async function nudgeGroup(group: WorkGroup, delta: number) {
		await withBusy(async () => {
			await inkApi.updateWorkGroup(group.full_id, { position: group.position + delta });
			await reload();
		});
	}
	async function createGroup(assignee: string) {
		const name = (newGroupName[assignee] || '').trim();
		if (!name) return;
		await withBusy(async () => {
			await inkApi.createWorkGroup(name, assignee);
			newGroupName[assignee] = '';
			await reload();
		});
	}
	async function ship(group: WorkGroup) {
		const version = (shipVersion[group.full_id] || '').trim();
		if (!version) return;
		await withBusy(async () => {
			const res = await inkApi.shipWorkGroup(group.full_id, version);
			shippingId = null;
			shipVersion[group.full_id] = '';
			shipNotice = { name: group.name, version, notReady: res.not_deploy_ready || [] };
			await reload();
		});
	}
	async function destroyGroup(group: WorkGroup) {
		await withBusy(async () => {
			await inkApi.deleteWorkGroup(group.full_id);
			confirmDeleteId = null;
			await reload();
		});
	}

	function priorityDot(p: string): string {
		return (
			{
				critical: 'bg-red-500',
				high: 'bg-amber-500',
				normal: 'bg-slate-400',
				low: 'bg-slate-300',
				none: 'bg-slate-200'
			}[p] || 'bg-slate-400'
		);
	}
	function statusBadge(s: string): string {
		return (
			{
				deploy_ready: 'text-emerald-600',
				dev_review: 'text-indigo-600',
				resolved: 'text-slate-400'
			}[s] || 'text-text-theme-tertiary'
		);
	}
</script>

<svelte:head><title>Work Queue · INK</title></svelte:head>

<div class="p-4 sm:p-6 max-w-[1600px] mx-auto">
	<header class="mb-4 flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold text-text-theme-primary flex items-center gap-2">
				<Anchor class="w-5 h-5 text-chds-blue" /> Work Queue
			</h1>
			<p class="text-sm text-text-theme-secondary mt-0.5">
				Order issues into shippable per-developer groups. Drag cards between columns and the inbox,
				or use the ▲▼ buttons.
			</p>
		</div>
		<button
			class="text-sm px-3 py-1.5 rounded border border-default text-text-theme-secondary hover:bg-surface-secondary disabled:opacity-50"
			onclick={reload}
			disabled={busy}>Refresh</button
		>
	</header>

	{#if shipNotice}
		<div class="mb-4 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
			<div class="flex items-center justify-between">
				<strong class="text-amber-800 dark:text-amber-300"
					>Shipped “{shipNotice.name}” as {shipNotice.version}</strong
				>
				<button class="text-amber-700 hover:underline" onclick={() => (shipNotice = null)}
					>dismiss</button
				>
			</div>
			{#if shipNotice.notReady.length}
				<p class="mt-1 text-amber-800 dark:text-amber-300">
					⚠️ {shipNotice.notReady.length} member(s) not deploy_ready — they will NOT auto-resolve on
					deploy. Bring them to deploy_ready (bin/issues approve) or resolve before the next deploy:
				</p>
				<ul class="mt-1 list-disc list-inside text-amber-700 dark:text-amber-400">
					{#each shipNotice.notReady as m}
						<li><code>{m.short_id}</code> ({m.status}) — {m.title}</li>
					{/each}
				</ul>
			{:else}
				<p class="mt-1 text-amber-800 dark:text-amber-300">All members are deploy_ready. ✅</p>
			{/if}
		</div>
	{/if}

	{#if loading}
		<p class="text-text-theme-secondary">Loading the board…</p>
	{:else if error}
		<div class="rounded border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700">
			{error}
			<button class="ml-2 underline" onclick={reload}>retry</button>
		</div>
	{:else if board}
		<!-- Columns: one per developer -->
		<div class="grid gap-4 items-start" style="grid-template-columns: repeat({columns.length}, minmax(260px, 1fr));">
			{#each columns as col (col.assignee)}
				<section class="bg-surface-secondary rounded-lg p-3">
					<h2 class="text-sm font-semibold text-text-theme-primary capitalize mb-2 flex items-center justify-between">
						<span>{col.assignee}</span>
						<span class="text-xs font-normal text-text-theme-tertiary">{col.groups.length} group{col.groups.length === 1 ? '' : 's'}</span>
					</h2>

					{#each col.groups as group, gi (group.full_id)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="mb-3 rounded-md border border-default bg-surface-elevated {dropHint?.zone === group.full_id ? 'ring-2 ring-chds-blue' : ''}"
							ondragover={(e) => overZone(e, group.full_id)}
							ondrop={(e) => dropOn(e, group.full_id, null)}
						>
							<div class="px-2.5 py-1.5 border-b border-default flex items-center justify-between gap-1">
								<div class="min-w-0">
									<div class="text-sm font-medium text-text-theme-primary truncate">{group.name}</div>
									<div class="text-[11px] text-text-theme-tertiary">
										{group.member_count} issue{group.member_count === 1 ? '' : 's'}
										{#if group.target_version} · <span class="text-text-theme-secondary">{group.target_version}</span>{/if}
										{#if group.status === 'shipped'} · <span class="text-emerald-600">shipped</span>{/if}
									</div>
								</div>
								<div class="flex items-center gap-0.5 flex-shrink-0">
									<button class="p-1 rounded hover:bg-surface-secondary disabled:opacity-30" title="Move group up" onclick={() => nudgeGroup(group, -1)} disabled={busy || gi === 0}><ArrowUp class="w-3.5 h-3.5" /></button>
									<button class="p-1 rounded hover:bg-surface-secondary disabled:opacity-30" title="Move group down" onclick={() => nudgeGroup(group, 1)} disabled={busy || gi === col.groups.length - 1}><ArrowDown class="w-3.5 h-3.5" /></button>
									<button class="p-1 rounded hover:bg-surface-secondary text-chds-blue" title="Ship this group" onclick={() => (shippingId = shippingId === group.full_id ? null : group.full_id)} disabled={busy}><Ship class="w-3.5 h-3.5" /></button>
									{#if confirmDeleteId === group.full_id}
										<button class="px-1.5 py-0.5 text-[11px] rounded bg-red-600 text-white" onclick={() => destroyGroup(group)} disabled={busy}>delete?</button>
									{:else}
										<button class="p-1 rounded hover:bg-surface-secondary text-text-theme-tertiary hover:text-red-600" title="Delete group (issues return to the inbox)" onclick={() => (confirmDeleteId = group.full_id)} disabled={busy}><Trash2 class="w-3.5 h-3.5" /></button>
									{/if}
								</div>
							</div>

							{#if shippingId === group.full_id}
								<div class="px-2.5 py-1.5 border-b border-default flex items-center gap-1.5">
									<input
										class="flex-1 text-xs px-2 py-1 rounded border border-default bg-surface text-text-theme-primary"
										placeholder="version, e.g. v1.52.0"
										bind:value={shipVersion[group.full_id]}
										onkeydown={(e) => e.key === 'Enter' && ship(group)}
									/>
									<button class="text-xs px-2 py-1 rounded bg-chds-blue text-white disabled:opacity-50" onclick={() => ship(group)} disabled={busy}>Ship</button>
								</div>
							{/if}

							<ul class="p-1.5 space-y-1 min-h-[2.5rem]">
								{#each group.issues || [] as issue, ii (issue.full_id)}
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<li
										class="group/card rounded border border-default bg-surface px-2 py-1.5 cursor-grab {dropHint?.zone === group.full_id && dropHint?.beforeIssueId === issue.full_id ? 'border-t-2 border-t-chds-blue' : ''} {dragIssueId === issue.full_id ? 'opacity-40' : ''}"
										draggable={true}
										ondragstart={() => onDragStart(issue.full_id)}
										ondragend={onDragEnd}
										ondragover={(e) => overCard(e, group.full_id, issue.full_id)}
										ondrop={(e) => dropOn(e, group.full_id, issue)}
									>
										<div class="flex items-start gap-1.5">
											<span class="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 {priorityDot(issue.priority)}" title={issue.priority}></span>
											<div class="min-w-0 flex-1">
												<div class="text-xs text-text-theme-primary leading-snug line-clamp-2">{issue.title}</div>
												<div class="text-[10px] text-text-theme-tertiary mt-0.5">
													<code>{issue.id}</code> · <span class={statusBadge(issue.status)}>{issue.status}</span>{#if issue.subproject} · {issue.subproject}{/if}
												</div>
											</div>
											<div class="flex flex-col gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity flex-shrink-0">
												<button class="p-0.5 rounded hover:bg-surface-secondary disabled:opacity-30" title="Up" onclick={() => nudgeIssue(group, issue, -1)} disabled={busy || ii === 0}><ArrowUp class="w-3 h-3" /></button>
												<button class="p-0.5 rounded hover:bg-surface-secondary disabled:opacity-30" title="Down" onclick={() => nudgeIssue(group, issue, 1)} disabled={busy || ii === (group.issues?.length || 0) - 1}><ArrowDown class="w-3 h-3" /></button>
												<button class="p-0.5 rounded hover:bg-surface-secondary text-text-theme-tertiary hover:text-text-theme-primary" title="Return to inbox" onclick={() => toInbox(issue)} disabled={busy}><InboxIcon class="w-3 h-3" /></button>
											</div>
										</div>
									</li>
								{/each}
								{#if !(group.issues || []).length}
									<li class="text-[11px] text-text-theme-tertiary italic px-1 py-1.5">Drop an issue here</li>
								{/if}
							</ul>
						</div>
					{/each}

					<!-- New group in this column -->
					<div class="flex items-center gap-1.5 mt-1">
						<input
							class="flex-1 text-xs px-2 py-1 rounded border border-default bg-surface text-text-theme-primary placeholder:text-text-theme-tertiary"
							placeholder="+ new group"
							bind:value={newGroupName[col.assignee]}
							onkeydown={(e) => e.key === 'Enter' && createGroup(col.assignee)}
						/>
						<button class="p-1 rounded text-chds-blue hover:bg-surface-secondary disabled:opacity-40" title="Create group" onclick={() => createGroup(col.assignee)} disabled={busy || !(newGroupName[col.assignee] || '').trim()}><Plus class="w-4 h-4" /></button>
					</div>
				</section>
			{/each}
		</div>

		<!-- Inbox lane -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<section
			class="mt-4 bg-surface-secondary rounded-lg p-3 {dropHint?.zone === INBOX ? 'ring-2 ring-chds-blue' : ''}"
			ondragover={(e) => overZone(e, INBOX)}
			ondrop={(e) => dropOn(e, INBOX, null)}
		>
			<h2 class="text-sm font-semibold text-text-theme-primary mb-2 flex items-center gap-2">
				<InboxIcon class="w-4 h-4 text-text-theme-secondary" /> Inbox
				<span class="text-xs font-normal text-text-theme-tertiary">
					{board.inbox.shown} of {board.inbox.total} ungrouped · priority-ordered · drag up into a group
				</span>
			</h2>
			<div class="flex flex-wrap gap-1.5">
				{#each board.inbox.issues as issue (issue.full_id)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="rounded border border-default bg-surface px-2 py-1 cursor-grab max-w-[280px] {dragIssueId === issue.full_id ? 'opacity-40' : ''}"
						draggable={true}
						ondragstart={() => onDragStart(issue.full_id)}
						ondragend={onDragEnd}
					>
						<div class="flex items-center gap-1.5">
							<span class="w-1.5 h-1.5 rounded-full flex-shrink-0 {priorityDot(issue.priority)}" title={issue.priority}></span>
							<span class="text-xs text-text-theme-primary truncate">{issue.title}</span>
							<code class="text-[10px] text-text-theme-tertiary flex-shrink-0">{issue.id}</code>
						</div>
					</div>
				{/each}
				{#if !board.inbox.issues.length}
					<p class="text-xs text-text-theme-tertiary italic">Inbox is empty.</p>
				{/if}
			</div>
		</section>
	{/if}
</div>
