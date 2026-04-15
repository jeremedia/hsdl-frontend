<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { writable, derived } from 'svelte/store';
	import { inkApi, type FeedbackDashboardData, type FeedbackIssueExpanded, type FeedbackIssueListParams } from '$lib/services/ink-api';
	import { MessageSquare, AlertTriangle, Bug, Lightbulb, Layout, FileText, Search, Gauge, CircleDot, BarChart3, List, ChevronDown, ChevronRight, ExternalLink, Image } from 'lucide-svelte';
	import ImageGallery from '$lib/components/ImageGallery.svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';

	const queryClient = useQueryClient();

	// ── LocalStorage persistence ──
	const STORAGE_KEY = 'ink-feedback-state';

	function loadStorage(): Record<string, string> {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			return raw ? JSON.parse(raw) : {};
		} catch { return {}; }
	}

	function saveStorage(partial: Record<string, string | string[]>) {
		try {
			const current = loadStorage();
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...partial }));
		} catch { /* noop */ }
	}

	// ── Initialize from URL params → localStorage fallback ──
	const urlParams = $page.url.searchParams;
	const stored = loadStorage();

	function initParam(key: string, fallback: string): string {
		return urlParams.get(key) || stored[key] || fallback;
	}

	// ── View toggle ──
	let view = $state<'dashboard' | 'list'>(initParam('view', 'dashboard') === 'list' ? 'list' : 'dashboard');

	// ── Dashboard query ──
	const dashboardQuery = createQuery({
		queryKey: ['ink', 'feedback'],
		queryFn: () => inkApi.getFeedbackDashboard()
	});

	// ── List state ──
	let listSort = $state(initParam('sort', 'created_at'));
	let listDir = $state<'asc' | 'desc'>(initParam('dir', 'desc') === 'asc' ? 'asc' : 'desc');
	let listPage = $state(parseInt(urlParams.get('page') || '1'));
	let filterStatus = $state(urlParams.get('status') || '');
	let filterCategory = $state(urlParams.get('category') || '');
	let filterPriority = $state(urlParams.get('priority') || '');
	let filterReporter = $state(urlParams.get('reporter') || '');
	const initialFilterText = urlParams.get('q') || '';
	let filterText = $state(initialFilterText);
	let expandedIds = $state<Set<string>>(new Set(
		(stored.expanded ? JSON.parse(stored.expanded) : []) as string[]
	));

	// ── Sync state → URL + localStorage ──
	// debouncedText is updated by the textStore debounce timer, not on every keystroke
	let debouncedText = $state(initialFilterText);

	function syncUrl(qVal: string) {
		const params = new URLSearchParams();
		if (view === 'list') params.set('view', 'list');
		if (listSort !== 'created_at') params.set('sort', listSort);
		if (listDir !== 'desc') params.set('dir', listDir);
		if (listPage > 1) params.set('page', String(listPage));
		if (filterStatus) params.set('status', filterStatus);
		if (filterCategory) params.set('category', filterCategory);
		if (filterPriority) params.set('priority', filterPriority);
		if (filterReporter) params.set('reporter', filterReporter);
		if (qVal) params.set('q', qVal);

		const qs = params.toString();
		const url = `${base}/feedback${qs ? '?' + qs : ''}`;
		history.replaceState(history.state, '', url);
	}

	// Persist non-text state immediately
	$effect(() => {
		// Touch all non-text reactive deps so this fires on their changes
		const _v = view, _s = listSort, _d = listDir, _p = listPage;
		const _fs = filterStatus, _fc = filterCategory, _fp = filterPriority, _fr = filterReporter;
		saveStorage({ view: _v, sort: _s, dir: _d });
		syncUrl(debouncedText);
	});

	// Persist expanded IDs to localStorage (not URL — too verbose)
	$effect(() => {
		saveStorage({ expanded: JSON.stringify([...expandedIds]) });
	});

	// Bridge $state → stores for TanStack Query reactivity
	const viewStore = writable<'dashboard' | 'list'>('dashboard');
	const sortStore = writable('created_at');
	const dirStore = writable<'asc' | 'desc'>('desc');
	const pageStore = writable(1);
	const statusStore = writable('');
	const categoryStore = writable('');
	const priorityStore = writable('');
	const reporterStore = writable('');
	const textStore = writable('');
	let textDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => { viewStore.set(view); });
	$effect(() => { sortStore.set(listSort); });
	$effect(() => { dirStore.set(listDir); });
	$effect(() => { pageStore.set(listPage); });
	$effect(() => { statusStore.set(filterStatus); });
	$effect(() => { categoryStore.set(filterCategory); });
	$effect(() => { priorityStore.set(filterPriority); });
	$effect(() => { reporterStore.set(filterReporter); });
	// Debounce text search — 300ms delay prevents stealing focus and excess API calls
	$effect(() => {
		const val = filterText;
		if (textDebounceTimer) clearTimeout(textDebounceTimer);
		textDebounceTimer = setTimeout(() => {
			textStore.set(val);
			debouncedText = val;
		}, 300);
	});

	const listQueryOptions = derived(
		[viewStore, sortStore, dirStore, pageStore, statusStore, categoryStore, priorityStore, reporterStore, textStore],
		([$v, $s, $d, $p, $st, $c, $pr, $r, $q]) => {
			const params: FeedbackIssueListParams = {
				sort: $s, direction: $d, page: $p, per_page: 50,
				status: $st || undefined, category: $c || undefined,
				priority: $pr || undefined, reporter: $r || undefined,
				q: $q || undefined
			};
			return {
				queryKey: ['ink', 'feedback-list', params],
				queryFn: () => inkApi.getFeedbackList(params),
				enabled: $v === 'list'
			};
		}
	);

	const listQuery = createQuery(listQueryOptions);

	// ── Priority mutation ──
	const priorityMutation = createMutation({
		mutationFn: ({ id, priority }: { id: string; priority: string }) =>
			inkApi.updateIssuePriority(id, priority),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['ink', 'feedback-list'] });
			queryClient.invalidateQueries({ queryKey: ['ink', 'feedback'] });
		}
	});

	// ── Helpers ──
	function statusColor(status: string): string {
		switch (status) {
			case 'open': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
			case 'investigating': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
			case 'needs_feedback': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
			case 'dev_review': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300';
			case 'deploy_ready': return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300';
			case 'resolved': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
			case 'wont_fix': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
			default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
		}
	}

	function statusLabel(status: string): string {
		switch (status) {
			case 'open': return 'Open';
			case 'investigating': return 'Investigating';
			case 'needs_feedback': return 'Needs Feedback';
			case 'dev_review': return 'Dev Review';
			case 'deploy_ready': return 'Deploy Ready';
			case 'resolved': return 'Resolved';
			case 'wont_fix': return "Won't Fix";
			default: return status;
		}
	}

	function reviewColor(status: string | null): string {
		switch (status) {
			case 'waiting_for_review': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
			case 'confirmed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
			case 'rejected': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
			default: return '';
		}
	}

	function reviewLabel(status: string | null): string {
		switch (status) {
			case 'waiting_for_review': return 'Awaiting Review';
			case 'confirmed': return 'Confirmed';
			case 'rejected': return 'Rejected';
			default: return '';
		}
	}

	function categoryIcon(cat: string): typeof Bug {
		switch (cat) {
			case 'bug': return Bug;
			case 'feature_request': return Lightbulb;
			case 'ui_navigation': return Layout;
			case 'content': return FileText;
			case 'search_quality': return Search;
			case 'performance': return Gauge;
			default: return CircleDot;
		}
	}

	function categoryLabel(cat: string): string {
		switch (cat) {
			case 'bug': return 'Bugs';
			case 'feature_request': return 'Feature Requests';
			case 'ui_navigation': return 'UI / Navigation';
			case 'content': return 'Content';
			case 'search_quality': return 'Search Quality';
			case 'performance': return 'Performance';
			default: return cat;
		}
	}

	function categoryColor(cat: string): string {
		switch (cat) {
			case 'bug': return 'bg-red-500';
			case 'feature_request': return 'bg-indigo-500';
			case 'ui_navigation': return 'bg-sky-500';
			case 'content': return 'bg-amber-500';
			case 'search_quality': return 'bg-emerald-500';
			case 'performance': return 'bg-orange-500';
			default: return 'bg-gray-500';
		}
	}

	function priorityIndicator(p: string): string {
		switch (p) {
			case 'critical': return 'text-red-600';
			case 'high': return 'text-orange-500';
			default: return '';
		}
	}

	function sparklinePoints(data: FeedbackDashboardData, key: 'opened' | 'resolved'): string {
		const timeline = data.timeline;
		if (!timeline.length) return '';
		const values = timeline.map(d => d[key]);
		const max = Math.max(...values, 1);
		const padTop = 3;
		const padBot = 3;
		const plotH = 50 - padTop - padBot;
		const step = 100 / Math.max(timeline.length - 1, 1);
		return values.map((v, i) =>
			`${(i * step).toFixed(1)},${(padTop + plotH - (v / max) * plotH).toFixed(1)}`
		).join(' ');
	}

	function formatDate(iso: string): string {
		const d = new Date(iso + 'T00:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function formatTimestamp(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}

	/** Turn docID patterns (4-7 digit numbers, UUIDs) in text into clickable links */
	function linkifyDocIds(text: string): string {
		// Escape HTML first
		const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		// Link UUIDs
		let result = escaped.replace(
			/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi,
			'<a href="/details.html?id=$1" target="_blank" class="text-interactive hover:underline">$1</a>'
		);
		// Link integer docIDs (4-7 digits, preceded by word boundary or "docID " or "docid ")
		result = result.replace(
			/(?:docID\s*|docid\s*|#)(\d{4,7})\b/gi,
			(match, id) => match.replace(id, `<a href="/details.html?id=${id}" target="_blank" class="text-interactive hover:underline">${id}</a>`)
		);
		// Catch standalone 5-7 digit numbers not already linked (likely docIDs in context)
		result = result.replace(
			/(?<!href="[^"]*?)(?<!>)\b(\d{5,7})\b(?![^<]*<\/a>)/g,
			'<a href="/details.html?id=$1" target="_blank" class="text-interactive hover:underline">$1</a>'
		);
		return result;
	}

	// Navigate to list view with a specific filter applied
	function goToList(filters: { status?: string; category?: string; reporter?: string }) {
		filterStatus = filters.status || '';
		filterCategory = filters.category || '';
		filterReporter = filters.reporter || '';
		filterPriority = '';
		filterText = '';
		listPage = 1;
		view = 'list';
	}

	function toggleExpanded(id: string) {
		const next = new Set(expandedIds);
		if (next.has(id)) next.delete(id); else next.add(id);
		expandedIds = next;
	}

	function toggleSort(col: string) {
		if (listSort === col) {
			listDir = listDir === 'desc' ? 'asc' : 'desc';
		} else {
			listSort = col;
			listDir = col === 'priority' ? 'desc' : 'desc';
		}
		listPage = 1;
	}

	function clearFilters() {
		filterStatus = '';
		filterCategory = '';
		filterPriority = '';
		filterReporter = '';
		filterText = '';
		listPage = 1;
	}

	function sortIndicator(col: string): string {
		if (listSort !== col) return '';
		return listDir === 'asc' ? ' \u25B2' : ' \u25BC';
	}

	let hasActiveFilters = $derived(
		filterStatus !== '' || filterCategory !== '' || filterPriority !== '' || filterReporter !== '' || filterText !== ''
	);

	// Auto-expand single result (e.g., when linked by ID)
	let autoExpandedOnce = $state(false);
	$effect(() => {
		if ($listQuery.data && $listQuery.data.results.length === 1 && !autoExpandedOnce) {
			expandedIds = new Set([$listQuery.data.results[0].full_id]);
			autoExpandedOnce = true;
		}
	});
</script>

<svelte:head>
	<title>Feedback - INK</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header with view toggle -->
	<div class="flex items-center gap-2">
		<MessageSquare size={20} class="text-text-theme-secondary" />
		<h1 class="text-lg font-semibold text-text-theme-primary">Feedback Tracker</h1>
		<div class="ml-auto flex items-center gap-1 bg-surface-secondary rounded-lg p-0.5">
			<button
				onclick={() => view = 'dashboard'}
				class="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors
					{view === 'dashboard' ? 'bg-surface-elevated text-text-theme-primary shadow-sm' : 'text-text-theme-tertiary hover:text-text-theme-secondary'}"
			>
				<BarChart3 size={13} />
				Dashboard
			</button>
			<button
				onclick={() => view = 'list'}
				class="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors
					{view === 'list' ? 'bg-surface-elevated text-text-theme-primary shadow-sm' : 'text-text-theme-tertiary hover:text-text-theme-secondary'}"
			>
				<List size={13} />
				Issues
			</button>
		</div>
	</div>

	<!-- ═══════════ DASHBOARD VIEW ═══════════ -->
	{#if view === 'dashboard'}
		{#if $dashboardQuery.isPending}
			<div class="animate-pulse space-y-4">
				<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
					{#each Array(5) as _}
						<div class="h-20 bg-surface-secondary rounded-lg"></div>
					{/each}
				</div>
			</div>
		{:else if $dashboardQuery.isError}
			<div class="rounded-lg bg-red-50 dark:bg-red-900/20 p-4">
				<p class="text-red-700 dark:text-red-300 text-sm">Failed to load: {$dashboardQuery.error?.message}</p>
			</div>
		{:else if $dashboardQuery.data}
			{@const data = $dashboardQuery.data}
			{@const s = data.summary}
			{@const maxCatCount = Math.max(...Object.values(data.by_category), 1)}

			<!-- Stat Cards — top row: pipeline, bottom row: metrics -->
			<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
				<button onclick={() => goToList({ status: 'open' })} class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-blue-500 p-3 text-left hover:bg-surface-secondary transition-colors cursor-pointer">
					<div class="text-xs font-medium text-text-theme-secondary mb-1">Open</div>
					<div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{s.open}</div>
					{#if s.investigating > 0}
						<div class="text-xs text-amber-600 dark:text-amber-400 mt-1">{s.investigating} investigating</div>
					{/if}
				</button>
				<button onclick={() => goToList({ status: 'resolved' })} class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-green-500 p-3 text-left hover:bg-surface-secondary transition-colors cursor-pointer">
					<div class="text-xs font-medium text-text-theme-secondary mb-1">Resolved</div>
					<div class="text-2xl font-bold text-green-600 dark:text-green-400">{s.resolved}</div>
					<div class="text-xs text-text-theme-tertiary mt-1">{s.resolved_last_7d} this week</div>
				</button>
				<button onclick={() => goToList({ status: 'wont_fix' })} class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-gray-400 dark:border-l-gray-500 p-3 text-left hover:bg-surface-secondary transition-colors cursor-pointer">
					<div class="text-xs font-medium text-text-theme-secondary mb-1">Won't Fix</div>
					<div class="text-2xl font-bold text-text-theme-tertiary">{s.wont_fix}</div>
					{#if s.duplicate > 0}
						<div class="text-xs text-text-theme-tertiary mt-1">{s.duplicate} duplicates</div>
					{/if}
				</button>
				<button onclick={() => goToList({ status: 'deploy_ready' })} class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-violet-500 p-3 text-left hover:bg-surface-secondary transition-colors cursor-pointer">
					<div class="text-xs font-medium text-text-theme-secondary mb-1">Deploy Ready</div>
					<div class="text-2xl font-bold text-violet-600 dark:text-violet-400">{s.deploy_ready}</div>
					{#if s.dev_review > 0}
						<div class="text-xs text-cyan-600 dark:text-cyan-400 mt-1">{s.dev_review} in dev review</div>
					{/if}
				</button>
				<div class="bg-surface-elevated rounded-lg border border-theme border-l-2 border-l-yellow-500 p-3">
					<div class="text-xs font-medium text-text-theme-secondary mb-1">Awaiting Review</div>
					<div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{s.awaiting_review}</div>
					{#if s.review_confirmed > 0}
						<div class="text-xs text-green-600 dark:text-green-400 mt-1">{s.review_confirmed} confirmed</div>
					{/if}
				</div>
				<div class="bg-surface-elevated rounded-lg border border-theme p-3">
					<div class="text-xs font-medium text-text-theme-secondary mb-1">Resolution Rate</div>
					<div class="text-2xl font-bold text-text-theme-primary">{s.resolution_rate}%</div>
					<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
						<div class="bg-green-500 h-1.5 rounded-full transition-all" style="width: {s.resolution_rate}%"></div>
					</div>
					<div class="text-xs text-text-theme-tertiary mt-1">days to close</div>
				</div>
			</div>

			<!-- Categories + Timeline -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<div class="bg-surface-elevated rounded-lg border border-theme p-4">
					<h2 class="text-sm font-semibold text-text-theme-primary mb-3">By Category</h2>
					<div class="space-y-3">
						{#each Object.entries(data.by_category) as [cat, count]}
							{@const Icon = categoryIcon(cat)}
							<button onclick={() => goToList({ category: cat })} class="flex items-center gap-2 w-full hover:bg-surface-secondary rounded -mx-1 px-1 py-0.5 transition-colors cursor-pointer">
								<Icon size={14} class="text-text-theme-tertiary flex-shrink-0" />
								<span class="text-xs text-text-theme-secondary w-28 flex-shrink-0 truncate">{categoryLabel(cat)}</span>
								<div class="flex-1 h-5 bg-surface-secondary rounded overflow-hidden relative">
									<div class="{categoryColor(cat)} h-full rounded transition-all opacity-75" style="width: {Math.max(count / maxCatCount * 100, 4).toFixed(0)}%"></div>
								</div>
								<span class="text-xs font-medium text-text-theme-primary tabular-nums w-6 text-right flex-shrink-0">{count}</span>
							</button>
						{/each}
					</div>
				</div>

				<div class="bg-surface-elevated rounded-lg border border-theme p-4">
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-sm font-semibold text-text-theme-primary">Activity</h2>
						<div class="flex items-center gap-4">
							<div class="flex items-center gap-1.5"><div class="w-3 h-0.5 bg-blue-500 rounded-full"></div><span class="text-xs text-text-theme-tertiary">Opened</span></div>
							<div class="flex items-center gap-1.5"><div class="w-3 h-0.5 bg-green-500 rounded-full"></div><span class="text-xs text-text-theme-tertiary">Resolved</span></div>
						</div>
					</div>
					<div class="relative">
						<svg viewBox="0 0 100 50" class="w-full h-40" preserveAspectRatio="none">
							{#each [0.25, 0.5, 0.75] as ratio}
								<line x1="0" y1={3 + 44 - ratio * 44} x2="100" y2={3 + 44 - ratio * 44}
									stroke="currentColor" stroke-width="0.15" class="text-text-theme-tertiary opacity-20" />
							{/each}
							<polyline points={sparklinePoints(data, 'opened')} fill="none" stroke="#3b82f6" stroke-width="0.8" stroke-linejoin="round" stroke-linecap="round" />
							<polyline points={sparklinePoints(data, 'resolved')} fill="none" stroke="#22c55e" stroke-width="0.8" stroke-linejoin="round" stroke-linecap="round" />
						</svg>
						<div class="flex items-center justify-between mt-1">
							<span class="text-xs text-text-theme-tertiary">{formatDate(data.timeline[0]?.date)}</span>
							<span class="text-xs text-text-theme-tertiary">{formatDate(data.timeline[data.timeline.length - 1]?.date)}</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Reporter Breakdown -->
			{#if data.by_reporter.length > 0}
				<div class="bg-surface-elevated rounded-lg border border-theme p-4">
					<h2 class="text-sm font-semibold text-text-theme-primary mb-3">By Reporter</h2>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
						{#each data.by_reporter as reporter}
							{@const resRate = reporter.count > 0 ? Math.round(reporter.resolved / reporter.count * 100) : 0}
							<button onclick={() => goToList({ reporter: reporter.name })} class="flex items-center gap-3 p-2.5 rounded-lg bg-surface-secondary hover:bg-surface-secondary/80 transition-colors cursor-pointer text-left w-full">
								<div class="flex-1 min-w-0">
									<div class="text-sm font-medium text-text-theme-primary truncate">{reporter.name}</div>
									<div class="text-xs text-text-theme-tertiary mt-0.5">{reporter.count} filed, {reporter.resolved} resolved</div>
								</div>
								<div class="text-right flex-shrink-0">
									<div class="text-sm font-bold tabular-nums text-text-theme-primary">{resRate}%</div>
									<div class="text-xs text-text-theme-tertiary">resolved</div>
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		{/if}

	<!-- ═══════════ LIST VIEW ═══════════ -->
	{:else}
		<!-- Filters — rendered outside query conditional so they never unmount -->
		{@const selectClass = "text-xs bg-surface-elevated border border-theme rounded-md pl-2 pr-8 py-1.5 text-text-theme-primary focus:outline-none focus:ring-1 focus:ring-interactive appearance-none bg-no-repeat bg-[length:16px_16px] bg-[position:right_6px_center] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]"}
		<div class="flex flex-wrap items-center gap-2">
			<input
				type="text"
				bind:value={filterText}
				oninput={() => { listPage = 1; autoExpandedOnce = false; }}
				placeholder="Search by ID or title..."
				class="text-xs bg-surface-elevated border border-theme rounded-md pl-2 pr-2 py-1.5 text-text-theme-primary focus:outline-none focus:ring-1 focus:ring-interactive w-48"
			/>
			<select bind:value={filterStatus} onchange={() => listPage = 1} class={selectClass}>
				<option value="">All statuses</option>
				<option value="open">Open</option>
				<option value="investigating">Investigating</option>
				<option value="needs_feedback">Needs Feedback</option>
				<option value="dev_review">Dev Review</option>
				<option value="deploy_ready">Deploy Ready</option>
				<option value="resolved">Resolved</option>
				<option value="wont_fix">Won't Fix</option>
			</select>
			<select bind:value={filterCategory} onchange={() => listPage = 1} class={selectClass}>
				<option value="">All categories</option>
				<option value="bug">Bugs</option>
				<option value="content">Content</option>
				<option value="feature_request">Feature Requests</option>
				<option value="search_quality">Search Quality</option>
				<option value="ui_navigation">UI / Navigation</option>
				<option value="performance">Performance</option>
			</select>
			<select bind:value={filterPriority} onchange={() => listPage = 1} class={selectClass}>
				<option value="">All priorities</option>
				<option value="critical">critical</option>
				<option value="high">high</option>
				<option value="normal">normal</option>
				<option value="low">low</option>
			</select>
			<select bind:value={filterReporter} onchange={() => listPage = 1} class={selectClass}>
				<option value="">All reporters</option>
				{#if $listQuery.data}
					{#each $listQuery.data.filters.reporters as r}
						<option value={r}>{r}</option>
					{/each}
				{/if}
			</select>
			{#if hasActiveFilters}
				<button onclick={clearFilters} class="text-xs text-interactive hover:underline font-medium">Clear</button>
			{/if}
			<span class="text-xs text-text-theme-tertiary ml-auto tabular-nums">
				{$listQuery.data ? $listQuery.data.total_count : '...'} issues
			</span>
		</div>

		<!-- Table content — this part re-renders on query change, but filters above stay stable -->
		{#if $listQuery.isPending}
			<div class="animate-pulse space-y-2">
				{#each Array(8) as _}
					<div class="h-10 bg-surface-secondary rounded"></div>
				{/each}
			</div>
		{:else if $listQuery.isError}
			<div class="rounded-lg bg-red-50 dark:bg-red-900/20 p-4">
				<p class="text-red-700 dark:text-red-300 text-sm">Failed to load: {$listQuery.error?.message}</p>
			</div>
		{:else if $listQuery.data}
			{@const ld = $listQuery.data}

			<!-- Table -->
			<div class="bg-surface-elevated rounded-lg border border-theme overflow-hidden overflow-x-auto">
				<!-- Header row -->
				<div class="grid grid-cols-[1fr_90px_110px_80px_130px_44px] gap-2 px-3 py-2 border-b border-theme bg-surface-secondary text-xs font-medium text-text-theme-secondary uppercase tracking-wider min-w-[800px]">
					<button class="text-left hover:text-text-theme-primary transition-colors" onclick={() => toggleSort('title')}>Title{sortIndicator('title')}</button>
					<button class="text-left hover:text-text-theme-primary transition-colors" onclick={() => toggleSort('status')}>Status{sortIndicator('status')}</button>
					<button class="text-left hover:text-text-theme-primary transition-colors" onclick={() => toggleSort('category')}>Category{sortIndicator('category')}</button>
					<button class="text-left hover:text-text-theme-primary transition-colors" onclick={() => toggleSort('priority')}>Priority{sortIndicator('priority')}</button>
					<button class="text-left hover:text-text-theme-primary transition-colors" onclick={() => toggleSort('reported_by')}>Reporter{sortIndicator('reported_by')}</button>
					<button class="text-left hover:text-text-theme-primary transition-colors" onclick={() => toggleSort('created_at')}>Age{sortIndicator('created_at')}</button>
				</div>

				<!-- Issue rows -->
				<div class="divide-y divide-gray-200 dark:divide-gray-700/50">
					{#each ld.results as issue (issue.full_id)}
						{@const isExpanded = expandedIds.has(issue.full_id)}
						<!-- Summary row -->
						<div class={isExpanded ? 'bg-surface-secondary/50' : ''}>
							<button
								class="w-full grid grid-cols-[1fr_90px_110px_80px_130px_44px] gap-2 px-3 py-2 text-left hover:bg-surface-secondary transition-colors items-center group min-w-[800px]"
								onclick={() => toggleExpanded(issue.full_id)}
							>
								<div class="flex items-center gap-1.5 min-w-0">
									{#if isExpanded}
										<ChevronDown size={14} class="text-text-theme-secondary flex-shrink-0" />
									{:else}
										<ChevronRight size={14} class="text-text-theme-tertiary group-hover:text-text-theme-secondary flex-shrink-0 transition-colors" />
									{/if}
									<span class="text-sm text-text-theme-primary truncate">{issue.title}</span>
									{#if issue.priority === 'high' || issue.priority === 'critical'}
										<AlertTriangle size={12} class="{priorityIndicator(issue.priority)} flex-shrink-0" />
									{/if}
								</div>
								<span class="text-xs px-1.5 py-0.5 rounded-md w-fit font-medium {statusColor(issue.status)}">{statusLabel(issue.status)}</span>
								<span class="text-xs text-text-theme-secondary truncate">{categoryLabel(issue.category)}</span>
								<!-- Priority (click-to-edit, stop propagation) -->
								<div>
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<select
										value={issue.priority}
										onchange={(e) => {
											const target = e.target as HTMLSelectElement;
											$priorityMutation.mutate({ id: issue.full_id, priority: target.value });
										}}
										onclick={(e) => e.stopPropagation()}
										class="text-xs bg-transparent border border-transparent hover:border-theme rounded px-1 py-0.5 text-text-theme-secondary cursor-pointer transition-colors
											{issue.priority === 'critical' ? '!text-red-500 font-semibold' : issue.priority === 'high' ? '!text-orange-500 font-semibold' : ''}"
									>
										<option value="low">low</option>
										<option value="normal">normal</option>
										<option value="high">high</option>
										<option value="critical">critical</option>
									</select>
								</div>
								<span class="text-xs text-text-theme-tertiary truncate">{issue.reported_by || '—'}</span>
								<span class="text-xs text-text-theme-tertiary tabular-nums">{issue.age_days}d</span>
							</button>

							<!-- Expanded detail -->
							{#if isExpanded}
								<div class="px-3 pb-3 pt-2 ml-7 space-y-2">
									{#if issue.description}
										<p class="text-sm text-text-theme-secondary whitespace-pre-wrap leading-relaxed max-w-prose">{@html linkifyDocIds(issue.description)}</p>
									{/if}
									{#if issue.images?.length}
										<div class="flex items-center gap-1.5 text-xs text-text-theme-secondary">
											<Image size={12} />
											<span>Screenshots ({issue.images.length})</span>
										</div>
										<ImageGallery images={issue.images} galleryId="issue-{issue.full_id}" />
									{/if}
									<div class="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-text-theme-tertiary items-center">
										<span class="inline-flex items-center gap-1">
											<code class="bg-surface-secondary px-1.5 py-0.5 rounded text-text-theme-secondary font-mono">{issue.full_id.slice(0, 8)}</code>
											<button
												class="text-text-theme-tertiary hover:text-text-theme-primary transition-colors"
												title="Copy full issue ID"
												onclick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(issue.full_id); const btn = e.currentTarget; btn.textContent = '✓'; setTimeout(() => btn.textContent = '⎘', 1200); }}
											>⎘</button>
										</span>
										<span>Filed {formatDate(issue.created_at)}</span>
										{#if issue.search_query}
											<span>Query: <code class="bg-surface-secondary px-1.5 py-0.5 rounded text-text-theme-secondary">{issue.search_query}</code></span>
										{/if}
										{#if issue.url_example}
											<a href={issue.url_example} target="_blank" rel="noopener" class="text-interactive hover:underline inline-flex items-center gap-1">
												Example URL <ExternalLink size={10} />
											</a>
										{/if}
										{#if issue.resolution}
											<span class="text-green-600 dark:text-green-400">Resolution: {issue.resolution}</span>
										{/if}
										{#if issue.fixed_in_version}
											<span>Fixed in {issue.fixed_in_version}</span>
										{/if}
										{#if issue.reporter_review_status}
											<span class="px-1.5 py-0.5 rounded {reviewColor(issue.reporter_review_status)}">{reviewLabel(issue.reporter_review_status)}</span>
										{/if}
									</div>
									{#if issue.review_steps}
										<div class="text-xs bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-md p-2 mt-1">
											<span class="font-medium text-violet-700 dark:text-violet-300">Review steps:</span>
											<span class="text-text-theme-secondary whitespace-pre-wrap ml-1">{@html linkifyDocIds(issue.review_steps)}</span>
										</div>
									{/if}
									{#if issue.notes && issue.notes.length > 0}
										<div class="space-y-1.5 mt-2">
											<div class="text-xs font-medium text-text-theme-secondary">Notes ({issue.notes.length})</div>
											{#each issue.notes as note}
												<div class="text-xs bg-surface-secondary rounded-md p-2.5">
													<div class="flex items-center gap-2 mb-1">
														<span class="font-medium text-text-theme-primary">{note.author}</span>
														<span class="text-text-theme-tertiary">{formatTimestamp(note.timestamp)}</span>
													</div>
													<p class="text-text-theme-secondary whitespace-pre-wrap leading-relaxed">{@html linkifyDocIds(note.text)}</p>
													{#if note.images?.length}
														<ImageGallery images={note.images} thumbnailSize={48} galleryId="note-{note.timestamp}" />
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<!-- Pagination -->
			{#if ld.total_pages > 1}
				<div class="flex items-center justify-between pt-1">
					<button
						onclick={() => listPage = Math.max(1, listPage - 1)}
						disabled={listPage <= 1}
						class="text-xs px-3 py-1.5 rounded-md border border-theme bg-surface-elevated text-text-theme-secondary hover:text-text-theme-primary hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					>Previous</button>
					<span class="text-xs text-text-theme-tertiary tabular-nums">Page {ld.page} of {ld.total_pages}</span>
					<button
						onclick={() => listPage = Math.min(ld.total_pages, listPage + 1)}
						disabled={listPage >= ld.total_pages}
						class="text-xs px-3 py-1.5 rounded-md border border-theme bg-surface-elevated text-text-theme-secondary hover:text-text-theme-primary hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					>Next</button>
				</div>
			{/if}
		{/if}
	{/if}
</div>
