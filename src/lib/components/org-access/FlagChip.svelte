<script lang="ts">
	import Chip from './Chip.svelte';
	import { flagInfo } from '$lib/utils/org-access';

	let { flag }: { flag: string } = $props();
	let info = $derived(flagInfo(flag));
</script>

<Chip tone={info.tone} title={info.help}>{info.label}</Chip>
