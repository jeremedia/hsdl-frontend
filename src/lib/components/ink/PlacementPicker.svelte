<script lang="ts">
	// Placement picker for BrowseNode.placement. Replaces the raw-JSON
	// textarea: four checkboxes, one per surface where a node can
	// appear. Each maps to a single boolean key in the placement
	// JSONB. Unchecked keys are omitted (not stored as false) so the
	// resulting JSON stays tight.
	//
	// Surface → consumer:
	//   nav                    — SiteHeader Explore Topics / Collections dropdowns
	//   home                   — HomeView "Explore by Topic" + "Featured Collections"
	//   hub_page               — sub-hubs grouped under their parent hub
	//   collection_group_page  — collection items grouped under their collection group
	//
	// kind ↔ placement combos that actually do something:
	//   kind=hub               → nav, home
	//   kind=sub_hub           → hub_page
	//   kind=collection_group  → nav, home
	//   kind=collection_item   → collection_group_page
	// We render all four checkboxes regardless of kind; the helper text
	// for each surface names the kinds that consume it, so curators
	// can self-check without us hiding controls (and without the picker
	// having to track form.kind state).

	let {
		placement,
		onchange
	}: {
		placement: Record<string, unknown>;
		onchange: (next: Record<string, unknown>) => void;
	} = $props();

	type Surface = {
		key: 'nav' | 'home' | 'hub_page' | 'collection_group_page';
		label: string;
		consumers: string;
		description: string;
	};

	const SURFACES: Surface[] = [
		{
			key: 'nav',
			label: 'Site nav dropdown',
			consumers: 'hub · collection_group',
			description: 'Surfaces in the Explore Topics or Collections dropdown in the site header.'
		},
		{
			key: 'home',
			label: 'Home page',
			consumers: 'hub · collection_group',
			description: 'Appears on the home page — Explore by Topic for hubs, Featured Collections for collection groups.'
		},
		{
			key: 'hub_page',
			label: 'Hub detail page',
			consumers: 'sub_hub',
			description: 'Renders under its parent hub on the hub detail page.'
		},
		{
			key: 'collection_group_page',
			label: 'Collection group page',
			consumers: 'collection_item',
			description: "Renders under its parent collection group on that group's detail page."
		}
	];

	function isChecked(key: Surface['key']): boolean {
		const v = (placement ?? {})[key];
		return v === true || v === 'true';
	}

	function toggle(key: Surface['key'], next: boolean) {
		const merged: Record<string, unknown> = { ...(placement ?? {}) };
		if (next) merged[key] = true;
		else delete merged[key];
		onchange(merged);
	}

	// Surface any keys the picker doesn't model yet, so we don't silently
	// drop them when a curator opens an existing node.
	let unknownKeys = $derived(
		Object.keys(placement ?? {}).filter(
			(k) => !SURFACES.some((s) => s.key === k)
		)
	);
</script>

<div class="space-y-2">
	{#each SURFACES as s (s.key)}
		<label class="flex items-start gap-2 cursor-pointer">
			<input
				type="checkbox"
				class="mt-[3px]"
				checked={isChecked(s.key)}
				onchange={(e) => toggle(s.key, (e.currentTarget as HTMLInputElement).checked)}
			/>
			<span class="min-w-0 flex-1">
				<span class="block text-[12px] font-medium">
					{s.label}
					<span class="ml-1 text-[10px] uppercase tracking-wider text-text-theme-tertiary font-normal">{s.consumers}</span>
				</span>
				<span class="block text-[11px] text-text-theme-tertiary leading-snug">{s.description}</span>
			</span>
		</label>
	{/each}

	{#if unknownKeys.length}
		<p class="text-[10px] text-amber-600 dark:text-amber-400 mt-2">
			Unrecognized placement keys preserved on save: {unknownKeys.join(', ')}
		</p>
	{/if}
</div>
