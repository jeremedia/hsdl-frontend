<script lang="ts">
	// /ink/tours/stops — the reusable Tour Stop registry (SiteFeatures).
	// Retire, never delete; the spotlight/behavior pickers are fed by the
	// site's /tour-targets.json (the client-code vocabulary), and a stale chip
	// flags stops whose target the current site build no longer knows.
	import { base } from '$app/paths';
	import {
		inkApi,
		fetchTourTargets,
		type InkTourStop,
		type TourTargetsDoc
	} from '$lib/services/ink-api';

	let stops = $state<InkTourStop[]>([]);
	let targets = $state<TourTargetsDoc | null>(null);
	let q = $state('');
	let error = $state<string | null>(null);
	let flash = $state<string | null>(null);

	let selectedKey = $state<string | null>(null);
	let creating = $state(false);
	let form = $state({ key: '', name: '', description: '', url: '', spotlight_key: '', behavior_key: '', status: 'active' });

	async function load() {
		try {
			[stops, targets] = await Promise.all([inkApi.listTourStops(), fetchTourTargets()]);
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load';
		}
	}
	$effect(() => { void load(); });

	const filtered = $derived(
		q.trim()
			? stops.filter((s) => (s.key + s.name + (s.description ?? '')).toLowerCase().includes(q.toLowerCase()))
			: stops
	);

	function select(s: InkTourStop) {
		creating = false;
		selectedKey = s.key;
		form = {
			key: s.key, name: s.name, description: s.description ?? '', url: s.url ?? '',
			spotlight_key: s.spotlight_key ?? '', behavior_key: s.behavior_key ?? '', status: s.status
		};
	}
	function startNew() {
		creating = true;
		selectedKey = null;
		form = { key: '', name: '', description: '', url: '', spotlight_key: '', behavior_key: '', status: 'active' };
	}

	async function save() {
		try {
			const payload = { ...form, description: form.description || undefined, url: form.url || undefined,
				spotlight_key: form.spotlight_key || undefined, behavior_key: form.behavior_key || undefined };
			const saved = creating
				? await inkApi.createTourStop(payload)
				: await inkApi.updateTourStop(selectedKey!, payload);
			await load();
			select(saved);
			flash = 'Saved'; setTimeout(() => (flash = null), 1500);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Save failed';
		}
	}

	const stale = (s: InkTourStop) =>
		!!targets && (!s.spotlight_key || !targets.targets.some((t) => t.key === s.spotlight_key));
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold">
				<a class="text-text-theme-muted hover:underline" href="{base}/tours">Tours</a>
				<span class="text-text-theme-muted">/</span> Stop registry
			</h1>
			<p class="text-sm text-text-theme-secondary">Reusable tour stops. Retiring a stop drops it from every live tour; nothing is ever deleted.</p>
		</div>
		<button class="btn btn-primary" onclick={startNew}>New stop</button>
	</div>
	{#if error}<p class="text-sm text-red-600">{error}</p>{/if}

	<div class="grid grid-cols-[minmax(280px,380px)_1fr] gap-4 items-start">
		<div class="card p-2 space-y-1">
			<input class="input input-compact" placeholder="Search stops…" bind:value={q} />
			<div class="max-h-[70vh] overflow-y-auto divide-y divide-border-theme">
				{#each filtered as s (s.key)}
					<button class="w-full text-left px-2 py-2 hover:bg-surface-theme-subtle {selectedKey === s.key ? 'bg-surface-theme-subtle' : ''}"
						onclick={() => select(s)}>
						<span class="font-medium text-sm">{s.name}</span>
						<span class="ml-1 text-xs text-text-theme-muted">{s.key}</span>
						{#if s.status === 'retired'}<span class="ml-1 text-[10px] uppercase font-semibold text-red-600">retired</span>{/if}
						{#if stale(s)}<span class="ml-1 text-[10px] uppercase font-semibold text-amber-600">stale target</span>{/if}
						<span class="block text-xs text-text-theme-muted">used by {s.used_by.length} tour{s.used_by.length === 1 ? '' : 's'}</span>
					</button>
				{/each}
			</div>
		</div>

		{#if creating || selectedKey}
			<div class="card p-4 space-y-3">
				<div class="flex items-center justify-between">
					<h2 class="font-semibold">{creating ? 'New stop' : form.name}</h2>
					{#if flash}<span class="text-sm text-green-600">{flash}</span>{/if}
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-xs text-text-theme-secondary mb-1" for="s-key">Key (stable, kebab-case)</label>
						<input id="s-key" class="input" bind:value={form.key} disabled={!creating} />
					</div>
					<div>
						<label class="block text-xs text-text-theme-secondary mb-1" for="s-name">Title</label>
						<input id="s-name" class="input" bind:value={form.name} />
					</div>
				</div>
				<div>
					<label class="block text-xs text-text-theme-secondary mb-1" for="s-desc">Copy (the step's description)</label>
					<textarea id="s-desc" class="input" rows="2" bind:value={form.description}></textarea>
				</div>
				<div class="grid grid-cols-3 gap-3">
					<div>
						<label class="block text-xs text-text-theme-secondary mb-1" for="s-url">Route (site URL)</label>
						<input id="s-url" class="input" bind:value={form.url} placeholder="/search?q=…" />
					</div>
					<div>
						<label class="block text-xs text-text-theme-secondary mb-1" for="s-target">Highlight target</label>
						<select id="s-target" class="input" bind:value={form.spotlight_key}>
							<option value="">(none)</option>
							{#each targets?.targets ?? [] as t (t.key)}
								<option value={t.key}>{t.label} — {t.key}</option>
							{/each}
							{#if form.spotlight_key && targets && !targets.targets.some((t) => t.key === form.spotlight_key)}
								<option value={form.spotlight_key}>⚠ {form.spotlight_key} (not in current site build)</option>
							{/if}
						</select>
					</div>
					<div>
						<label class="block text-xs text-text-theme-secondary mb-1" for="s-behavior">Behavior</label>
						<select id="s-behavior" class="input" bind:value={form.behavior_key}>
							<option value="">(plain highlight)</option>
							{#each targets?.behaviors ?? [] as b (b.key)}
								<option value={b.key}>{b.label}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<select class="input max-w-40" bind:value={form.status}>
						<option value="active">active</option>
						<option value="retired">retired</option>
					</select>
					<button class="btn btn-primary" disabled={!form.key || !form.name} onclick={save}>Save</button>
					{#if !creating && form.url && form.spotlight_key}
						<a class="btn btn-outline" target="_blank" rel="noopener"
							href="{form.url}{form.url.includes('?') ? '&' : '?'}spotlight={form.spotlight_key}">Preview ↗</a>
					{/if}
				</div>
				{#if !creating}
					{@const sel = stops.find((s) => s.key === selectedKey)}
					{#if sel && sel.used_by.length}
						<p class="text-xs text-text-theme-muted">Used by:
							{#each sel.used_by as u (u.slug)}
								<a class="underline ml-1" href="{base}/tours/{u.slug}">{u.name} ({u.status})</a>
							{/each}
						</p>
					{/if}
				{/if}
			</div>
		{:else}
			<p class="text-sm text-text-theme-muted p-4">Select a stop to edit, or create a new one.</p>
		{/if}
	</div>
</div>
