<script lang="ts">
	// /ink/tours — guided site tours: list + create. A tour is an ordered list
	// of Tour Stops (see /ink/tours/stops for the reusable stop registry).
	// Direct inkApi + runes (the ordered-list screens skip TanStack; server
	// responses are the source of truth).
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { inkApi, type InkTourSummary } from '$lib/services/ink-api';

	let tours = $state<InkTourSummary[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let showNew = $state(false);
	let newName = $state('');
	let newSlug = $state('');
	let slugTouched = $state(false);
	let newDescription = $state('');

	const slugify = (s: string) =>
		s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

	$effect(() => {
		if (!slugTouched) newSlug = slugify(newName);
	});

	async function load() {
		loading = true;
		try {
			tours = await inkApi.listTours();
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load tours';
		} finally {
			loading = false;
		}
	}
	$effect(() => { void load(); });

	async function createTour() {
		try {
			const tour = await inkApi.createTour({
				name: newName.trim(),
				slug: newSlug.trim(),
				description: newDescription.trim() || undefined
			});
			await goto(`${base}/tours/${tour.slug}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Create failed';
		}
	}

	const statusClass = (s: string) =>
		s === 'open' ? 'text-green-700 dark:text-green-400'
		: s === 'draft' ? 'text-amber-700 dark:text-amber-400'
		: 'text-text-theme-muted';
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-semibold">Tours</h1>
			<p class="text-sm text-text-theme-secondary">
				Guided site walkthroughs, served live to the public site. Stops are reusable —
				manage them in the <a class="underline" href="{base}/tours/stops">stop registry</a>.
			</p>
		</div>
		<button class="btn btn-primary" onclick={() => (showNew = !showNew)}>New tour</button>
	</div>

	{#if showNew}
		<div class="card p-4 space-y-3">
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="block text-xs font-medium text-text-theme-secondary mb-1" for="tour-name">Name</label>
					<input id="tour-name" class="input" bind:value={newName} placeholder="Basics" />
				</div>
				<div>
					<label class="block text-xs font-medium text-text-theme-secondary mb-1" for="tour-slug">Slug (URL: /tour/…)</label>
					<input id="tour-slug" class="input" bind:value={newSlug} oninput={() => (slugTouched = true)} placeholder="basics" />
				</div>
			</div>
			<div>
				<label class="block text-xs font-medium text-text-theme-secondary mb-1" for="tour-desc">Blurb (shown on the /tours hub)</label>
				<input id="tour-desc" class="input" bind:value={newDescription} placeholder="Find something fast." />
			</div>
			<div class="flex gap-2">
				<button class="btn btn-primary" disabled={!newName.trim() || !newSlug.trim()} onclick={createTour}>Create draft</button>
				<button class="btn btn-secondary" onclick={() => (showNew = false)}>Cancel</button>
			</div>
		</div>
	{/if}

	{#if error}<p class="text-sm text-red-600">{error}</p>{/if}

	{#if loading}
		<div class="skeleton h-24"></div>
	{:else}
		<div class="card divide-y divide-border-theme">
			{#each tours as tour (tour.slug)}
				<a class="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-theme-subtle"
					href="{base}/tours/{tour.slug}">
					<div>
						<span class="font-medium">{tour.name}</span>
						<span class="ml-2 text-xs text-text-theme-muted">/tour/{tour.slug}</span>
						{#if tour.description}<p class="text-sm text-text-theme-secondary">{tour.description}</p>{/if}
					</div>
					<div class="text-right text-sm shrink-0">
						<span class="uppercase text-xs font-semibold {statusClass(tour.status)}">{tour.status}</span>
						<p class="text-text-theme-muted">{tour.stop_count} stops</p>
					</div>
				</a>
			{:else}
				<p class="px-4 py-6 text-sm text-text-theme-muted">No tours yet — create one, or run site_tours:seed.</p>
			{/each}
		</div>
	{/if}
</div>
