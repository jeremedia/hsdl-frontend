<script lang="ts">
	import type { SearchConfigSummary, SearchConfigDetail } from '$lib/services/ink-api';
	import { Lock, Copy, Trash2, Zap, Plus, Check, FlaskConical } from 'lucide-svelte';

	let {
		configs,
		selectedId,
		loading,
		error,
		onSelect,
		onClone,
		onCreate,
		onActivate,
		onDelete,
		onRetry,
		configDetail
	}: {
		configs: SearchConfigSummary[] | undefined;
		selectedId: string | null;
		loading: boolean;
		error: string | null;
		onSelect: (id: string) => void;
		onClone: (id: string, name: string) => void;
		onCreate: (name: string) => void;
		onActivate: (id: string) => void;
		onDelete: (id: string) => void;
		onRetry: () => void;
		configDetail: SearchConfigDetail | undefined;
	} = $props();

	let showCreate = $state(false);
	let newName = $state('');
	let cloneSourceId = $state<string | null>(null);

	function handleCreate() {
		if (!newName.trim()) return;
		if (cloneSourceId) {
			onClone(cloneSourceId, newName.trim());
		} else {
			onCreate(newName.trim());
		}
		showCreate = false;
		newName = '';
		cloneSourceId = null;
	}

	export function startClone(sourceId: string, sourceName: string) {
		cloneSourceId = sourceId;
		newName = `${sourceName} (copy)`;
		showCreate = true;
	}
</script>

<div class="space-y-3">
	<!-- Config pills -->
	{#if loading}
		<div class="flex gap-2 flex-wrap">
			{#each Array(3) as _}
				<div class="skeleton h-7 w-24 rounded-full"></div>
			{/each}
		</div>
	{:else if error}
		<div class="card p-4 text-center">
			<p class="text-error text-sm mb-3">Failed to load configurations: {error}</p>
			<button onclick={onRetry} class="btn btn-primary text-xs py-1 px-3">Retry</button>
		</div>
	{:else if configs}
		{#if configs.length === 0}
			<div class="card p-8 text-center">
				<FlaskConical size={32} class="mx-auto mb-3 text-text-theme-tertiary opacity-40" />
				<p class="text-sm text-text-theme-secondary mb-1">No search configurations yet</p>
				<p class="text-xs text-text-theme-tertiary">Create a configuration to start tuning search parameters.</p>
			</div>
		{:else}
			<div class="flex gap-2 flex-wrap">
				{#each configs as c (c.id)}
					<button
						onclick={() => onSelect(c.id)}
						class="config-pill px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150
							{selectedId === c.id ? 'border-interactive bg-interactive/10 text-interactive shadow-sm' : 'border-[var(--color-border)] text-text-theme-secondary hover:border-interactive/50 hover:text-text-theme-primary'}
							{c.active ? 'ring-2 ring-green-500/30' : ''}"
					>
						{#if c.locked}<Lock size={10} class="inline mr-1 opacity-60" />{/if}
						{c.name}
						{#if c.active}<span class="ml-1.5 text-green-600 dark:text-green-400 text-[11px] font-bold uppercase tracking-wider">Live</span>{/if}
					</button>
				{/each}
			</div>
		{/if}
	{/if}

	<!-- Create/Clone form -->
	{#if showCreate}
		<form onsubmit={(e) => { e.preventDefault(); handleCreate(); }} class="card p-4 space-y-3">
			<div>
				<label for="config-name-input" class="text-xs font-medium text-text-theme-secondary block mb-1">{cloneSourceId ? 'Clone as' : 'New config name'}</label>
				<input id="config-name-input" bind:value={newName} class="input text-xs py-1.5 w-full" placeholder="e.g., Experiment March 2026" />
			</div>
			<div class="flex gap-2">
				<button type="submit" class="btn btn-primary text-xs py-1 px-3">Create</button>
				<button type="button" onclick={() => showCreate = false} class="btn btn-outline text-xs py-1 px-3">Cancel</button>
			</div>
		</form>
	{/if}

	<!-- Config info bar -->
	{#if configDetail}
		<div class="card px-4 py-3 flex items-center gap-4 text-xs text-text-theme-tertiary">
			{#if configDetail.locked}
				<span class="text-amber-600 font-medium flex items-center gap-1"><Lock size={12} /> Locked -- clone to experiment</span>
			{/if}
			{#if !configDetail.active}
				<button onclick={() => onActivate(configDetail.id)} class="text-green-600 hover:text-green-700 font-medium flex items-center gap-1 transition-colors">
					<Zap size={12} /> Activate this config
				</button>
			{:else}
				<span class="text-green-600 font-medium flex items-center gap-1"><Check size={12} /> Currently live</span>
			{/if}
			{#if !configDetail.active && !configDetail.locked}
				<button onclick={() => onDelete(configDetail.id)} class="text-red-500 hover:text-red-600 ml-auto flex items-center gap-1 transition-colors">
					<Trash2 size={12} /> Delete
				</button>
			{/if}
			<button onclick={() => startClone(configDetail.id, configDetail.name)} class="text-text-theme-secondary hover:text-text-theme-primary flex items-center gap-1 transition-colors {configDetail.active && !configDetail.locked ? 'ml-auto' : ''}">
				<Copy size={12} /> Clone
			</button>
			<button onclick={() => { cloneSourceId = null; newName = ''; showCreate = !showCreate; }} class="text-text-theme-secondary hover:text-text-theme-primary flex items-center gap-1 transition-colors">
				<Plus size={14} /> New
			</button>
		</div>
	{/if}
</div>
