<script lang="ts">
	// Every organization, searchable and sortable. State lives in the URL so a
	// filtered view ("gone quiet", "review due") can be linked from the overview
	// and bookmarked.
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
	import { derived } from 'svelte/store';
	import { orgAccessApi, type OrgListParams } from '$lib/services/org-access-api';
	import { FILTER_FLAGS, flagInfo, fmtNumber, orgTypeLabel, relativeDays, TONE_CLASSES } from '$lib/utils/org-access';
	import FlagChip from '$lib/components/org-access/FlagChip.svelte';
	import RouteChip from '$lib/components/org-access/RouteChip.svelte';
	import Chip from '$lib/components/org-access/Chip.svelte';
	import { Plus } from 'lucide-svelte';

	const PER = 50;

	function paramsFrom(sp: URLSearchParams): OrgListParams {
		return {
			q: sp.get('q') || undefined,
			status: (sp.get('status') as OrgListParams['status']) || 'all',
			flag: sp.get('flag') || undefined,
			sort: (sp.get('sort') as OrgListParams['sort']) || 'name',
			page: Number(sp.get('page') || '1'),
			per: PER
		};
	}

	const listQuery = createQuery(
		derived(page, ($p) => {
			const params = paramsFrom($p.url.searchParams);
			return {
				queryKey: ['org-access', 'organizations', params],
				queryFn: () => orgAccessApi.listOrganizations(params),
				placeholderData: keepPreviousData
			};
		})
	);

	let params = $derived(paramsFrom($page.url.searchParams));
	let search = $state($page.url.searchParams.get('q') ?? '');
	let data = $derived($listQuery.data);
	let pages = $derived(data ? Math.max(1, Math.ceil(data.total / (data.per || PER))) : 1);

	// "flagged" is the overview's "addresses worth a second look" link: any
	// address flag. Not a chip of its own, but shown as active when present.
	let flagLabel = $derived(params.flag === 'flagged' ? 'Any flagged address' : params.flag ? flagInfo(params.flag).label : null);

	function setParams(changes: Record<string, string | number | null | undefined>, resetPage = true) {
		const sp = new URLSearchParams($page.url.searchParams);
		for (const [k, v] of Object.entries(changes)) {
			if (v === null || v === undefined || v === '') sp.delete(k);
			else sp.set(k, String(v));
		}
		if (resetPage && !('page' in changes)) sp.delete('page');
		const qs = sp.toString();
		goto(`${base}/org-access/orgs${qs ? `?${qs}` : ''}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	$effect(() => {
		const v = search.trim();
		const t = setTimeout(() => {
			if (v !== ($page.url.searchParams.get('q') ?? '')) setParams({ q: v });
		}, 300);
		return () => clearTimeout(t);
	});
</script>

<div class="mb-4 flex flex-wrap items-center gap-3">
	<input
		type="search"
		bind:value={search}
		placeholder="Search by name…"
		aria-label="Search organizations by name"
		class="w-full max-w-xs rounded-md border border-border-theme bg-surface-elevated px-3 py-2 text-sm text-text-theme-primary"
	/>
	<label class="flex items-center gap-1.5 text-xs text-text-theme-secondary">
		Show
		<select
			value={params.status}
			onchange={(e) => setParams({ status: (e.currentTarget as HTMLSelectElement).value })}
			class="rounded-md border border-border-theme bg-surface-elevated px-2 py-1.5 text-sm text-text-theme-primary"
		>
			<option value="all">All</option>
			<option value="enabled">Turned on</option>
			<option value="disabled">Turned off</option>
		</select>
	</label>
	<label class="flex items-center gap-1.5 text-xs text-text-theme-secondary">
		Sort by
		<select
			value={params.sort}
			onchange={(e) => setParams({ sort: (e.currentTarget as HTMLSelectElement).value })}
			class="rounded-md border border-border-theme bg-surface-elevated px-2 py-1.5 text-sm text-text-theme-primary"
		>
			<option value="name">Name</option>
			<option value="activity">Most visits</option>
			<option value="last_seen">Last seen</option>
		</select>
	</label>
	<a href="{base}/org-access/orgs/new" class="btn btn-primary ml-auto text-sm"><Plus size={14} /> New organization</a>
</div>

<div class="mb-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by flag">
	<span class="mr-1 text-xs text-text-theme-tertiary">Only show:</span>
	{#each FILTER_FLAGS as f}
		{@const info = flagInfo(f)}
		<button
			type="button"
			aria-pressed={params.flag === f}
			title={info.help}
			onclick={() => setParams({ flag: params.flag === f ? null : f })}
			class="rounded-full border px-2.5 py-1 text-xs transition-colors
				{params.flag === f
				? TONE_CLASSES[info.tone] + ' font-medium'
				: 'border-border-theme text-text-theme-secondary hover:bg-surface-secondary'}"
		>
			{info.label}
		</button>
	{/each}
	{#if flagLabel}
		<button type="button" class="ml-1 text-xs text-interactive hover:underline" onclick={() => setParams({ flag: null })}>
			Clear “{flagLabel}”
		</button>
	{/if}
</div>

{#if $listQuery.isPending}
	<p class="text-sm text-text-theme-secondary">Loading…</p>
{:else if $listQuery.isError}
	<p class="text-sm text-error" role="alert">Couldn’t load organizations: {$listQuery.error.message}</p>
{:else if data}
	<p class="mb-2 text-xs text-text-theme-secondary">
		{fmtNumber(data.total)}
		{data.total === 1 ? 'organization' : 'organizations'}{params.q ? ` matching “${params.q}”` : ''}{flagLabel
			? ` · ${flagLabel}`
			: ''}
	</p>
	{#if data.organizations.length === 0}
		<p class="card rounded-md p-6 text-center text-sm text-text-theme-secondary">
			No organizations match. <a href="{base}/org-access/orgs/new" class="text-interactive hover:underline"
				>Add a new one</a
			>?
		</p>
	{:else}
		<div class="card overflow-x-auto rounded-md">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border-theme text-left text-xs text-text-theme-tertiary">
						<th class="px-3 py-2 font-medium">Organization</th>
						<th class="px-3 py-2 font-medium">Type</th>
						<th class="px-3 py-2 font-medium">Addresses on</th>
						<th class="px-3 py-2 font-medium">How they connect</th>
						<th class="px-3 py-2 text-right font-medium">Visits (7 / 30 days)</th>
						<th class="px-3 py-2 font-medium">Last seen</th>
						<th class="px-3 py-2 font-medium">Flags</th>
					</tr>
				</thead>
				<tbody>
					{#each data.organizations as o (o.id)}
						<tr class="border-b border-border-theme last:border-0 hover:bg-surface-secondary {o.disabled ? 'opacity-70' : ''}">
							<td class="px-3 py-2">
								<a href="{base}/org-access/orgs/{o.id}" class="font-medium text-interactive hover:underline">{o.name}</a>
								{#if o.disabled}<span class="ml-1"><Chip>Turned off</Chip></span>{/if}
							</td>
							<td class="px-3 py-2 text-text-theme-secondary">{orgTypeLabel(o.org_type)}</td>
							<td class="px-3 py-2 tabular-nums text-text-theme-secondary">{o.rules_enabled} of {o.rules_total}</td>
							<td class="px-3 py-2">
								<div class="flex flex-wrap gap-1">
									{#each o.routes as r}<RouteChip route={r} />{/each}
								</div>
							</td>
							<td class="px-3 py-2 text-right tabular-nums text-text-theme-primary">
								{fmtNumber(o.visits_7d)} / {fmtNumber(o.visits_30d)}
							</td>
							<td class="whitespace-nowrap px-3 py-2 text-text-theme-secondary">{relativeDays(o.last_seen_at)}</td>
							<td class="px-3 py-2">
								<div class="flex flex-wrap gap-1">
									{#each o.flags as f}<FlagChip flag={f} />{/each}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if pages > 1}
			<nav class="mt-3 flex items-center justify-end gap-2 text-sm" aria-label="Pages">
				<button
					class="btn btn-outline text-xs disabled:opacity-40"
					disabled={params.page! <= 1}
					onclick={() => setParams({ page: params.page! - 1 }, false)}>Previous</button
				>
				<span class="text-text-theme-secondary">Page {params.page} of {pages}</span>
				<button
					class="btn btn-outline text-xs disabled:opacity-40"
					disabled={params.page! >= pages}
					onclick={() => setParams({ page: params.page! + 1 }, false)}>Next</button
				>
			</nav>
		{/if}
	{/if}
{/if}
