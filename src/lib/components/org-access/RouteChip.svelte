<script lang="ts">
	import Chip from './Chip.svelte';
	import { ROUTE_INFO, routeLabel } from '$lib/utils/org-access';
	import type { Route } from '$lib/services/org-access-api';

	let { route }: { route: Route | string | null } = $props();
	let help = $derived(ROUTE_INFO[route as Route]?.help ?? '');
</script>

<Chip tone="neutral" title={help}>{routeLabel(route)}</Chip>
