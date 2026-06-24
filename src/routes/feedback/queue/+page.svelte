<script lang="ts">
	// Triage workbench (/ink/feedback/queue). A master-detail screen for working the
	// developer queue: a sortable/filterable INBOX list (left) → a full-detail VIEWER
	// (center) → a QUEUE RAIL (right) of dev-grouped WorkGroup bins you place issues
	// into by drag or click. Replaces the old kanban-columns board: triage is a
	// select → read → place loop, not a card grid.
	//
	// - List = inbox issues (work_group_id IS NULL) via inkApi.getFeedbackList({inbox})
	//   (the server already does sort/filter/search/paginate).
	// - Viewer = inkApi.getFeedbackIssue(id) (expanded detail).
	// - Rail = inkApi.getWorkGroupBoard().groups; place via inkApi.moveIssue().
	//
	// DnD is NATIVE HTML5 (not svelte-dnd-action — it crashes at flush on Svelte 5.15;
	// see BrowseTree.svelte). State is plain runes + direct inkApi (mutate → replace
	// from server; the server is the source of truth for sibling positions).
	import { onMount } from 'svelte';
	import {
		inkApi,
		type WorkGroupBoard,
		type WorkGroup,
		type FeedbackIssue,
		type FeedbackIssueExpanded,
		type FeedbackIssueListResponse
	} from '$lib/services/ink-api';
	import ColumnResizer from '$lib/components/ink/ColumnResizer.svelte';
	import {
		Inbox as InboxIcon,
		Search,
		X,
		Ship,
		Trash2,
		ArrowUp,
		ArrowDown,
		Plus,
		ChevronDown,
		ChevronRight,
		ExternalLink,
		CornerDownLeft
	} from 'lucide-svelte';

	const SUBPROJECTS = ['frontend', 'ink', 'rails'];
	const SORTS: Record<string, { sort: string; direction: 'asc' | 'desc'; label: string }> = {
		priority: { sort: 'priority', direction: 'asc', label: 'Priority (high→low)' },
		newest: { sort: 'created_at', direction: 'desc', label: 'Newest' },
		oldest: { sort: 'created_at', direction: 'asc', label: 'Oldest' },
		category: { sort: 'category', direction: 'asc', label: 'Category' },
		status: { sort: 'status', direction: 'asc', label: 'Status' }
	};

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

	// ── Rail / placement ────────────────────────────────────────────────
	let dragIssueId = $state<string | null>(null);
	let dropBin = $state<string | null>(null);
	let collapsedDev = $state<Record<string, boolean>>({});
	let expandedGroup = $state<Record<string, boolean>>({});
	let newGroupName = $state<Record<string, string>>({});
	let shipVersion = $state<Record<string, string>>({});
	let shippingId = $state<string | null>(null);
	let confirmDeleteId = $state<string | null>(null);
	type ShipNotReady = { id: string; short_id: string; status: string; title: string };
	let shipNotice = $state<{ name: string; version: string; notReady: ShipNotReady[] } | null>(null);

	let devColumns = $derived(
		board ? board.filters.assignees.map((a) => ({ assignee: a, groups: board!.groups.filter((g) => g.assignee === a) })) : []
	);

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
		q = '';
		fCategory = '';
		fPriority = '';
		fSubproject = '';
		sortKey = 'priority';
		page = 1;
		loadInbox();
	}

	async function select(issue: FeedbackIssue) {
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

	// ── Placement (drag + click both call moveIssue) ────────────────────
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
	function onDragStart(issueId: string) {
		dragIssueId = issueId;
	}
	function onDragEnd() {
		dragIssueId = null;
		dropBin = null;
	}
	function overBin(e: DragEvent, groupId: string) {
		if (!dragIssueId) return;
		e.preventDefault();
		dropBin = groupId;
	}
	async function dropOnBin(e: DragEvent, group: WorkGroup) {
		e.preventDefault();
		const id = dragIssueId;
		dropBin = null;
		dragIssueId = null;
		if (id) await place(id, group);
	}

	// ── In-group reorder / lifecycle (reused from the prior board) ───────
	async function nudgeIssue(group: WorkGroup, issue: { full_id: string; position: number }, delta: number) {
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

	function priorityDot(p: string): string {
		return (
			{ critical: 'bg-red-500', high: 'bg-amber-500', normal: 'bg-slate-400', low: 'bg-slate-300', none: 'bg-slate-200' }[
				p
			] || 'bg-slate-400'
		);
	}
	function statusClass(s: string): string {
		return (
			{ deploy_ready: 'text-emerald-600', dev_review: 'text-indigo-600', needs_feedback: 'text-amber-600', resolved: 'text-slate-400' }[
				s
			] || 'text-text-theme-tertiary'
		);
	}
	let results = $derived(inboxResp?.results ?? []);
</script>

<svelte:head><title>Triage · INK</title></svelte:head>

<div class="flex flex-col h-full overflow-hidden">
{#if shipNotice}
	<div class="m-3 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
		<div class="flex items-center justify-between">
			<strong class="text-amber-800 dark:text-amber-300">Shipped “{shipNotice.name}” as {shipNotice.version}</strong>
			<button class="text-amber-700 hover:underline" onclick={() => (shipNotice = null)}>dismiss</button>
		</div>
		{#if shipNotice.notReady.length}
			<p class="mt-1 text-amber-800 dark:text-amber-300">
				⚠️ {shipNotice.notReady.length} member(s) not deploy_ready — they will NOT auto-resolve on deploy:
				{shipNotice.notReady.map((m) => m.short_id).join(', ')}
			</p>
		{:else}
			<p class="mt-1 text-amber-800 dark:text-amber-300">All members are deploy_ready. ✅</p>
		{/if}
	</div>
{/if}

{#if error}
	<div class="m-3 rounded border border-red-300 bg-red-50 dark:bg-red-950/30 p-2 text-sm text-red-700">
		{error}
		<button class="ml-2 underline" onclick={() => { error = null; loadInbox(); loadBoard(); }}>retry</button>
	</div>
{/if}

<div
	id="triage-shell"
	class="grid gap-0 flex-1 min-h-0 overflow-hidden"
	style="grid-template-columns: var(--list-w, 360px) 6px minmax(0, 1fr) 340px;"
>
	<!-- ① INBOX LIST -->
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
				<input
					class="w-full text-xs pl-7 pr-2 py-1.5 rounded border border-default bg-surface-secondary text-text-theme-primary"
					placeholder="search title / id…"
					bind:value={q}
					oninput={onSearchInput}
				/>
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
					{#each (inboxResp?.filters.priorities ?? ['critical','high','normal','low']) as p}<option value={p}>{p}</option>{/each}
				</select>
				<select class="text-[11px] px-1.5 py-1 rounded border border-default bg-surface-secondary text-text-theme-primary" bind:value={fCategory} onchange={onControlChange}>
					<option value="">all categories</option>
					{#each (inboxResp?.filters.categories ?? []) as c}<option value={c}>{c}</option>{/each}
				</select>
			</div>
		</div>

		<div class="flex-1 min-h-0 overflow-y-auto">
			{#if inboxLoading && !results.length}
				<p class="p-3 text-xs text-text-theme-tertiary">Loading…</p>
			{:else if !results.length}
				<p class="p-3 text-xs text-text-theme-tertiary italic">No matching issues in the inbox.</p>
			{:else}
				<ul>
					{#each results as issue (issue.full_id)}
						<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
						<li
							class="px-2.5 py-1.5 border-b border-default cursor-pointer hover:bg-surface-secondary {selectedId === issue.full_id ? 'bg-surface-secondary ring-1 ring-inset ring-chds-blue' : ''} {dragIssueId === issue.full_id ? 'opacity-40' : ''}"
							draggable={true}
							ondragstart={() => onDragStart(issue.full_id)}
							ondragend={onDragEnd}
							onclick={() => select(issue)}
						>
							<div class="flex items-start gap-1.5">
								<span class="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 {priorityDot(issue.priority)}" title={issue.priority}></span>
								<div class="min-w-0 flex-1">
									<div class="text-xs text-text-theme-primary leading-snug line-clamp-2">{issue.title}</div>
									<div class="text-[10px] text-text-theme-tertiary mt-0.5">
										<code>{issue.id}</code> · <span class={statusClass(issue.status)}>{issue.status}</span>{#if issue.assignee} · {issue.assignee}{/if} · {issue.age_days}d
									</div>
								</div>
							</div>
						</li>
					{/each}
				</ul>
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

	<!-- ② VIEWER -->
	<section class="min-h-0 overflow-y-auto bg-surface-elevated">
		{#if viewerLoading}
			<p class="p-4 text-sm text-text-theme-secondary">Loading issue…</p>
		{:else if !viewerIssue}
			<div class="h-full flex items-center justify-center text-center p-6">
				<p class="text-sm text-text-theme-tertiary">Select an issue from the inbox to read it, then drag it (or click ＋) into a queue on the right.</p>
			</div>
		{:else}
			<article class="p-4">
				<div class="flex items-center gap-2 text-[11px] mb-1">
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
					<a href={viewerIssue.url_example} target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs text-chds-blue hover:underline mt-2">
						<ExternalLink class="w-3 h-3" /> {viewerIssue.url_example}
					</a>
				{/if}

				{#if viewerIssue.description}
					<div class="mt-3 text-sm text-text-theme-primary whitespace-pre-wrap leading-relaxed">{viewerIssue.description}</div>
				{:else}
					<div class="mt-3 text-sm text-text-theme-tertiary italic">No description.</div>
				{/if}

				{#if viewerIssue.search_query}
					<div class="mt-2 text-xs text-text-theme-secondary">search query: <code>{viewerIssue.search_query}</code></div>
				{/if}

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

				<p class="mt-4 text-[11px] text-text-theme-tertiary flex items-center gap-1">
					<CornerDownLeft class="w-3 h-3" /> Drag this issue's row into a queue, or click ＋ on a queue at right.
				</p>
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
					<button
						class="w-full px-3 py-1.5 flex items-center justify-between text-xs font-semibold text-text-theme-primary capitalize hover:bg-surface"
						onclick={() => (collapsedDev[col.assignee] = !collapsedDev[col.assignee])}
					>
						<span class="flex items-center gap-1">
							{#if collapsedDev[col.assignee]}<ChevronRight class="w-3.5 h-3.5" />{:else}<ChevronDown class="w-3.5 h-3.5" />{/if}
							{col.assignee}
						</span>
						<span class="text-[10px] font-normal text-text-theme-tertiary">{col.groups.length}</span>
					</button>

					{#if !collapsedDev[col.assignee]}
						<div class="px-2 pb-2 space-y-1.5">
							{#each col.groups as group (group.full_id)}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="rounded border bg-surface {dropBin === group.full_id ? 'border-chds-blue ring-1 ring-chds-blue' : 'border-default'}"
									ondragover={(e) => overBin(e, group.full_id)}
									ondrop={(e) => dropOnBin(e, group)}
								>
									<div class="px-2 py-1 flex items-center justify-between gap-1">
										<button class="min-w-0 flex items-center gap-1 text-left flex-1" onclick={() => (expandedGroup[group.full_id] = !expandedGroup[group.full_id])}>
											{#if expandedGroup[group.full_id]}<ChevronDown class="w-3 h-3 flex-shrink-0" />{:else}<ChevronRight class="w-3 h-3 flex-shrink-0" />{/if}
											<span class="text-xs font-medium text-text-theme-primary truncate">{group.name}</span>
											<span class="text-[10px] text-text-theme-tertiary flex-shrink-0">{group.member_count}</span>
										</button>
										{#if selectedId}
											<button class="p-0.5 rounded text-chds-blue hover:bg-surface-secondary flex-shrink-0" title="Place selected issue here" onclick={() => place(selectedId!, group)} disabled={busy}>
												<Plus class="w-3.5 h-3.5" />
											</button>
										{/if}
									</div>

									{#if expandedGroup[group.full_id]}
										<div class="px-1.5 pb-1.5 space-y-0.5">
											{#each group.issues || [] as m, mi (m.full_id)}
												<div class="rounded bg-surface-secondary px-1.5 py-1 flex items-start gap-1 group/m">
													<span class="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 {priorityDot(m.priority)}"></span>
													<div class="min-w-0 flex-1">
														<div class="text-[11px] text-text-theme-primary leading-tight line-clamp-1">{m.title}</div>
														<code class="text-[9px] text-text-theme-tertiary">{m.id}</code>
													</div>
													<div class="flex gap-0.5 opacity-0 group-hover/m:opacity-100 flex-shrink-0">
														<button class="p-0.5 rounded hover:bg-surface disabled:opacity-30" title="Up" onclick={() => nudgeIssue(group, m, -1)} disabled={busy || mi === 0}><ArrowUp class="w-3 h-3" /></button>
														<button class="p-0.5 rounded hover:bg-surface disabled:opacity-30" title="Down" onclick={() => nudgeIssue(group, m, 1)} disabled={busy || mi === (group.issues?.length || 0) - 1}><ArrowDown class="w-3 h-3" /></button>
														<button class="p-0.5 rounded hover:bg-surface text-text-theme-tertiary" title="Return to inbox" onclick={() => memberToInbox(m.full_id)} disabled={busy}><InboxIcon class="w-3 h-3" /></button>
													</div>
												</div>
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

							<div class="flex items-center gap-1 pt-0.5">
								<input
									class="flex-1 text-[11px] px-1.5 py-1 rounded border border-default bg-surface text-text-theme-primary placeholder:text-text-theme-tertiary"
									placeholder="＋ new group"
									bind:value={newGroupName[col.assignee]}
									onkeydown={(e) => e.key === 'Enter' && createGroup(col.assignee)}
								/>
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
