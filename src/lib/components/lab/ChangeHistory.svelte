<script lang="ts">
	// Audit history for the selected config (issue 4b256426): renders the
	// SearchConfigurationChange rows — edits and activations — that were
	// previously write-only.
	import { createQuery } from '@tanstack/svelte-query';
	import { derived, writable } from 'svelte/store';
	import { inkApi, type SearchConfigChange } from '$lib/services/ink-api';
	import { History, Zap } from 'lucide-svelte';

	let { configId }: { configId: string } = $props();

	// TanStack 5.90 uses Svelte stores for reactive query options, not
	// $derived runes — bridge via writable+derived (same pattern as the
	// lab page's selectedIdStore). Initialized empty; the effect seeds it.
	const configIdStore = writable<string>("");
	$effect(() => {
		configIdStore.set(configId);
	});

	const changesQuery = createQuery(
		derived(configIdStore, ($id) => ({
			queryKey: ['ink', 'search_config_changes', $id] as const,
			queryFn: () => inkApi.getSearchConfigChanges($id),
			enabled: !!$id
		}))
	);

	function isActivation(change: SearchConfigChange): boolean {
		return change.changed_fields.length === 1 && change.changed_fields[0] === 'active';
	}

	function formatWhen(iso: string): string {
		return new Date(iso).toLocaleString(undefined, {
			month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
		});
	}
</script>

<div>
	{#if $changesQuery.isPending}
		<p class="text-xs text-text-theme-tertiary py-3">Loading history...</p>
	{:else if $changesQuery.isError}
		<p class="text-xs text-red-600 dark:text-red-400 py-3">Could not load history: {$changesQuery.error.message}</p>
	{:else if ($changesQuery.data ?? []).length === 0}
		<div class="py-6 text-center">
			<History size={24} class="mx-auto mb-2 text-text-theme-tertiary opacity-40" />
			<p class="text-xs text-text-theme-tertiary">No recorded changes yet. Edits and activations appear here.</p>
		</div>
	{:else}
		<ul class="divide-y divide-theme">
			{#each $changesQuery.data ?? [] as change (change.id)}
				<li class="py-2 flex items-start gap-2">
					{#if isActivation(change)}
						<Zap size={13} class="text-green-600 shrink-0 mt-0.5" />
					{:else}
						<History size={13} class="text-text-theme-tertiary shrink-0 mt-0.5" />
					{/if}
					<div class="min-w-0">
						<div class="text-xs text-text-theme-primary">
							{#if isActivation(change)}
								<span class="font-medium text-green-700 dark:text-green-400">Activated</span>
								{#if change.previous_values?.previously_active}
									<span class="text-text-theme-tertiary"> (replacing {change.previous_values.previously_active})</span>
								{/if}
							{:else}
								Edited <span class="font-medium">{change.changed_fields.filter((f) => f !== 'updated_at').join(', ')}</span>
							{/if}
						</div>
						<div class="text-[10px] text-text-theme-tertiary mt-0.5">
							{formatWhen(change.created_at)}{#if change.user}&nbsp;&middot;&nbsp;{change.user}{/if}
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
