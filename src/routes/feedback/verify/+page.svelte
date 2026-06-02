<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { inkApi, type VerifyQueueItem } from '$lib/services/ink-api';
	import {
		ChevronDown, ChevronRight, ExternalLink, Image, Check, X, Send,
		CheckCircle2, Inbox, MessageSquare, Paperclip, Loader2
	} from 'lucide-svelte';
	import ImageGallery from '$lib/components/ImageGallery.svelte';
	import { base } from '$app/paths';
	import { renderMarkdown } from '$lib/utils/markdown';

	const queryClient = useQueryClient();

	// Identity (who am I + am I a known reporter) and the queue itself.
	const meQuery = createQuery({ queryKey: ['ink', 'me'], queryFn: () => inkApi.getMe() });
	const queueQuery = createQuery({ queryKey: ['ink', 'verify-queue'], queryFn: () => inkApi.getVerifyQueue() });

	// ── UI state ──
	let expandedIds = $state<Set<string>>(new Set());
	let sortKey = $state<'priority' | 'newest' | 'oldest' | 'title'>('priority');
	let filterText = $state('');
	let showRecent = $state(false);

	// Reject panel (one open at a time)
	let rejectingId = $state<string | null>(null);
	let rejectReason = $state('');
	let rejectFiles = $state<File[]>([]);

	// Lightweight toast (no shared component in INK yet)
	let toast = $state<{ msg: string; kind: 'ok' | 'err' } | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;
	function showToast(msg: string, kind: 'ok' | 'err' = 'ok') {
		toast = { msg, kind };
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => { toast = null; }, 3500);
	}

	function refresh() {
		queryClient.invalidateQueries({ queryKey: ['ink', 'verify-queue'] });
		queryClient.invalidateQueries({ queryKey: ['ink', 'me'] });
	}

	// ── Mutations ── (all share the model methods the Slack path calls)
	const confirmMutation = createMutation({
		mutationFn: (id: string) => inkApi.confirmIssue(id),
		onSuccess: () => { showToast('Marked as fixed — thanks for confirming.'); refresh(); },
		onError: (e) => showToast(e instanceof Error ? e.message : 'Could not confirm — try again.', 'err')
	});

	const rejectMutation = createMutation({
		mutationFn: ({ id, reason, files }: { id: string; reason: string; files: File[] }) =>
			inkApi.rejectIssue(id, reason, files),
		onSuccess: () => { showToast('Reopened — the team has been notified.'); cancelReject(); refresh(); },
		onError: (e) => showToast(e instanceof Error ? e.message : 'Could not submit — try again.', 'err')
	});

	const resendMutation = createMutation({
		mutationFn: (id: string) => inkApi.resendReviewDm(id),
		onSuccess: () => showToast('Sent to your Slack DMs.'),
		onError: (e) => showToast(e instanceof Error ? e.message : 'Could not send the DM.', 'err')
	});

	const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3, none: 4 };

	// Client-side sort + filter over the (small) pending list.
	const pending = $derived($queueQuery.data?.results ?? []);
	const recent = $derived($queueQuery.data?.recent ?? []);
	const visible = $derived(
		pending
			.filter((i) => !filterText.trim() || i.title.toLowerCase().includes(filterText.trim().toLowerCase()))
			.slice()
			.sort((a, b) => {
				switch (sortKey) {
					case 'priority':
						return (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
					case 'newest':
						return (b.resolved_at ?? '').localeCompare(a.resolved_at ?? '');
					case 'oldest':
						return (a.resolved_at ?? '').localeCompare(b.resolved_at ?? '');
					case 'title':
						return a.title.localeCompare(b.title);
				}
			})
	);

	function toggleExpanded(id: string) {
		const next = new Set(expandedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expandedIds = next;
	}

	function startReject(id: string) {
		rejectingId = id;
		rejectReason = '';
		rejectFiles = [];
	}
	function cancelReject() {
		rejectingId = null;
		rejectReason = '';
		rejectFiles = [];
	}
	function onRejectFiles(e: Event) {
		const input = e.target as HTMLInputElement;
		rejectFiles = input.files ? Array.from(input.files) : [];
	}
	function submitReject(id: string) {
		const reason = rejectReason.trim();
		if (!reason) { showToast('Please say what is still wrong.', 'err'); return; }
		$rejectMutation.mutate({ id, reason, files: rejectFiles });
	}

	function priorityChip(p: string): string {
		switch (p) {
			case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
			case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
			case 'low': return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
			case 'none': return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
			default: return 'bg-surface-secondary text-text-theme-secondary';
		}
	}

	function reviewLabel(status: string | null): string {
		switch (status) {
			case 'confirmed': return 'Confirmed';
			case 'rejected': return 'Rejected';
			default: return status ?? '';
		}
	}
	function reviewColor(status: string | null): string {
		switch (status) {
			case 'confirmed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
			case 'rejected': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
			default: return 'bg-surface-secondary text-text-theme-tertiary';
		}
	}

	function formatTimestamp(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}
</script>

<svelte:head><title>Verify Fixes · INK</title></svelte:head>

<div class="max-w-3xl mx-auto px-4 py-6">
	<!-- Header -->
	<div class="flex items-start justify-between gap-3 mb-1">
		<div>
			<h1 class="text-lg font-semibold text-text-theme-primary flex items-center gap-2">
				<CheckCircle2 size={18} class="text-interactive" />
				Verify Fixes
			</h1>
			<p class="text-xs text-text-theme-secondary mt-0.5 max-w-prose">
				Fixes for issues you reported are ready to check. Test each one, then
				<span class="text-text-theme-primary font-medium">Accept</span> if it's resolved or
				<span class="text-text-theme-primary font-medium">Reject</span> (with a note) to send it back.
				You can do this here or reply to the Slack DMs — both work.
			</p>
		</div>
		<a
			href="{base}/feedback"
			class="text-xs text-text-theme-tertiary hover:text-text-theme-primary transition-colors inline-flex items-center gap-1 flex-shrink-0 mt-1"
		>
			<MessageSquare size={13} /> All feedback
		</a>
	</div>

	{#if $queueQuery.isPending || $meQuery.isPending}
		<div class="py-16 text-center text-sm text-text-theme-tertiary">Loading your queue…</div>
	{:else if $queueQuery.isError}
		<div class="py-16 text-center text-sm text-red-600 dark:text-red-400">
			Couldn't load your queue. {$queueQuery.error instanceof Error ? $queueQuery.error.message : ''}
		</div>
	{:else if $queueQuery.data && !$queueQuery.data.linked}
		<!-- Unlinked: this account isn't a known reporter -->
		<div class="mt-8 rounded-lg border border-theme bg-surface-elevated p-6 text-center">
			<Inbox size={28} class="mx-auto text-text-theme-tertiary mb-2" />
			<div class="text-sm text-text-theme-primary font-medium">Your account isn't linked to a reporter yet</div>
			<p class="text-xs text-text-theme-secondary mt-1 max-w-md mx-auto">
				The verification queue shows fixes for issues filed under your name. If you've reported issues
				and don't see them here, ask an admin to link your account.
			</p>
		</div>
	{:else}
		<!-- Controls -->
		<div class="flex items-center gap-2 mt-4 mb-3">
			<input
				type="text"
				bind:value={filterText}
				placeholder="Filter…"
				class="flex-1 text-xs bg-surface-elevated border border-theme rounded-md px-2.5 py-1.5 text-text-theme-primary placeholder:text-text-theme-tertiary focus:outline-none focus:border-interactive transition-colors"
			/>
			<select
				bind:value={sortKey}
				class="text-xs bg-surface-elevated border border-theme rounded-md px-2 py-1.5 text-text-theme-secondary cursor-pointer focus:outline-none focus:border-interactive"
				aria-label="Sort"
			>
				<option value="priority">Priority</option>
				<option value="newest">Newest</option>
				<option value="oldest">Oldest</option>
				<option value="title">Title</option>
			</select>
			<span class="text-xs text-text-theme-tertiary tabular-nums whitespace-nowrap">{visible.length} to verify</span>
		</div>

		{#if visible.length === 0}
			<!-- Caught up -->
			<div class="mt-6 rounded-lg border border-theme bg-surface-elevated p-8 text-center">
				<CheckCircle2 size={30} class="mx-auto text-green-500 mb-2" />
				<div class="text-sm text-text-theme-primary font-medium">You're all caught up</div>
				<p class="text-xs text-text-theme-secondary mt-1">Nothing waiting for your verification right now.</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each visible as issue (issue.full_id)}
					{@const isExpanded = expandedIds.has(issue.full_id)}
					{@const isRejecting = rejectingId === issue.full_id}
					{@const busy = $confirmMutation.isPending || $rejectMutation.isPending}
					<div class="rounded-lg border border-theme overflow-hidden bg-surface-elevated">
						<!-- Summary row -->
						<button
							class="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-secondary transition-colors"
							onclick={() => toggleExpanded(issue.full_id)}
						>
							{#if isExpanded}
								<ChevronDown size={14} class="text-text-theme-secondary flex-shrink-0" />
							{:else}
								<ChevronRight size={14} class="text-text-theme-tertiary flex-shrink-0" />
							{/if}
							<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide {priorityChip(issue.priority)}">{issue.priority}</span>
							<span class="text-sm text-text-theme-primary flex-1 truncate">{issue.title}</span>
							{#if issue.is_active}
								<span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 inline-flex items-center gap-1 flex-shrink-0" title="This is the one the Slack bot is currently asking you about">
									<MessageSquare size={10} /> In Slack
								</span>
							{/if}
							<code class="text-[10px] font-mono text-text-theme-tertiary bg-surface-secondary rounded px-1.5 py-0.5 flex-shrink-0">{issue.id}</code>
						</button>

						{#if isExpanded}
							<div class="border-t border-theme px-3 py-3 space-y-3 bg-surface">
								<!-- What changed -->
								{#if issue.resolution}
									<div class="text-xs">
										<span class="font-semibold text-text-theme-secondary uppercase tracking-wider text-[10px]">What we changed</span>
										<div class="text-text-theme-secondary mt-0.5 leading-relaxed">{issue.resolution}</div>
										{#if issue.fixed_in_version}
											<div class="text-text-theme-tertiary mt-0.5">Fixed in {issue.fixed_in_version}</div>
										{/if}
									</div>
								{/if}

								<!-- Test it -->
								{#if issue.test_url}
									<a
										href={issue.test_url}
										target="_blank"
										rel="noopener"
										class="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-interactive/40 bg-interactive/5 hover:bg-interactive/10 text-interactive transition-colors"
									>
										<ExternalLink size={12} class="flex-shrink-0" /> Test it now
									</a>
								{/if}

								<!-- How to verify -->
								{#if issue.review_steps}
									<div class="text-xs bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-md p-2.5">
										<div class="font-semibold text-violet-700 dark:text-violet-300 mb-1 uppercase tracking-wider text-[10px]">How to verify</div>
										<div class="markdown-block text-text-theme-secondary">{@html renderMarkdown(issue.review_steps)}</div>
									</div>
								{/if}

								<!-- Screenshots on the issue -->
								{#if issue.images?.length}
									<div class="space-y-1.5">
										<div class="flex items-center gap-1.5 text-xs text-text-theme-secondary">
											<Image size={12} /> <span>Screenshots ({issue.images.length})</span>
										</div>
										<ImageGallery images={issue.images} galleryId="verify-issue-{issue.full_id}" />
									</div>
								{/if}

								<!-- Notes (collapsed-feeling, low weight) -->
								{#if issue.notes && issue.notes.length > 0}
									<details class="text-xs">
										<summary class="cursor-pointer text-text-theme-tertiary hover:text-text-theme-secondary select-none">History ({issue.notes.length})</summary>
										<div class="space-y-1.5 mt-1.5">
											{#each issue.notes as note}
												<div class="bg-surface-secondary rounded-md p-2.5">
													<div class="flex items-center gap-2 mb-1">
														<span class="font-medium text-text-theme-primary">{note.author}</span>
														<span class="text-text-theme-tertiary">{formatTimestamp(note.timestamp)}</span>
													</div>
													<div class="markdown-block text-text-theme-secondary leading-relaxed">{@html renderMarkdown(note.text)}</div>
													{#if note.images?.length}
														<ImageGallery images={note.images} thumbnailSize={48} galleryId="verify-note-{note.timestamp}" />
													{/if}
												</div>
											{/each}
										</div>
									</details>
								{/if}

								<!-- Reject panel -->
								{#if isRejecting}
									<div class="rounded-md border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-900/15 p-2.5 space-y-2">
										<div class="text-[10px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">What's still wrong?</div>
										<textarea
											bind:value={rejectReason}
											rows="3"
											placeholder="Describe what didn't work — this reopens the issue and goes to the team."
											class="w-full text-xs bg-surface-elevated border border-theme rounded px-2 py-1.5 text-text-theme-primary placeholder:text-text-theme-tertiary focus:outline-none focus:border-red-400 resize-y"
										></textarea>
										<div class="flex items-center justify-between gap-2 flex-wrap">
											<label class="inline-flex items-center gap-1.5 text-xs text-text-theme-secondary cursor-pointer hover:text-text-theme-primary transition-colors">
												<Paperclip size={12} />
												<span>{rejectFiles.length ? `${rejectFiles.length} file${rejectFiles.length > 1 ? 's' : ''} attached` : 'Attach screenshots'}</span>
												<input type="file" accept="image/*" multiple class="hidden" onchange={onRejectFiles} />
											</label>
											<div class="flex items-center gap-2">
												<button
													onclick={cancelReject}
													class="text-xs px-2.5 py-1 rounded text-text-theme-secondary hover:bg-surface-secondary transition-colors"
												>Cancel</button>
												<button
													onclick={() => submitReject(issue.full_id)}
													disabled={$rejectMutation.isPending}
													class="text-xs font-medium px-3 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
												>
													{#if $rejectMutation.isPending}<Loader2 size={12} class="animate-spin" />{:else}<X size={12} />{/if}
													Reject &amp; reopen
												</button>
											</div>
										</div>
									</div>
								{:else}
									<!-- Action footer -->
									<div class="flex items-center gap-2 flex-wrap pt-1 border-t border-theme/50">
										<button
											onclick={() => $confirmMutation.mutate(issue.full_id)}
											disabled={busy}
											class="text-xs font-medium px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
										>
											{#if $confirmMutation.isPending && $confirmMutation.variables === issue.full_id}<Loader2 size={12} class="animate-spin" />{:else}<Check size={12} />{/if}
											Accept — it's fixed
										</button>
										<button
											onclick={() => startReject(issue.full_id)}
											disabled={busy}
											class="text-xs font-medium px-3 py-1.5 rounded-md border border-theme hover:bg-surface-secondary text-text-theme-secondary transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
										>
											<X size={12} /> Reject
										</button>
										<button
											onclick={() => $resendMutation.mutate(issue.full_id)}
											disabled={$resendMutation.isPending}
											class="text-xs px-2.5 py-1.5 rounded-md text-text-theme-tertiary hover:text-text-theme-primary hover:bg-surface-secondary transition-colors inline-flex items-center gap-1.5 ml-auto disabled:opacity-50"
											title="Re-send this item's review message to your Slack DMs"
										>
											{#if $resendMutation.isPending && $resendMutation.variables === issue.full_id}<Loader2 size={12} class="animate-spin" />{:else}<Send size={12} />{/if}
											Send to my Slack
										</button>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Recently reviewed (read-only history) -->
		{#if recent.length > 0}
			<div class="mt-6">
				<button
					onclick={() => (showRecent = !showRecent)}
					class="text-xs text-text-theme-tertiary hover:text-text-theme-secondary inline-flex items-center gap-1.5 transition-colors"
				>
					{#if showRecent}<ChevronDown size={13} />{:else}<ChevronRight size={13} />{/if}
					Recently reviewed ({recent.length})
				</button>
				{#if showRecent}
					<div class="mt-2 space-y-1">
						{#each recent as issue (issue.full_id)}
							<div class="flex items-center gap-2.5 px-3 py-1.5 rounded-md border border-theme/60 text-xs">
								<span class="px-1.5 py-0.5 rounded {reviewColor(issue.reporter_review_status)} flex-shrink-0">{reviewLabel(issue.reporter_review_status)}</span>
								<span class="text-text-theme-secondary flex-1 truncate">{issue.title}</span>
								{#if issue.test_url}
									<a href={issue.test_url} target="_blank" rel="noopener" class="text-interactive hover:underline inline-flex items-center gap-1 flex-shrink-0">
										<ExternalLink size={11} /> open
									</a>
								{/if}
								<code class="text-[10px] font-mono text-text-theme-tertiary bg-surface-secondary rounded px-1.5 py-0.5 flex-shrink-0">{issue.id}</code>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<!-- Toast -->
{#if toast}
	<div
		class="fixed bottom-4 right-4 z-50 px-3.5 py-2 rounded-md text-xs font-medium border
			{toast.kind === 'ok'
				? 'bg-surface-elevated border-green-300 dark:border-green-700 text-text-theme-primary'
				: 'bg-surface-elevated border-red-300 dark:border-red-700 text-text-theme-primary'}"
		role="status"
	>
		{toast.msg}
	</div>
{/if}

<style>
	/* Compact markdown styling — mirrors the feedback tracker so review steps,
	   resolutions, and note bodies render the same here. */
	.markdown-block :global(p) { margin: 0 0 0.5em; }
	.markdown-block :global(p:last-child) { margin-bottom: 0; }
	.markdown-block :global(ul),
	.markdown-block :global(ol) { margin: 0.25em 0 0.5em; padding-left: 1.5em; }
	.markdown-block :global(ul) { list-style: disc; }
	.markdown-block :global(ol) { list-style: decimal; }
	.markdown-block :global(li) { margin: 0.15em 0; }
	.markdown-block :global(li > p) { margin: 0; }
	.markdown-block :global(a) { color: var(--color-interactive); text-decoration: underline; text-underline-offset: 2px; }
	.markdown-block :global(a:hover) { text-decoration-thickness: 2px; }
	.markdown-block :global(strong) { color: var(--color-text-primary); font-weight: 600; }
	.markdown-block :global(em) { font-style: italic; }
	.markdown-block :global(code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		background: var(--color-surface-secondary);
		padding: 0.05em 0.35em;
		border-radius: 3px;
		font-size: 0.92em;
	}
	.markdown-block :global(pre) {
		background: var(--color-surface-secondary);
		padding: 0.5em 0.75em;
		border-radius: 4px;
		overflow-x: auto;
		margin: 0.5em 0;
	}
	.markdown-block :global(pre code) { background: transparent; padding: 0; }
	.markdown-block :global(blockquote) {
		border-left: 2px solid var(--color-surface-secondary);
		padding-left: 0.75em;
		margin: 0.5em 0;
		color: var(--color-text-tertiary);
	}
	.markdown-block :global(h1),
	.markdown-block :global(h2),
	.markdown-block :global(h3) {
		font-weight: 600;
		color: var(--color-text-primary);
		margin: 0.5em 0 0.25em;
	}
</style>
