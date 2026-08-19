<script lang="ts">
	// /ink/tours/[slug] — tour editor: metadata + the ordered stop list.
	// Reordering is button-based (PositionPicker pattern — NO svelte-dnd-action,
	// it crashes on Svelte 5); every stop verb returns the full recomputed tour
	// and we replace local state wholesale (positions are server-owned).
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		inkApi,
		fetchTourTargets,
		type InkTour,
		type InkTourStop,
		type TourTargetsDoc
	} from '$lib/services/ink-api';

	// Typed routes give params.slug as string | undefined. This route only
	// renders for a matched [slug], so normalise once here rather than
	// asserting at each of the five API call sites below.
	const slug = $derived($page.params.slug ?? '');

	let tour = $state<InkTour | null>(null);
	let registry = $state<InkTourStop[]>([]);
	let targets = $state<TourTargetsDoc | null>(null);
	let error = $state<string | null>(null);
	let flash = $state<string | null>(null);

	// Metadata form
	let name = $state('');
	let description = $state('');
	let status = $state('draft');

	// Per-stop override editing
	let editingKey = $state<string | null>(null);
	let editTitle = $state('');
	let editNote = $state('');
	let editUrl = $state('');

	let addKey = $state('');

	$effect(() => {
		if (!slug) return;
		void (async () => {
			try {
				const [t, reg, tg] = await Promise.all([
					inkApi.getTour(slug),
					inkApi.listTourStops({ status: 'active' }),
					fetchTourTargets()
				]);
				apply(t);
				registry = reg;
				targets = tg;
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to load tour';
			}
		})();
	});

	function apply(t: InkTour) {
		tour = t;
		name = t.name;
		description = t.description ?? '';
		status = t.status;
	}

	async function run(fn: () => Promise<InkTour>, note?: string) {
		try {
			apply(await fn());
			error = null;
			if (note) { flash = note; setTimeout(() => (flash = null), 1500); }
		} catch (e) {
			error = e instanceof Error ? e.message : 'Save failed';
		}
	}

	const saveMeta = () =>
		run(() => inkApi.updateTour(slug, { name: name.trim(), description: description.trim(), status }), 'Saved');
	const move = (key: string, to1: number) => run(() => inkApi.moveTourStop(slug, key, to1));
	const removeStop = (key: string) => run(() => inkApi.removeTourStop(slug, key));
	const addStop = () => { if (addKey) { void run(() => inkApi.addTourStop(slug, addKey), 'Added'); addKey = ''; } };

	function startEdit(s: { feature_key: string; title: string | null; note: string | null; url: string | null }) {
		editingKey = s.feature_key;
		editTitle = s.title ?? '';
		editNote = s.note ?? '';
		editUrl = s.url ?? '';
	}
	const saveEdit = () =>
		run(() => inkApi.updateTourStopOverrides(slug, editingKey!, { title: editTitle, note: editNote, url: editUrl }),
			'Overrides saved').then(() => (editingKey = null));

	const availableStops = $derived(
		registry.filter((r) => !tour?.stops.some((s) => s.feature_key === r.key))
	);
	const staleTarget = (key: string | null) =>
		!!targets && (!key || !targets.targets.some((t) => t.key === key));
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-semibold">
			<a class="text-text-theme-muted hover:underline" href="{base}/tours">Tours</a>
			<span class="text-text-theme-muted">/</span> {tour?.name ?? slug}
		</h1>
		<div class="flex items-center gap-2 text-sm">
			{#if flash}<span class="text-green-600">{flash}</span>{/if}
			<a class="btn btn-outline" href="/tour/{slug}" target="_blank" rel="noopener">Preview tour ↗</a>
		</div>
	</div>
	{#if error}<p class="text-sm text-red-600">{error}</p>{/if}

	{#if tour}
		<div class="card p-4 grid grid-cols-[1fr_1fr_10rem_auto] gap-3 items-end">
			<div>
				<label class="block text-xs font-medium text-text-theme-secondary mb-1" for="t-name">Name</label>
				<input id="t-name" class="input" bind:value={name} />
			</div>
			<div>
				<label class="block text-xs font-medium text-text-theme-secondary mb-1" for="t-desc">Blurb</label>
				<input id="t-desc" class="input" bind:value={description} />
			</div>
			<div>
				<label class="block text-xs font-medium text-text-theme-secondary mb-1" for="t-status">Status</label>
				<select id="t-status" class="input" bind:value={status}>
					<option value="draft">draft</option>
					<option value="open">open (live)</option>
					<option value="closed">closed</option>
				</select>
			</div>
			<button class="btn btn-primary" onclick={saveMeta}>Save</button>
			<p class="col-span-4 text-xs text-text-theme-muted">
				Edits reach visitors within about 5 minutes (the tour API is publicly cached).
			</p>
		</div>

		<div class="card divide-y divide-border-theme">
			{#each tour.stops as stop, i (stop.feature_key)}
				<div class="px-4 py-3">
					<div class="flex items-center gap-3">
						<span class="text-xs tabular-nums text-text-theme-muted w-6">{i + 1}.</span>
						<div class="min-w-0 flex-1">
							<span class="font-medium">{stop.display_title}</span>
							<span class="ml-2 text-xs text-text-theme-muted">{stop.feature_key}</span>
							{#if stop.title || stop.note || stop.url}
								<span class="ml-2 text-[10px] uppercase font-semibold text-blue-600">overridden</span>
							{/if}
							{#if stop.feature_status === 'retired'}
								<span class="ml-2 text-[10px] uppercase font-semibold text-red-600">retired — not served</span>
							{/if}
							{#if staleTarget(stop.spotlight_key)}
								<span class="ml-2 text-[10px] uppercase font-semibold text-amber-600"
									title="spotlight_key not in the site's tour-targets.json — this stop will be dropped from the walk">
									stale target</span>
							{/if}
							<p class="text-sm text-text-theme-secondary truncate">{stop.display_note}</p>
						</div>
						<div class="flex items-center gap-1 shrink-0">
							{#if stop.display_url && stop.spotlight_key}
								<a class="btn btn-outline !px-2 !py-1 text-xs" target="_blank" rel="noopener"
									href="{stop.display_url}{stop.display_url.includes('?') ? '&' : '?'}spotlight={stop.spotlight_key}"
									title="Preview this stop's highlight on the site">Preview ↗</a>
							{/if}
							<button class="btn btn-outline !px-2 !py-1 text-xs" onclick={() => startEdit(stop)}>Edit</button>
							<button class="btn btn-outline !px-2 !py-1" title="Move up" disabled={i === 0}
								onclick={() => move(stop.feature_key, i)}>↑</button>
							<button class="btn btn-outline !px-2 !py-1" title="Move down" disabled={i === tour.stops.length - 1}
								onclick={() => move(stop.feature_key, i + 2)}>↓</button>
							<button class="btn btn-outline !px-2 !py-1 text-xs" onclick={() => removeStop(stop.feature_key)}>Remove</button>
						</div>
					</div>
					{#if editingKey === stop.feature_key}
						<div class="mt-3 grid grid-cols-[1fr_2fr_1fr_auto_auto] gap-2 items-end">
							<div>
								<label class="block text-xs text-text-theme-secondary mb-1" for="e-title">Title override</label>
								<input id="e-title" class="input input-compact" bind:value={editTitle} placeholder={stop.name} />
							</div>
							<div>
								<label class="block text-xs text-text-theme-secondary mb-1" for="e-note">Copy override</label>
								<input id="e-note" class="input input-compact" bind:value={editNote} placeholder={stop.description ?? ''} />
							</div>
							<div>
								<label class="block text-xs text-text-theme-secondary mb-1" for="e-url">Route override</label>
								<input id="e-url" class="input input-compact" bind:value={editUrl} placeholder={stop.url ?? '/'} />
							</div>
							<button class="btn btn-primary !py-1.5" onclick={saveEdit}>Save</button>
							<button class="btn btn-secondary !py-1.5" onclick={() => (editingKey = null)}>Cancel</button>
						</div>
						<p class="mt-1 text-xs text-text-theme-muted">Blank fields fall back to the stop's own title / copy / route.</p>
					{/if}
				</div>
			{:else}
				<p class="px-4 py-6 text-sm text-text-theme-muted">No stops yet.</p>
			{/each}

			<div class="px-4 py-3 flex items-center gap-2">
				<select class="input input-compact max-w-md" bind:value={addKey}>
					<option value="">Add a stop…</option>
					{#each availableStops as s (s.key)}
						<option value={s.key}>{s.name} — {s.key}</option>
					{/each}
				</select>
				<button class="btn btn-secondary !py-1.5" disabled={!addKey} onclick={addStop}>Add</button>
				<a class="text-xs text-text-theme-muted underline ml-auto" href="{base}/tours/stops">Manage the stop registry →</a>
			</div>
		</div>
	{:else if !error}
		<div class="skeleton h-40"></div>
	{/if}
</div>
