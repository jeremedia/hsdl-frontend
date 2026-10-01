<script lang="ts">
	// Who changed what, newest first. Every edit to an organization, its
	// addresses and its requests is recorded on the server (paper_trail).
	import type { HistoryEntry } from '$lib/services/org-access-api';
	import { describeChanges, describeHistoryEvent, fmtDateTime, historyActor } from '$lib/utils/org-access';

	let { entries }: { entries: HistoryEntry[] } = $props();
</script>

{#if entries.length === 0}
	<p class="text-sm text-text-theme-secondary">No changes recorded yet.</p>
{:else}
	<ol class="divide-y divide-border-theme">
		{#each entries as entry, i (`${entry.item_type}-${entry.item_id}-${entry.at}-${i}`)}
			{@const changes = describeChanges(entry)}
			<li class="py-2 text-sm">
				<p class="text-text-theme-primary">
					<span class="font-medium">{describeHistoryEvent(entry)}</span>
					<span class="text-text-theme-secondary">
						· {historyActor(entry)} · {fmtDateTime(entry.at)}</span
					>
				</p>
				{#if changes.length}
					<ul class="mt-1 space-y-0.5 text-xs text-text-theme-secondary">
						{#each changes as c}
							<li>
								<span class="text-text-theme-primary">{c.field}:</span>
								{#if entry.event === 'create'}
									{c.after}
								{:else}
									<span class="line-through opacity-80">{c.before}</span> → {c.after}
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ol>
{/if}
