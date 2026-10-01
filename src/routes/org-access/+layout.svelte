<script lang="ts">
	// Org access is admin-only: every rule here extends "registered user" to a
	// whole network under our publishers' terms. The server answers 403 to
	// anyone else; this guard just says so plainly instead of showing errors.
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { createQuery } from '@tanstack/svelte-query';
	import { inkApi } from '$lib/services/ink-api';
	import { ShieldAlert } from 'lucide-svelte';

	let { children } = $props();

	const meQuery = createQuery({
		queryKey: ['ink', 'me'],
		queryFn: () => inkApi.getMe()
	});

	const tabs = [
		{ href: `${base}/org-access`, label: 'Overview', exact: true },
		{ href: `${base}/org-access/orgs`, label: 'Organizations' },
		{ href: `${base}/org-access/test`, label: 'Test an address' },
		{ href: `${base}/org-access/requests`, label: 'Requests' },
		{ href: `${base}/org-access/keys`, label: 'Machine keys' }
	];

	let path = $derived($page.url.pathname.replace(/\/$/, ''));
	function active(t: (typeof tabs)[number]) {
		return t.exact ? path === t.href : path.startsWith(t.href);
	}
</script>

{#if $meQuery.isPending}
	<p class="p-6 text-sm text-text-theme-secondary">Checking access…</p>
{:else if !$meQuery.data?.admin}
	<div class="mx-auto max-w-lg p-10 text-center">
		<ShieldAlert class="mx-auto mb-3 h-8 w-8 text-text-theme-tertiary" />
		<p class="text-lg font-semibold text-text-theme-primary">Organization access is for admins only</p>
		<p class="mt-1 text-sm text-text-theme-secondary">
			Ask an INK admin if you need to set up or check access for an organization.
		</p>
	</div>
{:else}
	<div class="mx-auto max-w-6xl p-6">
		<div class="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-border-theme">
			<h1 class="pb-2 text-xl font-semibold text-text-theme-primary">Organization access</h1>
			<nav class="flex gap-1" aria-label="Organization access sections">
				{#each tabs as t}
					<a
						href={t.href}
						aria-current={active(t) ? 'page' : undefined}
						class="-mb-px border-b-2 px-3 pb-2 text-sm transition-colors
							{active(t)
							? 'border-interactive font-medium text-text-theme-primary'
							: 'border-transparent text-text-theme-secondary hover:text-text-theme-primary'}"
					>
						{t.label}
					</a>
				{/each}
			</nav>
		</div>
		{@render children?.()}
	</div>
{/if}
