<script lang="ts">
	// Triage workbench (/ink/feedback/queue). Master-detail screen for the developer
	// queue: a sortable/filterable INBOX list (left) → a full-detail VIEWER (center)
	// → a QUEUE RAIL (right) of dev-grouped WorkGroup bins.
	//
	// One unified issue item (the `issueRow` snippet) is used in BOTH the inbox and
	// inside group bins: everywhere clickable (→ viewer) and draggable. The drag graph
	// is complete and symmetric:
	//   inbox → group · group → group · group → inbox · viewer → group · → new group
	// Within a group: drag-to-reorder (drop onto a member = insert before it) AND ▲▼.
	//
	// DnD is NATIVE HTML5 (svelte-dnd-action crashes at flush on Svelte 5.15 — see
	// BrowseTree.svelte). State is plain runes + direct inkApi: mutate → replace the
	// board from the server (source of truth for positions), then reload the inbox.
	import { onMount } from 'svelte';
	import {
		inkApi,
		type WorkGroupBoard,
		type WorkGroup,
		type WorkGroupMember,
		type FeedbackIssue,
		type FeedbackIssueExpanded,
		type FeedbackIssueListResponse
	} from '$lib/services/ink-api';
	import ColumnResizer from '$lib/components/ink/ColumnResizer.svelte';
	import {
		Inbox as InboxIcon,
		Search,
		Ship,
		Trash2,
		ArrowUp,
		ArrowDown,
		Plus,
		ChevronDown,
		ChevronRight,
		ExternalLink,
		GripVertical,
		Pencil,
		Check,
		Pause,
		Play
	} from 'lucide-svelte';

	const SUBPROJECTS = ['frontend', 'ink', 'rails'];
	const INBOX = '__inbox__';
	const SORTS: Record<string, { sort: string; direction: 'asc' | 'desc'; label: string }> = {
		priority: { sort: 'priority', direction: 'asc', label: 'Priority (high→low)' },
		newest: { sort: 'created_at', direction: 'desc', label: 'Newest' },
		oldest: { sort: 'created_at', direction: 'asc', label: 'Oldest' },
		category: { sort: 'category', direction: 'asc', label: 'Category' },
		status: { sort: 'status', direction: 'asc', label: 'Status' }
	};

	type RowCtx = { group: WorkGroup; index: number; len: number } | null;

	// ── Data ────────────────────────────────────────────────────────────
	let inboxResp = $state<FeedbackIssueListResponse | null>(null);
	let inboxLoading = $state(true);
	let board = $state<WorkGroupBoard | null>(null);
	let error = $state<string | null>(null);
	let busy = $state(false);

	// ── List controls ───────────────────────────────────────────────────
	let sortKey = $state('priority');
	let q = $state('');
	let fCategory = $state('');
	let fPriority = $state('');
	let fSubproject = $state('');
	let page = $state(1);
	let qTimer: ReturnType<typeof setTimeout> | null = null;

	// ── Viewer ──────────────────────────────────────────────────────────
	let selectedId = $state<string | null>(null);
	let viewerIssue = $state<FeedbackIssueExpanded | null>(null);
	let viewerLoading = $state(false);
	let dragProxyEl = $state<HTMLElement>();

	// ── Drag / rail ─────────────────────────────────────────────────────
	let dragIssueId = $state<string | null>(null);
	// zone: a group full_id · INBOX · ('new:' + assignee). beforeIssueId: insert-before target.
	let dropHint = $state<{ zone: string; beforeIssueId: string | null } | null>(null);
	let collapsedDev = $state<Record<string, boolean>>({});
	let expandedGroup = $state<Record<string, boolean>>({});
	let newGroupName = $state<Record<string, string>>({});
	let shipVersion = $state<Record<string, string>>({});
	let shippingId = $state<string | null>(null);
	let confirmDeleteId = $state<string | null>(null);
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');
	type ShipNotReady = { id: string; short_id: string; status: string; title: string };
	let shipNotice = $state<{ name: string; version: string; notReady: ShipNotReady[] } | null>(null);

	let devColumns = $derived(
		board ? board.filters.assignees.map((a) => ({ assignee: a, groups: board!.groups.filter((g) => g.assignee === a) })) : []
	);
	let results = $derived(inboxResp?.results ?? []);

	onMount(() => {
		loadInbox();
		loadBoard();
	});

	async function loadBoard() {
		try {
			board = await inkApi.getWorkGroupBoard();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load the board';
		}
	}
	async function loadInbox() {
		inboxLoading = true;
		try {
			error = null;
			const s = SORTS[sortKey];
			inboxResp = await inkApi.getFeedbackList({
				inbox: true,
				sort: s.sort,
				direction: s.direction,
				category: fCategory || undefined,
				priority: fPriority || undefined,
				subproject: fSubproject || undefined,
				q: q.trim() || undefined,
				page,
				per_page: 100
			});
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load the inbox';
		} finally {
			inboxLoading = false;
		}
	}
	function onControlChange() {
		page = 1;
		loadInbox();
	}
	function onSearchInput() {
		if (qTimer) clearTimeout(qTimer);
		qTimer = setTimeout(() => {
			page = 1;
			loadInbox();
		}, 300);
	}
	function clearFilters() {
		q = fCategory = fPriority = fSubproject = '';
		sortKey = 'priority';
		page = 1;
		loadInbox();
	}

	async function select(issue: { full_id: string }) {
		selectedId = issue.full_id;
		viewerLoading = true;
		try {
			viewerIssue = await inkApi.getFeedbackIssue(issue.full_id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load the issue';
		} finally {
			viewerLoading = false;
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

	// ── Drag sources ────────────────────────────────────────────────────
	function startDrag(fullId: string, e: DragEvent, fromViewer = false) {
		dragIssueId = fullId;
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
		// R1: dragging the viewer uses the compact list-row look as the drag proxy.
		if (fromViewer && dragProxyEl && e.dataTransfer) e.dataTransfer.setDragImage(dragProxyEl, 12, 12);
	}
	function onDragEnd() {
		dragIssueId = null;
		dropHint = null;
	}
	function overZone(e: DragEvent, zone: string, beforeIssueId: string | null = null) {
		if (!dragIssueId) return;
		e.preventDefault();
		e.stopPropagation();
		dropHint = { zone, beforeIssueId };
	}

	// ── Drop targets (all read dragIssueId, then refresh board + inbox) ──
	async function dropToGroup(e: DragEvent, group: WorkGroup, beforeIssue: WorkGroupMember | null = null) {
		e.preventDefault();
		e.stopPropagation();
		const id = dragIssueId;
		dropHint = null;
		dragIssueId = null;
		if (!id) return;
		await withBusy(async () => {
			board = await inkApi.moveIssue(id, group.full_id, beforeIssue ? beforeIssue.position : undefined);
			await loadInbox();
		});
	}
	async function dropToInbox(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		const id = dragIssueId;
		dropHint = null;
		dragIssueId = null;
		if (!id) return;
		await withBusy(async () => {
			board = await inkApi.moveIssue(id, null);
			await loadInbox();
			if (selectedId === id) viewerIssue = await inkApi.getFeedbackIssue(id); // status/assignee may change
		});
	}
	async function dropToNewGroup(e: DragEvent, assignee: string) {
		e.preventDefault();
		e.stopPropagation();
		const id = dragIssueId;
		dropHint = null;
		dragIssueId = null;
		if (!id) return;
		await withBusy(async () => {
			const g = await inkApi.createWorkGroup('Untitled', assignee);
			board = await inkApi.moveIssue(id, g.full_id);
			await loadInbox();
			expandedGroup[g.full_id] = true;
			startRename({ full_id: g.full_id, name: g.name } as WorkGroup); // name it right away
		});
	}

	// ── Click-place (select an issue, click a bin's ＋) ──────────────────
	async function place(issueId: string, group: WorkGroup) {
		await withBusy(async () => {
			board = await inkApi.moveIssue(issueId, group.full_id);
			await loadInbox();
			if (selectedId === issueId) {
				selectedId = null;
				viewerIssue = null;
			}
		});
	}

	// ── In-group reorder (▲▼) / lifecycle ───────────────────────────────
	async function nudgeIssue(group: WorkGroup, issue: WorkGroupMember, delta: number) {
		await withBusy(async () => {
			board = await inkApi.moveIssue(issue.full_id, group.full_id, issue.position + delta);
		});
	}
	async function memberToInbox(issueFullId: string) {
		await withBusy(async () => {
			board = await inkApi.moveIssue(issueFullId, null);
			await loadInbox();
		});
	}
	async function createGroup(assignee: string) {
		const name = (newGroupName[assignee] || '').trim();
		if (!name) return;
		await withBusy(async () => {
			await inkApi.createWorkGroup(name, assignee);
			newGroupName[assignee] = '';
			await loadBoard();
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
			await loadBoard();
		});
	}
	async function destroyGroup(group: WorkGroup) {
		await withBusy(async () => {
			await inkApi.deleteWorkGroup(group.full_id);
			confirmDeleteId = null;
			await loadBoard();
			await loadInbox();
		});
	}
	// Park (set aside) / unpark a group. Parked = visible + owned + ordered but out of
	// the active work rotation (e.g. frontend groups during a design freeze).
	async function togglePark(group: WorkGroup) {
		await withBusy(async () => {
			await inkApi.updateWorkGroup(group.full_id, { status: group.status === 'parked' ? 'active' : 'parked' });
			await loadBoard();
		});
	}
	function startRename(group: { full_id: string; name: string }) {
		renamingId = group.full_id;
		renameValue = group.name === 'Untitled' ? '' : group.name;
	}
	async function commitRename(group: WorkGroup) {
		const name = renameValue.trim();
		renamingId = null;
		if (!name || name === group.name) return;
		await withBusy(async () => {
			await inkApi.updateWorkGroup(group.full_id, { name });
			await loadBoard();
		});
	}

	function priorityDot(p: string): string {
		return (
			{ critical: 'bg-red-500', high: 'bg-amber-500', normal: 'bg-slate-400', low: 'bg-slate-300', none: 'bg-slate-200' }[p] ||
			'bg-slate-400'
		);
	}
	function statusClass(s: string): string {
		return (
			{ deploy_ready: 'text-emerald-700 dark:text-emerald-300', dev_review: 'text-indigo-700 dark:text-indigo-400', in_development: 'text-sky-700 dark:text-sky-300', needs_feedback: 'text-amber-700 dark:text-amber-300', resolved: 'text-slate-500 dark:text-slate-300' }[
				s
			] || 'text-text-theme-tertiary'
		);
	}
</script>

<svelte:head><title>Triage · INK</title></svelte:head>

<!-- R3: one issue item used in the inbox AND inside group bins. Clickable (→ viewer)
     and draggable everywhere; a drop target too (drop onto it = insert-before). -->
{#snippet issueRow(issue: FeedbackIssue | WorkGroupMember, ctx: RowCtx)}
	{@const zone = ctx ? ctx.group.full_id : INBOX}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="group/row rounded border bg-surface-elevated px-2 py-1.5 cursor-pointer hover:bg-surface-secondary
			{selectedId === issue.full_id ? 'ring-1 ring-inset ring-chds-blue' : 'border-default'}
			{dragIssueId === issue.full_id ? 'opacity-40' : ''}
			{dropHint?.zone === zone && dropHint?.beforeIssueId === issue.full_id ? 'border-t-2 border-t-chds-blue' : ''}"
		draggable={true}
		ondragstart={(e) => startDrag(issue.full_id, e)}
		ondragend={onDragEnd}
		ondragover={(e) => overZone(e, zone, issue.full_id)}
		ondrop={(e) => (ctx ? dropToGroup(e, ctx.group, issue as WorkGroupMember) : dropToInbox(e))}
		onclick={() => select(issue)}
		onkeydown={(e) => { if (e.key === 'Enter') select(issue); }}
	>
		<div class="flex items-start gap-1.5">
			<span class="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 {priorityDot(issue.priority)}" title={issue.priority}></span>
			<div class="min-w-0 flex-1">
				<div class="text-xs text-text-theme-primary leading-snug line-clamp-2">{issue.title}</div>
				<div class="text-[10px] text-text-theme-tertiary mt-0.5">
					<code>{issue.id}</code> · <span class={statusClass(issue.status)}>{issue.status}</span>{#if issue.assignee} · {issue.assignee}{/if}
				</div>
			</div>
			{#if ctx}
				<div class="flex flex-col gap-0.5 opacity-0 group-hover/row:opacity-100 flex-shrink-0">
					<button class="p-0.5 rounded hover:bg-surface-secondary disabled:opacity-30" title="Up" onclick={(e) => { e.stopPropagation(); nudgeIssue(ctx.group, issue as WorkGroupMember, -1); }} disabled={busy || ctx.index === 0}><ArrowUp class="w-3 h-3" /></button>
					<button class="p-0.5 rounded hover:bg-surface-secondary disabled:opacity-30" title="Down" onclick={(e) => { e.stopPropagation(); nudgeIssue(ctx.group, issue as WorkGroupMember, 1); }} disabled={busy || ctx.index === ctx.len - 1}><ArrowDown class="w-3 h-3" /></button>
					<button class="p-0.5 rounded hover:bg-surface-secondary text-text-theme-tertiary" title="Return to inbox" onclick={(e) => { e.stopPropagation(); memberToInbox(issue.full_id); }} disabled={busy}><InboxIcon class="w-3 h-3" /></button>
				</div>
			{/if}
		</div>
	</div>
{/snippet}

<div class="flex flex-col h-full overflow-hidden">
	{#if shipNotice}
		<div class="m-2 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 text-sm">
			<div class="flex items-center justify-between">
				<strong class="text-amber-800 dark:text-amber-300">Shipped “{shipNotice.name}” as {shipNotice.version}</strong>
				<button class="text-amber-700 hover:underline" onclick={() => (shipNotice = null)}>dismiss</button>
			</div>
			{#if shipNotice.notReady.length}
				<p class="mt-1 text-amber-800 dark:text-amber-300">⚠️ {shipNotice.notReady.length} member(s) not deploy_ready — won't auto-resolve on deploy: {shipNotice.notReady.map((m) => m.short_id).join(', ')}</p>
			{:else}
				<p class="mt-1 text-amber-800 dark:text-amber-300">All members are deploy_ready. ✅</p>
			{/if}
		</div>
	{/if}
	{#if error}
		<div class="m-2 rounded border border-red-300 bg-red-50 dark:bg-red-950/30 p-2 text-sm text-red-700">
			{error}
			<button class="ml-2 underline" onclick={() => { error = null; loadInbox(); loadBoard(); }}>retry</button>
		</div>
	{/if}

	<div id="triage-shell" class="grid gap-0 flex-1 min-h-0 overflow-hidden" style="grid-template-columns: var(--list-w, 360px) 6px minmax(0, 1fr) 340px;">
		<!-- ① INBOX LIST (also a drop target → return-to-inbox) -->
		<aside class="flex flex-col min-h-0 border-r border-default bg-surface">
			<div class="p-2.5 border-b border-default space-y-2">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold text-text-theme-primary flex items-center gap-1.5">
						<InboxIcon class="w-4 h-4 text-text-theme-secondary" /> Inbox
						<span class="text-xs font-normal text-text-theme-tertiary">{inboxResp?.total_count ?? '…'} ungrouped</span>
					</h2>
					<button class="text-[11px] text-text-theme-tertiary hover:underline" onclick={clearFilters}>clear</button>
				</div>
				<div class="relative">
					<Search class="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-text-theme-tertiary" />
					<input class="w-full text-xs pl-7 pr-2 py-1.5 rounded border border-default bg-surface-secondary text-text-theme-primary" placeholder="search title / id…" bind:value={q} oninput={onSearchInput} />
				</div>
				<div class="grid grid-cols-2 gap-1.5">
					<select class="text-[11px] px-1.5 py-1 rounded border border-default bg-surface-secondary text-text-theme-primary" bind:value={sortKey} onchange={onControlChange}>
						{#each Object.entries(SORTS) as [key, s]}<option value={key}>{s.label}</option>{/each}
					</select>
					<select class="text-[11px] px-1.5 py-1 rounded border border-default bg-surface-secondary text-text-theme-primary" bind:value={fSubproject} onchange={onControlChange}>
						<option value="">all subprojects</option>
						{#each SUBPROJECTS as sp}<option value={sp}>{sp}</option>{/each}
					</select>
					<select class="text-[11px] px-1.5 py-1 rounded border border-default bg-surface-secondary text-text-theme-primary" bind:value={fPriority} onchange={onControlChange}>
						<option value="">all priorities</option>
						{#each (inboxResp?.filters.priorities ?? ['critical', 'high', 'normal', 'low']) as p}<option value={p}>{p}</option>{/each}
					</select>
					<select class="text-[11px] px-1.5 py-1 rounded border border-default bg-surface-secondary text-text-theme-primary" bind:value={fCategory} onchange={onControlChange}>
						<option value="">all categories</option>
						{#each (inboxResp?.filters.categories ?? []) as c}<option value={c}>{c}</option>{/each}
					</select>
				</div>
			</div>

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1 {dropHint?.zone === INBOX ? 'bg-chds-blue/5 ring-1 ring-inset ring-chds-blue/40' : ''}"
				ondragover={(e) => overZone(e, INBOX)}
				ondrop={dropToInbox}
			>
				{#if inboxLoading && !results.length}
					<p class="p-2 text-xs text-text-theme-tertiary">Loading…</p>
				{:else if !results.length}
					<p class="p-2 text-xs text-text-theme-tertiary italic">No matching issues in the inbox.</p>
				{:else}
					{#each results as issue (issue.full_id)}
						{@render issueRow(issue, null)}
					{/each}
				{/if}
			</div>

			{#if inboxResp && inboxResp.total_pages > 1}
				<div class="p-2 border-t border-default flex items-center justify-between text-[11px] text-text-theme-secondary">
					<button class="px-2 py-0.5 rounded border border-default disabled:opacity-40" disabled={page <= 1 || busy} onclick={() => { page--; loadInbox(); }}>‹ prev</button>
					<span>page {inboxResp.page} / {inboxResp.total_pages}</span>
					<button class="px-2 py-0.5 rounded border border-default disabled:opacity-40" disabled={page >= inboxResp.total_pages || busy} onclick={() => { page++; loadInbox(); }}>next ›</button>
				</div>
			{/if}
		</aside>

		<ColumnResizer scope="#triage-shell" varName="--list-w" storageKey="ink.triage.list-w" min={280} max={560} defaultWidth={360} />

		<!-- ② VIEWER (header is a drag source → a queue; uses the list-row drag proxy) -->
		<section class="min-h-0 overflow-y-auto bg-surface-elevated">
			{#if viewerLoading}
				<p class="p-4 text-sm text-text-theme-secondary">Loading issue…</p>
			{:else if !viewerIssue}
				<div class="h-full flex items-center justify-center text-center p-6">
					<p class="text-sm text-text-theme-tertiary">Select an issue from the inbox to read it, then drag it (or click ＋) into a queue on the right.</p>
				</div>
			{:else}
				<article class="p-4">
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="flex items-center gap-2 text-[11px] mb-1 cursor-grab"
						draggable={true}
						ondragstart={(e) => startDrag(viewerIssue!.full_id, e, true)}
						ondragend={onDragEnd}
						title="Drag into a queue"
					>
						<GripVertical class="w-3.5 h-3.5 text-text-theme-tertiary" />
						<code class="text-text-theme-tertiary">{viewerIssue.id}</code>
						<span class="px-1.5 py-0.5 rounded {priorityDot(viewerIssue.priority)} text-white uppercase tracking-wide">{viewerIssue.priority}</span>
						<span class={statusClass(viewerIssue.status)}>{viewerIssue.status}</span>
						<span class="text-text-theme-tertiary">· {viewerIssue.category}</span>
						{#if viewerIssue.assignee}<span class="text-text-theme-tertiary">· assigned: {viewerIssue.assignee}</span>{/if}
					</div>
					<h1 class="text-lg font-semibold text-text-theme-primary leading-snug">{viewerIssue.title}</h1>
					<div class="text-xs text-text-theme-tertiary mt-1">
						{#if viewerIssue.reported_by}reported by {viewerIssue.reported_by} · {/if}{viewerIssue.age_days}d old · {viewerIssue.created_at}
					</div>
					{#if viewerIssue.url_example}
						<a href={viewerIssue.url_example} target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs text-chds-blue hover:underline mt-2"><ExternalLink class="w-3 h-3" /> {viewerIssue.url_example}</a>
					{/if}
					{#if viewerIssue.description}
						<div class="mt-3 text-sm text-text-theme-primary whitespace-pre-wrap leading-relaxed">{viewerIssue.description}</div>
					{:else}
						<div class="mt-3 text-sm text-text-theme-tertiary italic">No description.</div>
					{/if}
					{#if viewerIssue.search_query}<div class="mt-2 text-xs text-text-theme-secondary">search query: <code>{viewerIssue.search_query}</code></div>{/if}
					{#if viewerIssue.notes?.length}
						<h3 class="mt-4 mb-1 text-xs font-semibold text-text-theme-secondary uppercase tracking-wide">History · {viewerIssue.notes.length}</h3>
						<ul class="space-y-1.5">
							{#each viewerIssue.notes as note}
								<li class="text-xs border-l-2 border-default pl-2">
									<div class="text-text-theme-tertiary">{note.author}{#if note.verdict} · <span class="text-indigo-600">{note.verdict}</span>{/if} · {note.timestamp}</div>
									<div class="text-text-theme-primary whitespace-pre-wrap">{note.text}</div>
								</li>
							{/each}
						</ul>
					{/if}
				</article>
			{/if}
		</section>

		<!-- ③ QUEUE RAIL -->
		<aside class="min-h-0 overflow-y-auto border-l border-default bg-surface-secondary">
			<h2 class="px-3 py-2 text-sm font-semibold text-text-theme-primary border-b border-default sticky top-0 bg-surface-secondary z-10">Queues</h2>
			{#if !board}
				<p class="p-3 text-xs text-text-theme-tertiary">Loading…</p>
			{:else}
				{#each devColumns as col (col.assignee)}
					<div class="border-b border-default">
						<button class="w-full px-3 py-1.5 flex items-center justify-between text-xs font-semibold text-text-theme-primary capitalize hover:bg-surface" onclick={() => (collapsedDev[col.assignee] = !collapsedDev[col.assignee])}>
							<span class="flex items-center gap-1">{#if collapsedDev[col.assignee]}<ChevronRight class="w-3.5 h-3.5" />{:else}<ChevronDown class="w-3.5 h-3.5" />{/if}{col.assignee}</span>
							<span class="text-[10px] font-normal text-text-theme-tertiary">{col.groups.length}</span>
						</button>

						{#if !collapsedDev[col.assignee]}
							<div class="px-2 pb-2 space-y-1.5">
								{#each col.groups as group (group.full_id)}
									<!-- bin = append drop target -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="rounded border bg-surface-elevated {group.status === 'parked' ? 'opacity-60' : ''} {dropHint?.zone === group.full_id ? 'border-chds-blue ring-1 ring-chds-blue' : 'border-default'}"
										ondragover={(e) => overZone(e, group.full_id)}
										ondrop={(e) => dropToGroup(e, group, null)}
									>
										<div class="px-2 py-1 flex items-center justify-between gap-1">
											{#if renamingId === group.full_id}
												<!-- svelte-ignore a11y_autofocus -->
												<input class="flex-1 text-xs px-1 py-0.5 rounded border border-chds-blue bg-surface text-text-theme-primary" bind:value={renameValue} autofocus onkeydown={(e) => { if (e.key === 'Enter') commitRename(group); if (e.key === 'Escape') renamingId = null; }} onblur={() => commitRename(group)} />
												<button class="p-0.5 rounded text-chds-blue" title="Save name" onclick={() => commitRename(group)}><Check class="w-3.5 h-3.5" /></button>
											{:else}
												<button class="min-w-0 flex items-center gap-1 text-left flex-1" onclick={() => (expandedGroup[group.full_id] = !expandedGroup[group.full_id])}>
													{#if expandedGroup[group.full_id]}<ChevronDown class="w-3 h-3 flex-shrink-0" />{:else}<ChevronRight class="w-3 h-3 flex-shrink-0" />{/if}
													<span class="text-xs font-medium {group.name === 'Untitled' ? 'text-text-theme-tertiary italic' : 'text-text-theme-primary'} truncate">{group.name}</span>
													<span class="text-[10px] text-text-theme-tertiary flex-shrink-0">{group.member_count}</span>
													{#if group.status === 'parked'}<span class="text-[9px] uppercase tracking-wide px-1 py-0.5 rounded bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200 flex-shrink-0">parked</span>{/if}
												</button>
												<button class="p-0.5 rounded flex-shrink-0 {group.status === 'parked' ? 'text-amber-600' : 'text-text-theme-tertiary hover:text-text-theme-primary'} hover:bg-surface-secondary" title={group.status === 'parked' ? 'Unpark (return to active)' : 'Park (set aside)'} onclick={() => togglePark(group)} disabled={busy}>{#if group.status === 'parked'}<Play class="w-3 h-3" />{:else}<Pause class="w-3 h-3" />{/if}</button>
												<button class="p-0.5 rounded text-text-theme-tertiary hover:text-text-theme-primary hover:bg-surface-secondary flex-shrink-0" title="Rename" onclick={() => startRename(group)}><Pencil class="w-3 h-3" /></button>
												{#if selectedId}
													<button class="p-0.5 rounded text-chds-blue hover:bg-surface-secondary flex-shrink-0" title="Place selected issue here" onclick={() => place(selectedId!, group)} disabled={busy}><Plus class="w-3.5 h-3.5" /></button>
												{/if}
											{/if}
										</div>

										{#if expandedGroup[group.full_id]}
											<div class="px-1.5 pb-1.5 space-y-1">
												{#each group.issues || [] as m, mi (m.full_id)}
													{@render issueRow(m, { group, index: mi, len: group.issues?.length || 0 })}
												{/each}
												{#if !(group.issues || []).length}
													<p class="text-[10px] text-text-theme-tertiary italic px-1 py-0.5">empty — drop or ＋ to add</p>
												{/if}
												<div class="flex items-center gap-1 pt-1">
													{#if shippingId === group.full_id}
														<input class="flex-1 text-[10px] px-1.5 py-0.5 rounded border border-default bg-surface text-text-theme-primary" placeholder="vX.Y.Z" bind:value={shipVersion[group.full_id]} onkeydown={(e) => e.key === 'Enter' && ship(group)} />
														<button class="text-[10px] px-1.5 py-0.5 rounded bg-chds-blue text-white" onclick={() => ship(group)} disabled={busy}>ship</button>
													{:else}
														<button class="text-[10px] px-1.5 py-0.5 rounded text-chds-blue hover:bg-surface-secondary inline-flex items-center gap-0.5" onclick={() => (shippingId = group.full_id)} disabled={busy}><Ship class="w-3 h-3" /> ship</button>
													{/if}
													{#if confirmDeleteId === group.full_id}
														<button class="text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white" onclick={() => destroyGroup(group)} disabled={busy}>delete?</button>
													{:else}
														<button class="text-[10px] px-1 py-0.5 rounded text-text-theme-tertiary hover:text-red-600 hover:bg-surface-secondary" title="Delete group (members return to inbox)" onclick={() => (confirmDeleteId = group.full_id)} disabled={busy}><Trash2 class="w-3 h-3" /></button>
													{/if}
												</div>
											</div>
										{/if}
									</div>
								{/each}

								<!-- new group: typed input AND a drop target (R2: drop → Untitled group) -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="flex items-center gap-1 pt-0.5 rounded {dropHint?.zone === 'new:' + col.assignee ? 'ring-1 ring-chds-blue bg-chds-blue/5' : ''}"
									ondragover={(e) => overZone(e, 'new:' + col.assignee)}
									ondrop={(e) => dropToNewGroup(e, col.assignee)}
								>
									<input class="flex-1 text-[11px] px-1.5 py-1 rounded border border-default bg-surface text-text-theme-primary placeholder:text-text-theme-tertiary" placeholder="＋ new group (or drop here)" bind:value={newGroupName[col.assignee]} onkeydown={(e) => e.key === 'Enter' && createGroup(col.assignee)} />
									<button class="p-1 rounded text-chds-blue hover:bg-surface disabled:opacity-40" title="Create group" onclick={() => createGroup(col.assignee)} disabled={busy || !(newGroupName[col.assignee] || '').trim()}><Plus class="w-3.5 h-3.5" /></button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</aside>
	</div>
</div>

<!-- R1: off-screen drag proxy — what the cursor carries when dragging from the viewer. -->
{#if viewerIssue}
	<div bind:this={dragProxyEl} class="fixed -top-96 -left-96 pointer-events-none rounded border border-chds-blue bg-surface px-2 py-1.5 text-xs text-text-theme-primary shadow-lg max-w-[280px]">
		<span class="inline-block w-1.5 h-1.5 rounded-full {priorityDot(viewerIssue.priority)} mr-1"></span>{viewerIssue.title}
	</div>
{/if}
