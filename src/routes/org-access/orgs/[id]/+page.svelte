<script lang="ts">
	// One organization: what visitors see, which addresses grant it, who has
	// been using it, and every change made to it. Nothing here deletes; turning
	// an organization or an address off keeps its history.
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { derived } from 'svelte/store';
	import {
		orgAccessApi,
		OrgAccessValidationError,
		messageText,
		type FieldErrors,
		type OrgEditable,
		type RuleFull
	} from '$lib/services/org-access-api';
	import {
		draftFromRule,
		draftToInput,
		emptyDraft,
		fmtDate,
		fmtDateTime,
		fmtNumber,
		orgTypeLabel,
		REQUEST_STATUS_INFO,
		relativeDays,
		HOST_NAME_CAUTION,
		ruleTarget,
		takeFlash,
		TONE_CLASSES,
		type RuleDraft,
		type Tone
	} from '$lib/utils/org-access';
	import BannerPreview from '$lib/components/org-access/BannerPreview.svelte';
	import FlagChip from '$lib/components/org-access/FlagChip.svelte';
	import RouteChip from '$lib/components/org-access/RouteChip.svelte';
	import Chip from '$lib/components/org-access/Chip.svelte';
	import AddressFields from '$lib/components/org-access/AddressFields.svelte';
	import OrgForm from '$lib/components/org-access/OrgForm.svelte';
	import ActivityChart from '$lib/components/org-access/ActivityChart.svelte';
	import HistoryList from '$lib/components/org-access/HistoryList.svelte';
	import { ArrowLeft, Plus, Pencil, Power } from 'lucide-svelte';

	const queryClient = useQueryClient();

	const orgQuery = createQuery(
		derived(page, ($p) => {
			const id = $p.params.id ?? '';
			return {
				queryKey: ['org-access', 'organization', id],
				queryFn: () => orgAccessApi.getOrganization(id)
			};
		})
	);

	let d = $derived($orgQuery.data);
	let org = $derived(d?.organization);
	let rules = $derived(d?.rules ?? []);
	let ruleById = $derived(new Map(rules.map((r) => [r.id, r])));
	let orgFlags = $derived.by(() => {
		if (!org) return [] as string[];
		// Only the organization-level flags here; each address shows its own.
		if (org.flags) return org.flags.filter((f) => ORG_FLAGS.includes(f));
		// Fallback for a server that omits flags. Same rules as the server's
		// Directory#org_flags: nothing for a turned-off org; gone_quiet means
		// visitors before the 30-day window and none inside it.
		const flags: string[] = [];
		if (org.disabled) return flags;
		const hasActive = rules.some((r) => !r.disabled);
		if (!hasActive) flags.push('no_enabled_rules');
		const daily = d?.activity.daily ?? [];
		const sum = (xs: typeof daily) => xs.reduce((n, x) => n + x.visits, 0);
		if (hasActive && sum(daily.slice(-30)) === 0 && sum(daily.slice(0, -30)) > 0) flags.push('gone_quiet');
		if (org.review_by && new Date(`${org.review_by}T23:59:59`) < new Date()) flags.push('review_due');
		return flags;
	});

	const ORG_FLAGS = ['no_enabled_rules', 'gone_quiet', 'review_due'];

	// Notices after a write: what the server warned about while saving. Starts
	// with any notice handed over by the approve flow.
	let notice = $state<{ tone: Tone; lines: string[] } | null>(takeFlash());

	async function refresh() {
		await queryClient.invalidateQueries({ queryKey: ['org-access'] });
	}

	// ── Organization details ──
	let editingDetails = $state(false);
	let detailsErrors = $state<FieldErrors>({});
	let savingDetails = $state(false);

	async function saveDetails(values: Partial<OrgEditable>) {
		if (!org) return;
		savingDetails = true;
		detailsErrors = {};
		try {
			await orgAccessApi.updateOrganization(org.id, values);
			editingDetails = false;
			notice = { tone: 'success', lines: ['Details saved.'] };
			await refresh();
		} catch (err) {
			if (err instanceof OrgAccessValidationError) detailsErrors = err.fields;
			else detailsErrors = { base: [err instanceof Error ? err.message : 'Could not save.'] };
		} finally {
			savingDetails = false;
		}
	}

	async function toggleOrg() {
		if (!org) return;
		const turningOff = !org.disabled;
		const msg = turningOff
			? `Turn off ${org.name}? Nobody will get organization access through it until it is turned back on. Its addresses and history are kept.`
			: `Turn ${org.name} back on? Visitors from its active addresses will get organization access again right away.`;
		if (!confirm(msg)) return;
		try {
			await orgAccessApi.updateOrganization(org.id, { disabled: turningOff });
			notice = { tone: 'success', lines: [turningOff ? `${org.name} is turned off.` : `${org.name} is turned on.`] };
			await refresh();
		} catch (err) {
			notice = { tone: 'error', lines: [err instanceof Error ? err.message : 'Could not change it.'] };
		}
	}

	// ── Addresses ──
	let adding = $state(false);
	let newDraft = $state<RuleDraft>(emptyDraft());
	let addErrors = $state<FieldErrors>({});
	let savingNew = $state(false);

	let editingRuleId = $state<number | null>(null);
	let editDraft = $state<RuleDraft>(emptyDraft());
	let editErrors = $state<FieldErrors>({});
	let busyRuleId = $state<number | null>(null);

	function savedNotice(target: string, warnings: unknown[] | undefined) {
		const lines = (warnings ?? []).map((w) => messageText(w as string)).filter(Boolean);
		notice = lines.length
			? { tone: 'warning', lines: [`Saved ${target}. Worth knowing:`, ...lines] }
			: { tone: 'success', lines: [`Saved ${target}. It takes effect within a few minutes.`] };
	}

	async function addRule(e: SubmitEvent) {
		e.preventDefault();
		if (!org || !newDraft.value.trim()) return;
		savingNew = true;
		addErrors = {};
		try {
			const saved = await orgAccessApi.createRule(org.id, draftToInput(newDraft));
			savedNotice(ruleTarget(saved) || newDraft.value.trim(), saved.warnings);
			newDraft = emptyDraft();
			adding = false;
			await refresh();
		} catch (err) {
			if (err instanceof OrgAccessValidationError) addErrors = err.fields;
			else addErrors = { base: [err instanceof Error ? err.message : 'Could not save.'] };
		} finally {
			savingNew = false;
		}
	}

	// A range that spans several networks: save each block as its own address,
	// one by one, with the route, note and reason typed for the range. Stops at
	// the first refusal and leaves that block (and the rest) in the form.
	async function addBlocks(blocks: string[]) {
		if (!org) return;
		const label = newDraft.value.trim();
		if (!confirm(`Add ${blocks.length} addresses for ${label}?\n\n${blocks.join('\n')}`)) return;
		savingNew = true;
		addErrors = {};
		const saved: string[] = [];
		const warnings: string[] = [];
		try {
			for (const [i, block] of blocks.entries()) {
				try {
					const res = await orgAccessApi.createRule(org.id, draftToInput({ ...newDraft, value: block }));
					saved.push(ruleTarget(res) || block);
					warnings.push(...(res.warnings ?? []).map((w) => messageText(w)).filter(Boolean));
				} catch (err) {
					const reason =
						err instanceof OrgAccessValidationError
							? Object.values(err.fields).flat().join(' ')
							: err instanceof Error
								? err.message
								: 'Could not save.';
					const left = blocks.slice(i);
					notice = {
						tone: 'error',
						lines: [
							saved.length ? `Saved ${saved.length} of ${blocks.length}: ${saved.join(', ')}.` : 'Nothing was saved.',
							`${block} was not saved: ${reason}`,
							...(left.length > 1 ? [`Still to add: ${left.join(', ')}.`] : [])
						]
					};
					newDraft = { ...newDraft, value: block };
					return;
				}
			}
			notice = warnings.length
				? { tone: 'warning', lines: [`Saved ${saved.length} addresses: ${saved.join(', ')}. Worth knowing:`, ...new Set(warnings)] }
				: { tone: 'success', lines: [`Saved ${saved.length} addresses: ${saved.join(', ')}. They take effect within a few minutes.`] };
			newDraft = emptyDraft();
			adding = false;
		} finally {
			savingNew = false;
			await refresh();
		}
	}

	function startEdit(r: RuleFull) {
		editingRuleId = r.id;
		editDraft = draftFromRule(r);
		editErrors = {};
	}

	async function saveEdit(e: SubmitEvent, r: RuleFull) {
		e.preventDefault();
		busyRuleId = r.id;
		editErrors = {};
		try {
			const saved = await orgAccessApi.updateRule(r.id, draftToInput(editDraft));
			savedNotice(ruleTarget(saved) || editDraft.value.trim(), saved.warnings);
			editingRuleId = null;
			await refresh();
		} catch (err) {
			if (err instanceof OrgAccessValidationError) editErrors = err.fields;
			else editErrors = { base: [err instanceof Error ? err.message : 'Could not save.'] };
		} finally {
			busyRuleId = null;
		}
	}

	async function toggleRule(r: RuleFull) {
		if (!org) return;
		const target = ruleTarget(r);
		const turningOff = !r.disabled;
		const msg = turningOff
			? `Turn off ${target}? Visitors from this address will stop seeing “Organization Access: ${org.name}”.`
			: `Turn ${target} back on? Visitors from it will get organization access as ${org.name} again.`;
		if (!confirm(msg)) return;
		busyRuleId = r.id;
		try {
			const saved = await orgAccessApi.updateRule(r.id, { disabled: turningOff });
			if (turningOff) notice = { tone: 'success', lines: [`${target} is turned off.`] };
			else savedNotice(target, saved.warnings);
			await refresh();
		} catch (err) {
			const lines =
				err instanceof OrgAccessValidationError
					? Object.values(err.fields).flat()
					: [err instanceof Error ? err.message : 'Could not change it.'];
			notice = { tone: 'error', lines };
		} finally {
			busyRuleId = null;
		}
	}
</script>

<a href="{base}/org-access/orgs" class="mb-3 inline-flex items-center gap-1 text-xs text-interactive hover:underline">
	<ArrowLeft size={12} /> All organizations
</a>

{#if $orgQuery.isPending}
	<p class="text-sm text-text-theme-secondary">Loading…</p>
{:else if $orgQuery.isError}
	<p class="text-sm text-error" role="alert">
		{$orgQuery.error.message === 'API error: 404 Not Found' ? 'There is no organization with this number.' : `Couldn’t load this organization: ${$orgQuery.error.message}`}
	</p>
{:else if d && org}
	<header class="mb-5 grid gap-4 lg:grid-cols-[1fr_22rem]">
		<div>
			<div class="flex flex-wrap items-center gap-2">
				<h2 class="text-2xl font-semibold text-text-theme-primary">{org.name}</h2>
				{#if org.disabled}<Chip tone="warning">Turned off</Chip>{/if}
				{#each orgFlags as f}<FlagChip flag={f} />{/each}
			</div>
			<p class="mt-1 text-sm text-text-theme-secondary">
				{orgTypeLabel(org.org_type)}{[org.city, org.state].filter(Boolean).length
					? ` · ${[org.city, org.state].filter(Boolean).join(', ')}`
					: ''}{org.jurisdiction ? ` · ${org.jurisdiction}` : ''}
				· {rules.filter((r) => !r.disabled).length} of {rules.length} addresses turned on
			</p>
			<div class="mt-3 flex flex-wrap gap-2">
				<button class="btn btn-outline text-xs" onclick={() => (editingDetails = !editingDetails)}>
					<Pencil size={12} /> Edit details
				</button>
				<button class="btn btn-outline text-xs" onclick={toggleOrg}>
					<Power size={12} />
					{org.disabled ? 'Turn organization on' : 'Turn organization off'}
				</button>
			</div>
		</div>
		<BannerPreview name={org.name} />
	</header>

	{#if notice}
		<div class="mb-4 rounded-md border px-3 py-2 text-sm {TONE_CLASSES[notice.tone]}" role="status">
			{#each notice.lines as line, i}
				<p class={i === 0 ? 'font-medium' : 'mt-0.5'}>{line}</p>
			{/each}
			<button class="mt-1 text-xs text-interactive hover:underline" onclick={() => (notice = null)}>Dismiss</button>
		</div>
	{/if}

	{#if editingDetails}
		<section class="card mb-5 rounded-md p-4">
			<h3 class="mb-3 text-sm font-semibold text-text-theme-primary">Edit details</h3>
			<OrgForm
				initial={org}
				errors={detailsErrors}
				submitting={savingDetails}
				showDisabled
				submitLabel="Save details"
				onSubmit={saveDetails}
				onCancel={() => {
					editingDetails = false;
					detailsErrors = {};
				}}
			/>
		</section>
	{/if}

	<!-- Network addresses -->
	<section class="card mb-5 rounded-md p-4">
		<div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
			<div>
				<h3 class="text-sm font-semibold text-text-theme-primary">Network addresses</h3>
				<p class="text-xs text-text-theme-secondary">
					Anyone visiting from these addresses counts as a registered user under our publishers’ terms.
				</p>
			</div>
			{#if !adding}
				<button class="btn btn-primary text-xs" onclick={() => (adding = true)}><Plus size={12} /> Add an address</button>
			{/if}
		</div>

		{#if adding}
			<form onsubmit={addRule} class="mb-4 rounded-md border border-border-theme bg-surface-secondary p-3">
				<AddressFields
					bind:draft={newDraft}
					organizationId={org.id}
					serverErrors={addErrors}
					idPrefix="new-addr"
					onSplit={addBlocks}
				/>
				<div class="mt-3 flex gap-2">
					<button type="submit" class="btn btn-primary text-sm disabled:opacity-50" disabled={savingNew || !newDraft.value.trim()}>
						{savingNew ? 'Saving…' : 'Save address'}
					</button>
					<button
						type="button"
						class="btn btn-outline text-sm"
						onclick={() => {
							adding = false;
							newDraft = emptyDraft();
							addErrors = {};
						}}>Cancel</button
					>
				</div>
			</form>
		{/if}

		{#if rules.length === 0}
			<p class="text-sm text-text-theme-secondary">
				No addresses yet. Until one is added, nobody gets organization access through {org.name}.
			</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border-theme text-left text-xs text-text-theme-tertiary">
							<th class="py-2 pr-3 font-medium">Address</th>
							<th class="py-2 pr-3 font-medium">How they connect</th>
							<th class="py-2 pr-3 font-medium">Flags</th>
							<th class="py-2 pr-3 text-right font-medium">Visits (30 days)</th>
							<th class="py-2 pr-3 font-medium">Last used</th>
							<th class="py-2 font-medium"><span class="sr-only">Actions</span></th>
						</tr>
					</thead>
					<tbody>
						{#each rules as r (r.id)}
							{#if editingRuleId === r.id}
								<tr class="border-b border-border-theme">
									<td colspan="6" class="py-3">
										<form onsubmit={(e) => saveEdit(e, r)} class="rounded-md border border-border-theme bg-surface-secondary p-3">
											<AddressFields
												bind:draft={editDraft}
												organizationId={org.id}
												ruleId={r.id}
												serverErrors={editErrors}
												idPrefix="edit-addr-{r.id}"
											/>
											<div class="mt-3 flex gap-2">
												<button
													type="submit"
													class="btn btn-primary text-sm disabled:opacity-50"
													disabled={busyRuleId === r.id || !editDraft.value.trim()}
												>
													{busyRuleId === r.id ? 'Saving…' : 'Save changes'}
												</button>
												<button type="button" class="btn btn-outline text-sm" onclick={() => (editingRuleId = null)}>Cancel</button>
											</div>
										</form>
									</td>
								</tr>
							{:else}
								<tr class="border-b border-border-theme align-top last:border-0 {r.disabled ? 'opacity-70' : ''}">
									<td class="py-2 pr-3">
										<span class="font-mono text-text-theme-primary">{ruleTarget(r)}</span>
										{#if r.disabled}<span class="ml-1"><Chip>Off</Chip></span>{/if}
										{#if r.breadth && r.breadth.addresses !== 1}<p class="text-[11px] text-text-theme-tertiary">{r.breadth.label}</p>{/if}
										{#if r.kind === 'domain'}
											<p class="text-[11px] text-text-theme-tertiary" title={HOST_NAME_CAUTION}>
												Matched by host name, which a visitor’s own DNS can fake. A network range is safer.
											</p>
										{/if}
										{#if r.note}<p class="text-xs text-text-theme-secondary">{r.note}</p>{/if}
										{#if r.justification}<p class="text-xs text-text-theme-tertiary">Reason: {r.justification}</p>{/if}
									</td>
									<td class="py-2 pr-3"><RouteChip route={r.route} /></td>
									<td class="py-2 pr-3">
										<div class="flex flex-wrap gap-1">
											{#each r.flags as f}<FlagChip flag={f} />{/each}
										</div>
										{#each r.overlaps ?? [] as o}
											<p class="mt-1 text-xs text-text-theme-secondary">
												Also covered by
												<a class="text-interactive hover:underline" href="{base}/org-access/orgs/{o.org_id}">{o.org_name}</a>
												(<span class="font-mono">{o.cidr}</span>)
											</p>
										{/each}
									</td>
									<td class="py-2 pr-3 text-right tabular-nums text-text-theme-primary">{fmtNumber(r.visits_30d ?? 0)}</td>
									<td class="whitespace-nowrap py-2 pr-3 text-text-theme-secondary">{relativeDays(r.last_matched_at)}</td>
									<td class="whitespace-nowrap py-2 text-right">
										<button class="text-xs text-interactive hover:underline" onclick={() => startEdit(r)}>Edit</button>
										<button
											class="ml-2 text-xs text-interactive hover:underline disabled:opacity-50"
											disabled={busyRuleId === r.id}
											onclick={() => toggleRule(r)}>{r.disabled ? 'Turn on' : 'Turn off'}</button
										>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<!-- Who's been using it -->
	<section class="card mb-5 rounded-md p-4">
		<h3 class="mb-2 text-sm font-semibold text-text-theme-primary">Who’s been using it</h3>
		<ActivityChart daily={d.activity.daily} />
		{#if d.activity.recent.length}
			<h4 class="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-text-theme-tertiary">Recent visits</h4>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border-theme text-left text-xs text-text-theme-tertiary">
							<th class="py-1.5 pr-3 font-medium">When</th>
							<th class="py-1.5 pr-3 font-medium">Through address</th>
							<th class="py-1.5 pr-3 font-medium">Visitor (partly hidden)</th>
							<th class="py-1.5 font-medium">First page</th>
						</tr>
					</thead>
					<tbody>
						{#each d.activity.recent as v, i (`${v.started_at}-${i}`)}
							{@const via = v.rule_id ? ruleById.get(v.rule_id) : undefined}
							<tr class="border-b border-border-theme last:border-0">
								<td class="whitespace-nowrap py-1.5 pr-3 text-text-theme-secondary">{fmtDateTime(v.started_at)}</td>
								<td class="py-1.5 pr-3 font-mono text-text-theme-primary">{via ? ruleTarget(via) : '—'}</td>
								<td class="py-1.5 pr-3 font-mono text-text-theme-secondary">{v.masked_ip ?? '—'}</td>
								<td class="max-w-xs truncate py-1.5 text-text-theme-secondary" title={v.landing_page ?? ''}>{v.landing_page ?? '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="mt-2 text-sm text-text-theme-secondary">No visits recorded from this organization yet.</p>
		{/if}
	</section>

	<div class="grid gap-5 lg:grid-cols-2">
		<!-- Details and contacts -->
		<section class="card rounded-md p-4">
			<h3 class="mb-2 text-sm font-semibold text-text-theme-primary">Details and contacts</h3>
			<dl class="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm">
				<dt class="text-text-theme-secondary">Contact</dt>
				<dd class="text-text-theme-primary">
					{org.contact_name ?? '—'}
					{#if org.contact_email}<br /><a class="text-interactive hover:underline" href="mailto:{org.contact_email}">{org.contact_email}</a>{/if}
					{#if org.contact_phone}<br />{org.contact_phone}{/if}
				</dd>
				{#if org.secondary_contact}
					<dt class="text-text-theme-secondary">Other contacts</dt>
					<dd class="whitespace-pre-line text-text-theme-primary">{org.secondary_contact}</dd>
				{/if}
				<dt class="text-text-theme-secondary">Review by</dt>
				<dd class="text-text-theme-primary">{fmtDate(org.review_by)}</dd>
				{#if org.notes}
					<dt class="text-text-theme-secondary">Notes</dt>
					<dd class="whitespace-pre-line text-text-theme-primary">{org.notes}</dd>
				{/if}
				{#if org.legacy_comments}
					<dt class="text-text-theme-secondary">Old system notes</dt>
					<dd class="whitespace-pre-line text-text-theme-secondary">{org.legacy_comments}</dd>
				{/if}
				<dt class="text-text-theme-secondary">Added</dt>
				<dd class="text-text-theme-secondary">
					{fmtDate(org.created_at)}{org.created_by ? ` by ${org.created_by.name}` : ''}{org.legacy_id
						? ` · old system #${org.legacy_id}`
						: ''}
				</dd>
				<dt class="text-text-theme-secondary">Last changed</dt>
				<dd class="text-text-theme-secondary">
					{fmtDateTime(org.updated_at)}{org.updated_by ? ` by ${org.updated_by.name}` : ''}
				</dd>
			</dl>

			{#if d.requests.length}
				<h4 class="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-text-theme-tertiary">Requests</h4>
				<ul class="space-y-1 text-sm">
					{#each d.requests as rq (rq.id)}
						{@const st = REQUEST_STATUS_INFO[rq.status] ?? { label: rq.status, tone: 'neutral' }}
						<li class="flex items-center gap-2">
							<Chip tone={st.tone}>{st.label}</Chip>
							<a class="text-interactive hover:underline" href="{base}/org-access/requests/{rq.id}">
								{rq.display_name || rq.org_name}
							</a>
							<span class="text-xs text-text-theme-tertiary">{fmtDate(rq.created_at)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- History -->
		<section class="card rounded-md p-4">
			<h3 class="mb-2 text-sm font-semibold text-text-theme-primary">History</h3>
			<div class="max-h-[28rem] overflow-y-auto pr-1">
				<HistoryList entries={d.history} />
			</div>
		</section>
	</div>
{/if}
