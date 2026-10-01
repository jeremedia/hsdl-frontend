<script lang="ts">
	// The address tester, full size. The tested address is kept in the URL
	// (?ip=) so a result can be shared or reopened.
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import IpTester from '$lib/components/org-access/IpTester.svelte';

	const initialIp = $page.url.searchParams.get('ip') ?? '';

	function remember(ip: string) {
		if (ip === ($page.url.searchParams.get('ip') ?? '')) return;
		goto(`${base}/org-access/test?ip=${encodeURIComponent(ip)}`, { replaceState: true, keepFocus: true, noScroll: true });
	}
</script>

<section class="card rounded-md p-5">
	<h2 class="text-lg font-semibold text-text-theme-primary">Test an address</h2>
	<p class="mb-4 max-w-3xl text-sm text-text-theme-secondary">
		Enter the address a visitor sent (they can see it on the public site’s “check access” page). You’ll see whether
		they get organization access, which organization they’d see, and every address on file that mentions theirs,
		including ones that are turned off or overruled by a more specific address. Changes you make here are tested
		right away.
	</p>
	<IpTester {initialIp} autoRun onTested={remember} />
</section>
