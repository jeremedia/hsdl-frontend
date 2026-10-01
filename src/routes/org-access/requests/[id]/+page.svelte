<script lang="ts">
	// One request from the public form, and the decision on it. Approving
	// creates (or picks) the organization and adds the addresses in one step:
	// the server does both in a single transaction, so a bad address stops the
	// whole approval rather than leaving half an organization behind.
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { derived } from 'svelte/store';
	import {
		messageText,
		orgAccessApi,
		OrgAccessValidationError,
		type FieldErrors,
		type OrgEditable,
		type OrgRow,
		type ParsedRange,
		type RequestFull,
		type RequestStatus
	} from '$lib/services/org-access-api';
	import { InkApiError } from '$lib/services/ink-api';
	import {
		draftToInput,
		fmtDate,
		fmtDateTime,
		maskedNetwork,
		orgTypeLabel,
		parseAddressList,
		REQUEST_STATUS_INFO,
		setFlash,
		TONE_CLASSES,
		type RuleDraft
	} from '$lib/utils/org-access';
	import Chip from '$lib/components/org-access/Chip.svelte';
	import OrgForm from '$lib/components/org-access/OrgForm.svelte';
	import AddressFields from '$lib/components/org-access/AddressFields.svelte';
	import BannerPreview from '$lib/components/org-access/BannerPreview.svelte';
	import { ArrowLeft, Plus, X } from 'lucide-svelte';

	const queryClient = useQueryClient();

	const requestQuery = createQuery(
		derived(page, ($p) => {
			const id = $p.params.id ?? '';
			return {
				queryKey: ['org-access', 'request', id],
				queryFn: () => orgAccessApi.getRequest(id)
			};
		})
	);

	let req = $derived($requestQuery.data?.request);
	let matches = $derived($requestQuery.data?.suggested_matches ?? []);
	let parsedRanges = $derived($requestQuery.data?.parsed_ranges ?? []);
	let status = $derived(req ? (REQUEST_STATUS_INFO[req.status] ?? { label: req.status, tone: 'neutral' as const }) : null);

	// A range that spans several networks becomes one row per network, each
	// keeping the route, note and reason typed for the range.
	function splitItem(key: number, blocks: string[]) {
		const at = items.findIndex((i) => i.key === key);
		if (at < 0) return;
		const base = items[at];
		const rows = blocks.map((b) => ({
			key: nextKey++,
			include: true,
			draft: { ...base.draft, value: b },
			errors: {}
		}));
		items = [...items.slice(0, at), ...rows, ...items.slice(at + 1)];
	}

	// ── Approve: target organization ──
	let target = $state<'new' | 'existing'>('new');
	let existing = $state<{ id: number; name: string } | null>(null);
	let newOrgValues = $state<Partial<OrgEditable>>({});
	let orgErrors = $state<FieldErrors>({});

	let orgSearch = $state('');
	let orgResults = $state<OrgRow[]>([]);
	$effect(() => {
		const q = orgSearch.trim();
		if (q.length < 2) {
			orgResults = [];
			return;
		}
		let cancelled = false;
		const t = setTimeout(() => {
			orgAccessApi
				.listOrganizations({ q, per: 8, status: 'all', sort: 'name' })
				.then((r) => {
					if (!cancelled) orgResults = r.organizations;
				})
				.catch(() => {
					if (!cancelled) orgResults = [];
				});
		}, 250);
		return () => {
			cancelled = true;
			clearTimeout(t);
		};
	});

	function chooseExisting(o: { id: number; name: string }) {
		target = 'existing';
		existing = o;
		orgSearch = '';
	}

	// ── Approve: addresses ──
	type Item = { key: number; include: boolean; draft: RuleDraft; errors: FieldErrors };
	let items = $state<Item[]>([]);
	let nextKey = 0;
	let seededFor: number | null = null;

	function makeItem(value: string, note: string, proxy = false): Item {
		return {
			key: nextKey++,
			include: true,
			// A proxy address starts as "Other proxy" but stays open to the server's
			// suggestion (EZproxy, OpenAthens), so routeTouched stays false.
			draft: { value, route: proxy ? 'other_proxy' : 'unknown', note, justification: '', disabled: false, routeTouched: false },
			errors: {}
		};
	}

	// The server parses what the requester typed (parsed_ranges): start-end
	// ranges expanded to CIDR blocks, address globs turned into networks, each
	// with its proxy route suggestion. If it sent nothing for a field that has
	// text, the field is parsed here instead.
	function itemsFor(field: ParsedRange['field'], text: string | null, parsed: ParsedRange[], note: string) {
		const proxy = field === 'proxy_addresses';
		const mine = parsed.filter((p) => p.field === field);
		if (mine.length === 0) {
			return parseAddressList(text).map((v) => makeItem(v, note, proxy));
		}
		return mine.map((p) => {
			// An unreadable entry stays as typed so live validation can explain it
			// and offer the fix, rather than being corrected silently.
			const item = makeItem(p.error ? p.input : (p.normalized ?? p.input), note, proxy);
			if (p.suggested_route) item.draft.route = p.suggested_route;
			// A fixable entry gets its "Use …" button from live validation; one the
			// server couldn't read at all (a reversed range, say) keeps the
			// server's reason next to it until it is edited.
			if (p.error && !p.suggestion) {
				item.errors = { base: [/^[a-z]/.test(p.error) ? `“${p.input}” ${p.error}.` : p.error] };
			}
			return item;
		});
	}

	function seed(r: RequestFull, parsed: ParsedRange[]) {
		const note = `From the access request of ${fmtDate(r.created_at)}`;
		items = [
			...itemsFor('ip_ranges', r.ip_ranges, parsed, note),
			...itemsFor('proxy_addresses', r.proxy_addresses, parsed, `${note} (proxy address)`)
		];
	}

	// Pre-fill once per request, when it first loads; later refetches keep edits.
	$effect(() => {
		const r = req;
		const parsed = parsedRanges;
		if (r && seededFor !== r.id) {
			seededFor = r.id;
			seed(r, parsed);
			if (r.organization) chooseExisting(r.organization);
		}
	});

	let orgInitial = $derived.by((): Partial<OrgEditable> => {
		if (!req) return {};
		return {
			name: req.display_name || req.org_name,
			org_type: req.org_type,
			contact_name: req.contact_name,
			contact_email: req.contact_email,
			contact_phone: req.contact_phone,
			secondary_contact: req.secondary_contact,
			notes: req.ticket_number ? `EBSCO/OpenAthens ticket: ${req.ticket_number}` : null
		};
	});

	let included = $derived(items.filter((i) => i.include && i.draft.value.trim()));
	let approving = $state(false);
	let approveError = $state<string | null>(null);

	async function approve() {
		if (!req) return;
		approveError = null;
		orgErrors = {};
		for (const i of items) i.errors = {};
		if (target === 'existing' && !existing) {
			approveError = 'Pick the organization these addresses belong to.';
			return;
		}
		if (target === 'new' && !newOrgValues.name?.trim()) {
			orgErrors = { name: ['The organization needs a name visitors will see.'] };
			return;
		}
		const sent = included;
		const what = target === 'new' ? `create “${newOrgValues.name}”` : `add to ${existing!.name}`;
		if (
			!confirm(
				`Approve and ${what} with ${sent.length} ${sent.length === 1 ? 'address' : 'addresses'}? Visitors from them get organization access within a few minutes.`
			)
		)
			return;
		approving = true;
		try {
			const res = await orgAccessApi.approveRequest(req.id, {
				...(target === 'new' ? { organization: newOrgValues } : { organization_id: existing!.id }),
				rules: sent.map((i) => {
					const { disabled: _off, ...input } = draftToInput(i.draft);
					return input;
				})
			});
			await queryClient.invalidateQueries({ queryKey: ['org-access'] });
			const warnings = (res?.warnings ?? []).map(messageText).filter(Boolean);
			setFlash(
				warnings.length
					? { tone: 'warning', lines: ['Approved. Worth knowing:', ...warnings] }
					: { tone: 'success', lines: ['Approved. Visitors from these addresses get organization access within a few minutes.'] }
			);
			const orgId = res?.organization?.id ?? res?.request?.organization_id ?? existing?.id;
			if (orgId) await goto(`${base}/org-access/orgs/${orgId}`);
		} catch (err) {
			if (err instanceof OrgAccessValidationError) {
				orgErrors = err.fields;
				err.rules.forEach((fe, idx) => {
					if (fe && sent[idx]) sent[idx].errors = fe;
				});
				approveError = 'Nothing was saved. Fix what’s marked below and approve again.';
			} else if (err instanceof InkApiError && err.status === 409) {
				// Someone else decided it meanwhile (or it was already approved):
				// say so, and show the request as it is now.
				approveError = `${err.message} Nothing was changed. The page now shows its current state.`;
				await queryClient.invalidateQueries({ queryKey: ['org-access', 'request'] });
			} else {
				approveError = err instanceof Error ? err.message : 'Approval failed.';
			}
		} finally {
			approving = false;
		}
	}

	// ── Other decisions ──
	let reviewNote = $state('');
	let notePrimed = false;
	$effect(() => {
		if (req && !notePrimed) {
			notePrimed = true;
			reviewNote = req.review_note ?? '';
		}
	});
	let deciding = $state(false);
	let decisionError = $state<string | null>(null);

	async function decide(changes: { status?: RequestStatus; organization_id?: number | null }, confirmText?: string) {
		if (!req) return;
		if (confirmText && !confirm(confirmText)) return;
		deciding = true;
		decisionError = null;
		try {
			await orgAccessApi.updateRequest(req.id, { ...changes, review_note: reviewNote.trim() || null });
			await queryClient.invalidateQueries({ queryKey: ['org-access'] });
		} catch (err) {
			decisionError =
				err instanceof OrgAccessValidationError
					? Object.values(err.fields).flat().join(' ')
					: err instanceof Error
						? err.message
						: 'Could not save.';
		} finally {
			deciding = false;
		}
	}

	const fieldBox = 'whitespace-pre-line rounded border border-border-theme bg-surface-secondary px-2 py-1 font-mono text-xs text-text-theme-primary';
</script>

<a href="{base}/org-access/requests" class="mb-3 inline-flex items-center gap-1 text-xs text-interactive hover:underline">
	<ArrowLeft size={12} /> All requests
</a>

{#if $requestQuery.isPending}
	<p class="text-sm text-text-theme-secondary">Loading…</p>
{:else if $requestQuery.isError}
	<p class="text-sm text-error" role="alert">Couldn’t load this request: {$requestQuery.error.message}</p>
{:else if req && status}
	<header class="mb-5">
		<div class="flex flex-wrap items-center gap-2">
			<h2 class="text-2xl font-semibold text-text-theme-primary">{req.display_name || req.org_name}</h2>
			<Chip tone={status.tone}>{status.label}</Chip>
		</div>
		<p class="mt-1 text-sm text-text-theme-secondary">
			{orgTypeLabel(req.org_type)} · sent {fmtDateTime(req.created_at)}
			{#if req.reviewed_at}
				· decided {fmtDate(req.reviewed_at)}{req.reviewed_by ? ` by ${req.reviewed_by.name}` : ''}
			{/if}
		</p>
		{#if req.organization}
			<p class="mt-1 text-sm text-text-theme-primary">
				Linked to <a class="text-interactive hover:underline" href="{base}/org-access/orgs/{req.organization.id}"
					>{req.organization.name}</a
				>
			</p>
		{/if}
	</header>

	<div class="grid gap-5 lg:grid-cols-2">
		<section class="card rounded-md p-4">
			<h3 class="mb-2 text-sm font-semibold text-text-theme-primary">What they sent</h3>
			<dl class="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 text-sm">
				<dt class="text-text-theme-secondary">Organization</dt>
				<dd class="text-text-theme-primary">{req.org_name}</dd>
				{#if req.display_name && req.display_name !== req.org_name}
					<dt class="text-text-theme-secondary">Name to show</dt>
					<dd class="text-text-theme-primary">{req.display_name}</dd>
				{/if}
				<dt class="text-text-theme-secondary">Contact</dt>
				<dd class="text-text-theme-primary">
					{req.contact_name ?? '—'}
					{#if req.contact_email}<br /><a class="text-interactive hover:underline" href="mailto:{req.contact_email}">{req.contact_email}</a>{/if}
					{#if req.contact_phone}<br />{req.contact_phone}{/if}
				</dd>
				{#if req.secondary_contact}
					<dt class="text-text-theme-secondary">Other contacts</dt>
					<dd class="whitespace-pre-line text-text-theme-primary">{req.secondary_contact}</dd>
				{/if}
				<dt class="text-text-theme-secondary">Network addresses</dt>
				<dd>{#if req.ip_ranges}<div class={fieldBox}>{req.ip_ranges}</div>{:else}<span class="text-text-theme-tertiary">None given</span>{/if}</dd>
				<dt class="text-text-theme-secondary">Proxy server addresses</dt>
				<dd>{#if req.proxy_addresses}<div class={fieldBox}>{req.proxy_addresses}</div>{:else}<span class="text-text-theme-tertiary">None given</span>{/if}</dd>
				{#if req.ticket_number}
					<dt class="text-text-theme-secondary">EBSCO/OpenAthens ticket</dt>
					<dd class="text-text-theme-primary">{req.ticket_number}</dd>
				{/if}
				{#if req.message}
					<dt class="text-text-theme-secondary">Message</dt>
					<dd class="whitespace-pre-line text-text-theme-primary">{req.message}</dd>
				{/if}
				<!-- submitted_ip is stored masked (IPv4 /24, IPv6 /48): a network, not an exact address. -->
				<dt class="text-text-theme-secondary">Sent from</dt>
				<dd class="text-text-theme-primary">
					{#if req.submitted_ip}
						network <span class="font-mono">{maskedNetwork(req.submitted_ip)}</span>
						<span class="block text-xs text-text-theme-tertiary">The exact address isn’t kept, only its network.</span>
					{:else}
						—
					{/if}
					{#if req.submitted_org}
						<span class="block text-xs text-text-theme-secondary">
							When they sent it, their address already got access as
							<a class="text-interactive hover:underline" href="{base}/org-access/orgs/{req.submitted_org.id}">{req.submitted_org.name}</a>.
						</span>
					{:else if req.submitted_ip}
						<a class="block text-xs text-interactive hover:underline" href="{base}/org-access/test?ip={encodeURIComponent(req.submitted_ip)}"
							>Test this network (approximate: tests {req.submitted_ip})</a
						>
					{/if}
				</dd>
			</dl>
		</section>

		<section class="card rounded-md p-4">
			<h3 class="mb-1 text-sm font-semibold text-text-theme-primary">Already on file?</h3>
			<p class="mb-2 text-xs text-text-theme-secondary">
				Organizations with a similar name, or whose addresses already cover what they sent.
			</p>
			{#if matches.length === 0}
				<p class="text-sm text-text-theme-secondary">No likely matches. This looks like a new organization.</p>
			{:else}
				<ul class="divide-y divide-border-theme">
					{#each matches as m (m.id)}
						{@const o = { id: m.id, name: m.name }}
						<li class="py-2 text-sm">
							<div class="flex flex-wrap items-center gap-2">
								<a class="font-medium text-interactive hover:underline" href="{base}/org-access/orgs/{o.id}">{o.name}</a>
								{#if m.disabled}<Chip tone="warning">Turned off</Chip>{/if}
								{#each m.reasons as reason}
									<Chip tone="info">{reason === 'covers_range' ? 'Already covers what they sent' : reason === 'similar_name' ? 'Similar name' : reason}</Chip>
								{/each}
							</div>
							{#if m.detail}<p class="mt-0.5 text-xs text-text-theme-secondary">Existing address <span class="font-mono">{m.detail}</span>.</p>{/if}
							<div class="mt-1 flex flex-wrap gap-3 text-xs">
								<button class="text-interactive hover:underline" onclick={() => chooseExisting(o)}>Add the addresses to this one</button>
								{#if req.organization?.id !== o.id}
									<button
										class="text-interactive hover:underline disabled:opacity-50"
										disabled={deciding}
										onclick={() =>
											decide({ organization_id: o.id }, `Link this request to ${o.name} without adding any addresses?`)}
										>Link without changes</button
									>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>

	<!-- Approve -->
	<section class="card mt-5 rounded-md p-4">
		<h3 class="text-sm font-semibold text-text-theme-primary">Approve</h3>
		<p class="mb-3 text-xs text-text-theme-secondary">
			{req.status === 'approved'
				? 'This request is already approved. Approving again adds these addresses too.'
				: 'Everything below is filled in from the request. Check it, then approve. Nothing is saved until you do.'}
		</p>

		<fieldset class="mb-4">
			<legend class="mb-1 text-xs font-medium text-text-theme-secondary">Which organization?</legend>
			<div class="flex flex-wrap gap-4 text-sm text-text-theme-primary">
				<label class="flex items-center gap-1.5"><input type="radio" bind:group={target} value="new" /> Create a new organization</label>
				<label class="flex items-center gap-1.5"><input type="radio" bind:group={target} value="existing" /> Add to one already on file</label>
			</div>
		</fieldset>

		<!-- Kept mounted while hidden so switching back keeps any edits. -->
		<div hidden={target !== 'new'}>
			<OrgForm embedded initial={orgInitial} errors={orgErrors} bind:values={newOrgValues} />
		</div>
		{#if target === 'existing'}
			<div class="space-y-2">
				{#if existing}
					<div class="flex flex-wrap items-center gap-3">
						<p class="text-sm text-text-theme-primary">
							Adding to <a class="font-medium text-interactive hover:underline" href="{base}/org-access/orgs/{existing.id}">{existing.name}</a>
						</p>
						<button class="text-xs text-interactive hover:underline" onclick={() => (existing = null)}>Choose another</button>
					</div>
					<BannerPreview name={existing.name} />
				{:else}
					<label for="org-pick" class="block text-xs font-medium text-text-theme-secondary">Find the organization</label>
					<input
						id="org-pick"
						type="search"
						bind:value={orgSearch}
						placeholder="Type part of its name…"
						class="w-full max-w-md rounded-md border border-border-theme bg-surface-elevated px-3 py-2 text-sm text-text-theme-primary"
					/>
					{#if orgResults.length}
						<ul class="max-w-md rounded-md border border-border-theme">
							{#each orgResults as o (o.id)}
								<li>
									<button
										class="w-full px-3 py-1.5 text-left text-sm text-text-theme-primary hover:bg-surface-secondary"
										onclick={() => chooseExisting(o)}
									>
										{o.name}{o.disabled ? ' (turned off)' : ''}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
					{#each orgErrors.organization_id ?? [] as msg}<p class="text-xs text-error">{msg}</p>{/each}
				{/if}
			</div>
		{/if}

		<h4 class="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-text-theme-tertiary">Network addresses</h4>
		{#if items.length === 0}
			<p class="mb-2 text-sm text-text-theme-secondary">The request didn’t include any addresses. Add them below if you have them.</p>
		{/if}
		<div class="space-y-3">
			{#each items as item, idx (item.key)}
				<div class="rounded-md border border-border-theme p-3 {item.include ? 'bg-surface-secondary' : 'opacity-60'}">
					<div class="mb-2 flex items-center justify-between">
						<label class="flex items-center gap-1.5 text-xs font-medium text-text-theme-secondary">
							<input type="checkbox" bind:checked={item.include} /> Include this address
						</label>
						<button
							class="text-text-theme-tertiary hover:text-text-theme-primary"
							aria-label="Remove this address"
							onclick={() => (items = items.filter((i) => i.key !== item.key))}><X size={14} /></button
						>
					</div>
					{#if item.include}
						<AddressFields
							bind:draft={items[idx].draft}
							organizationId={target === 'existing' ? existing?.id : undefined}
							serverErrors={item.errors}
							idPrefix="req-addr-{item.key}"
							onSplit={(blocks) => splitItem(item.key, blocks)}
						/>
					{:else}
						<p class="font-mono text-sm text-text-theme-secondary">{item.draft.value}</p>
					{/if}
				</div>
			{/each}
		</div>
		<button class="btn btn-outline mt-3 text-xs" onclick={() => (items = [...items, makeItem('', `From the access request of ${fmtDate(req!.created_at)}`)])}>
			<Plus size={12} /> Add another address
		</button>

		{#if approveError}
			<p class="mt-4 rounded-md border px-3 py-2 text-sm {TONE_CLASSES.error}" role="alert">{approveError}</p>
		{/if}
		<div class="mt-4 flex flex-wrap items-center gap-3">
			<button class="btn btn-primary text-sm disabled:opacity-50" disabled={approving} onclick={approve}>
				{approving ? 'Approving…' : `Approve with ${included.length} ${included.length === 1 ? 'address' : 'addresses'}`}
			</button>
			{#if included.length === 0}
				<span class="text-xs text-text-theme-secondary">
					With no addresses nobody gets access yet; you can add them on the organization’s page later.
				</span>
			{/if}
		</div>
	</section>

	<!-- Other decisions -->
	<section class="card mt-5 rounded-md p-4">
		<h3 class="mb-2 text-sm font-semibold text-text-theme-primary">Or decide otherwise</h3>
		<label for="review-note" class="block text-xs font-medium text-text-theme-secondary">Note (staff only, kept with the request)</label>
		<textarea
			id="review-note"
			rows="2"
			bind:value={reviewNote}
			placeholder="e.g. Emailed Jane on Oct 1 asking for their EZproxy address."
			class="mt-1 w-full rounded-md border border-border-theme bg-surface-elevated px-3 py-2 text-sm text-text-theme-primary"
		></textarea>
		{#if decisionError}<p class="mt-1 text-xs text-error" role="alert">{decisionError}</p>{/if}
		<div class="mt-2 flex flex-wrap gap-2">
			<button class="btn btn-outline text-xs disabled:opacity-50" disabled={deciding} onclick={() => decide({})}>Save note</button>
			{#if req.status !== 'declined'}
				<button
					class="btn btn-outline text-xs disabled:opacity-50"
					disabled={deciding}
					onclick={() => decide({ status: 'declined' }, 'Decline this request? Nothing changes for any visitor.')}>Decline</button
				>
			{/if}
			{#if req.status !== 'spam'}
				<button
					class="btn btn-outline text-xs disabled:opacity-50"
					disabled={deciding}
					onclick={() => decide({ status: 'spam' }, 'Mark this request as spam?')}>Mark as spam</button
				>
			{/if}
			{#if req.status !== 'pending'}
				<button class="btn btn-outline text-xs disabled:opacity-50" disabled={deciding} onclick={() => decide({ status: 'pending' })}
					>Move back to waiting</button
				>
			{/if}
		</div>
	</section>
{/if}
