<script lang="ts">
	// Org access overview: how much is set up, how much is used, what needs a
	// look, and a tester for the most common question ("why doesn't this person
	// get org access?").
	import { base } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { orgAccessApi } from '$lib/services/org-access-api';
	import { fmtDate, fmtNumber, routeLabel } from '$lib/utils/org-access';
	import IpTester from '$lib/components/org-access/IpTester.svelte';
	import { Inbox, Moon, AlertTriangle, CalendarClock, ChevronRight } from 'lucide-svelte';

	const summaryQuery = createQuery({
		queryKey: ['org-access', 'summary'],
		queryFn: () => orgAccessApi.summary()
	});

	let s = $derived($summaryQuery.data);
	// The link opens a list of organizations, so say how many it will show.
	const atOrgs = (n?: number) => (n == null ? '' : `, at ${fmtNumber(n)} ${n === 1 ? 'organization' : 'organizations'}`);
	let routeEntries = $derived(
		s ? Object.entries(s.rules.by_route).filter(([, n]) => (n ?? 0) > 0).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) : []
	);
	let attention = $derived(
		s
			? [
					{
						n: s.attention.pending_requests,
						label: 'requests waiting for a decision',
						one: 'request waiting for a decision',
						href: `${base}/org-access/requests`,
						icon: Inbox
					},
					{
						n: s.attention.gone_quiet,
						label: `organizations that used to have visitors, but none in the last ${s.activity.window_days} days`,
						one: `organization that used to have visitors, but none in the last ${s.activity.window_days} days`,
						href: `${base}/org-access/orgs?flag=gone_quiet`,
						icon: Moon
					},
					{
						n: s.attention.flagged_rules,
						label: `addresses worth a second look${atOrgs(s.attention.flagged_orgs)} (very broad, overlapping, shared proxies…)`,
						one: `address worth a second look${atOrgs(s.attention.flagged_orgs)} (very broad, overlapping, shared proxy…)`,
						href: `${base}/org-access/orgs?flag=flagged_rules`,
						icon: AlertTriangle
					},
					{
						n: s.attention.review_due,
						label: 'organizations past their review date',
						one: 'organization past its review date',
						href: `${base}/org-access/orgs?flag=review_due`,
						icon: CalendarClock
					}
				]
			: []
	);
</script>

{#if $summaryQuery.isPending}
	<p class="text-sm text-text-theme-secondary">Loading…</p>
{:else if $summaryQuery.isError}
	<p class="text-sm text-error" role="alert">Couldn’t load the overview: {$summaryQuery.error.message}</p>
	<button class="btn btn-outline mt-2 text-xs" onclick={() => $summaryQuery.refetch()}>Try again</button>
{:else if s}
	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<a href="{base}/org-access/orgs" class="card rounded-md p-4 hover:bg-surface-secondary">
			<p class="text-xs text-text-theme-secondary">Organizations turned on</p>
			<p class="mt-1 text-2xl font-semibold tabular-nums text-text-theme-primary">{fmtNumber(s.organizations.enabled)}</p>
			<p class="mt-1 text-xs text-text-theme-tertiary">
				{fmtNumber(s.organizations.with_enabled_rules)} with active addresses · {fmtNumber(s.organizations.total)} on file
			</p>
		</a>
		<div class="card rounded-md p-4">
			<p class="text-xs text-text-theme-secondary">Network addresses turned on</p>
			<p class="mt-1 text-2xl font-semibold tabular-nums text-text-theme-primary">{fmtNumber(s.rules.enabled)}</p>
			<p class="mt-1 text-xs text-text-theme-tertiary">
				{fmtNumber(s.rules.by_kind.cidr)} ranges · {fmtNumber(s.rules.by_kind.domain)} host names · {fmtNumber(s.rules.total)} on file
			</p>
		</div>
		<div class="card rounded-md p-4">
			<p class="text-xs text-text-theme-secondary">Visits in the last {s.activity.window_days} days</p>
			<p class="mt-1 text-2xl font-semibold tabular-nums text-text-theme-primary">{fmtNumber(s.activity.visits)}</p>
			<p class="mt-1 text-xs text-text-theme-tertiary">
				from {fmtNumber(s.activity.orgs_seen)}
				{s.activity.orgs_seen === 1 ? 'organization' : 'organizations'} since {fmtDate(s.activity.since)}
			</p>
		</div>
		<a href="{base}/org-access/requests" class="card rounded-md p-4 hover:bg-surface-secondary">
			<p class="text-xs text-text-theme-secondary">Requests waiting</p>
			<p class="mt-1 text-2xl font-semibold tabular-nums text-text-theme-primary">
				{fmtNumber(s.attention.pending_requests)}
			</p>
			<p class="mt-1 text-xs text-text-theme-tertiary">from the request form on the public site</p>
		</a>
	</div>

	<section class="card mt-5 rounded-md p-4">
		<h2 class="text-sm font-semibold text-text-theme-primary">Test an address</h2>
		<p class="mb-3 text-xs text-text-theme-secondary">
			Someone says they don’t get organization access? Paste the address they sent (they can find it on the
			“check access” page) and see what they get, and why.
		</p>
		<IpTester compact />
	</section>

	<div class="mt-5 grid gap-5 lg:grid-cols-2">
		<section class="card rounded-md p-4">
			<h2 class="mb-2 text-sm font-semibold text-text-theme-primary">Needs attention</h2>
			{#if attention.every((a) => a.n === 0)}
				<p class="text-sm text-text-theme-secondary">Nothing right now.</p>
			{:else}
				<ul class="divide-y divide-border-theme">
					{#each attention.filter((a) => a.n > 0) as a}
						{@const Icon = a.icon}
						<li>
							<a href={a.href} class="flex items-center gap-3 py-2 text-sm hover:bg-surface-secondary">
								<Icon size={16} class="flex-shrink-0 text-text-theme-tertiary" />
								<span class="flex-1 text-text-theme-primary">
									<strong class="tabular-nums">{fmtNumber(a.n)}</strong>
									{a.n === 1 ? a.one : a.label}
								</span>
								<ChevronRight size={14} class="text-text-theme-tertiary" />
							</a>
						</li>
					{/each}
				</ul>
				{#if s.attention.orgs_needing_attention}
					<!-- orgs_needing_attention is the size of the ?flag=flagged list it opens. -->
					<a href="{base}/org-access/orgs?flag=flagged" class="mt-2 inline-block text-xs text-interactive hover:underline">
						See all {fmtNumber(s.attention.orgs_needing_attention)}
						{s.attention.orgs_needing_attention === 1 ? 'organization' : 'organizations'} with something to check
					</a>
				{/if}
			{/if}
			{#if routeEntries.length}
				<h3 class="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-text-theme-tertiary">
					How organizations connect
				</h3>
				<p class="text-xs text-text-theme-secondary">
					{#each routeEntries as [route, n], i}
						{routeLabel(route)} {fmtNumber(n ?? 0)}{i < routeEntries.length - 1 ? ' · ' : ''}
					{/each}
				</p>
			{/if}
		</section>

		<section class="card rounded-md p-4">
			<div class="mb-2 flex items-baseline justify-between">
				<h2 class="text-sm font-semibold text-text-theme-primary">Most active, last {s.activity.window_days} days</h2>
				<a href="{base}/org-access/orgs?sort=activity" class="text-xs text-interactive hover:underline">All organizations</a>
			</div>
			{#if s.top_orgs.length === 0}
				<p class="text-sm text-text-theme-secondary">No organization visits recorded yet.</p>
			{:else}
				{@const top = Math.max(1, ...s.top_orgs.map((o) => o.visits))}
				<ol class="space-y-1.5">
					{#each s.top_orgs as o (o.id)}
						<li class="text-sm">
							<div class="flex justify-between gap-2">
								<a href="{base}/org-access/orgs/{o.id}" class="truncate text-interactive hover:underline">{o.name}</a>
								<span class="tabular-nums text-text-theme-secondary">{fmtNumber(o.visits)}</span>
							</div>
							<div class="mt-0.5 h-1 rounded-full bg-surface-secondary">
								<div class="h-1 rounded-full bg-interactive" style="width: {(o.visits / top) * 100}%"></div>
							</div>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	</div>
{/if}
