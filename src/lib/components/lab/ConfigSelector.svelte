<script lang="ts">
	import type { SearchConfigSummary, SearchConfigDetail } from '$lib/services/ink-api';
	import { Lock, Copy, Trash2, Zap, Plus, Check, FlaskConical, Pencil } from 'lucide-svelte';

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
		onRename,
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
		onRename: (id: string, name: string) => void;
		configDetail: SearchConfigDetail | undefined;
	} = $props();

	let showCreate = $state(false);
	let newName = $state('');
	let cloneSourceId = $state<string | null>(null);
	let editingName = $state(false);
	let editName = $state('');
	let renameCommitted = false;

	function commitRename() {
		if (renameCommitted) return;
		renameCommitted = true;
		if (editName.trim() && editName.trim() !== configDetail?.name) {
			onRename(configDetail!.id, editName.trim());
		}
		editingName = false;
		// Reset guard after tick so next rename works
		setTimeout(() => { renameCommitted = false; }, 0);
	}

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

<div class="card overflow-hidden">
	<!-- Config pills -->
	<div class="px-4 py-3">
		{#if loading}
			<div class="flex gap-2 flex-wrap">
				{#each Array(3) as _}
					<div class="skeleton h-7 w-24 rounded-full"></div>
				{/each}
			</div>
		{:else if error}
			<div class="text-center py-2">
				<p class="text-error text-sm mb-3">Failed to load configurations: {error}</p>
				<button onclick={onRetry} class="btn btn-primary text-xs py-1 px-3">Retry</button>
			</div>
		{:else if configs}
			{#if configs.length === 0}
				<div class="py-4 text-center">
					<FlaskConical size={28} class="mx-auto mb-2 text-text-theme-tertiary opacity-40" />
					<p class="text-sm text-text-theme-secondary mb-1">No search configurations yet</p>
					<p class="text-xs text-text-theme-tertiary">Create one to start tuning.</p>
				</div>
			{:else}
				<div class="flex gap-1.5 flex-wrap">
					{#each configs as c (c.id)}
						<button
							onclick={() => onSelect(c.id)}
							class="config-pill px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150
								{selectedId === c.id ? 'border-interactive bg-interactive/10 text-interactive' : 'border-[var(--color-border)] text-text-theme-secondary hover:border-interactive/50 hover:text-text-theme-primary'}
								{c.active ? 'ring-2 ring-green-500/30' : ''}"
						>
							{#if c.locked}<Lock size={10} class="inline mr-1 opacity-60" />{/if}
							{c.name}
							{#if c.active}<span class="ml-1 text-green-600 dark:text-green-400 text-[10px] font-bold uppercase tracking-wider">Live</span>{/if}
						</button>
					{/each}
				</div>
			{/if}
		{/if}
	</div>

	<!-- Config info bar + actions -->
	{#if configDetail}
		<div class="border-t border-theme px-4 py-2 flex items-center gap-1 text-xs text-text-theme-tertiary">
			<!-- Left: status -->
			<div class="flex items-center gap-2 mr-auto">
				{#if editingName}
					<form onsubmit={(e) => { e.preventDefault(); commitRename(); }} class="flex items-center gap-2">
						<input bind:value={editName} class="input text-xs py-0.5 px-2 w-44" autofocus
							onkeydown={(e) => { if (e.key === 'Escape') { editingName = false; } }}
							onblur={() => commitRename()}
						/>
					</form>
				{:else}
					{#if configDetail.locked}
						<span class="text-amber-600 font-medium flex items-center gap-1 text-[11px]"><Lock size={11} /> Locked</span>
					{:else if configDetail.active}
						<span class="text-green-600 font-medium flex items-center gap-1 text-[11px]"><Check size={11} /> Live</span>
					{:else}
						<button onclick={() => onActivate(configDetail.id)} class="text-green-600 hover:text-green-700 font-medium flex items-center gap-1 text-[11px] transition-colors">
							<Zap size={11} /> Activate
						</button>
					{/if}
				{/if}
			</div>

			<!-- Right: actions grouped with subtle separators -->
			<div class="flex items-center">
				{#if !configDetail.locked && !editingName}
					<button onclick={() => { editName = configDetail.name; editingName = true; }} class="config-action-btn" title="Rename config">
						<Pencil size={11} /> Rename
					</button>
				{/if}
				<button onclick={() => startClone(configDetail.id, configDetail.name)} class="config-action-btn">
					<Copy size={11} /> Clone
				</button>
				<button onclick={() => { cloneSourceId = null; newName = ''; showCreate = !showCreate; }} class="config-action-btn">
					<Plus size={12} /> New
				</button>
				{#if !configDetail.active && !configDetail.locked}
					<span class="w-px h-3.5 bg-[var(--color-border)] mx-1"></span>
					<button onclick={() => onDelete(configDetail.id)} class="config-action-btn text-red-400 hover:text-red-500">
						<Trash2 size={11} />
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Create/Clone form (inline) -->
	{#if showCreate}
		<div class="border-t border-theme px-4 py-3">
			<form onsubmit={(e) => { e.preventDefault(); handleCreate(); }} class="flex items-center gap-2">
				<label for="config-name-input" class="text-xs text-text-theme-secondary whitespace-nowrap">{cloneSourceId ? 'Clone as:' : 'Name:'}</label>
				<input id="config-name-input" bind:value={newName} class="input text-xs py-1 flex-1" placeholder="e.g., Experiment April 2026" autofocus />
				<button type="submit" class="btn btn-primary text-xs py-1 px-3">Create</button>
				<button type="button" onclick={() => showCreate = false} class="btn btn-outline text-xs py-1 px-2.5">Cancel</button>
			</form>
		</div>
	{/if}
</div>

<style>
	.config-action-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.6875rem;
		color: var(--color-text-secondary);
		transition: color 150ms ease, background-color 150ms ease;
	}
	.config-action-btn:hover {
		color: var(--color-text-primary);
		background-color: color-mix(in srgb, var(--color-interactive) 8%, transparent);
	}
</style>
