<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TONE_CLASSES, type Tone } from '$lib/utils/org-access';

	let { tone = 'neutral', title, children }: { tone?: Tone; title?: string; children?: Snippet } = $props();
</script>

<span
	class="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none {TONE_CLASSES[tone]}"
	{title}
>
	{@render children?.()}
</span>
