<script lang="ts">
	// Mirrors hsdl-next's OrgAccessStatus line: "Organization Access:" then the
	// organization's name, bold, verbatim. Whatever is typed in the name field is
	// exactly what every visitor on the organization's network reads.
	let { name, caption = 'Visitors on this organization’s network see' }: { name: string; caption?: string } = $props();
	let shown = $derived(name.trim());
</script>

<figure class="rounded-md border border-border-theme bg-surface-secondary px-3 py-2">
	<figcaption class="mb-1 text-[11px] uppercase tracking-wide text-text-theme-tertiary">{caption}</figcaption>
	<p class="text-sm text-text-theme-primary [overflow-wrap:anywhere]" aria-label="Banner preview">
		<span class="opacity-80">Organization Access:</span>
		{#if shown}
			<span class="font-bold">{shown}</span>
		{:else}
			<span class="italic text-text-theme-tertiary">(no name yet)</span>
		{/if}
	</p>
</figure>
