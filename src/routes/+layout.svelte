<script lang="ts">
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { inkApi } from '$lib/services/ink-api';
	import { LayoutDashboard, FileText, Search, Info, Menu, X, Keyboard, Sun, Moon, Monitor, Zap, BarChart3, SlidersHorizontal, MessageSquare } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { initTheme, destroyTheme, setColorMode, getThemeState, type ColorMode } from '$lib/stores/theme.svelte';
	import '../app.css';

	let { children } = $props();

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 2 * 60 * 1000,
				gcTime: 10 * 60 * 1000
			}
		}
	});

	onMount(() => {
		initTheme();
		inkApi.getReleaseNotes().then((notes) => { if (notes?.[0]) appVersion = notes[0].version; }).catch(() => {});
		return () => destroyTheme();
	});

	let themeState = $derived(getThemeState());
	const modeIcons = { light: Sun, dark: Moon, auto: Monitor } as const;
	const modeOrder: ColorMode[] = ['light', 'dark', 'auto'];

	function cycleColorMode() {
		const idx = modeOrder.indexOf(themeState.colorMode);
		setColorMode(modeOrder[(idx + 1) % modeOrder.length]);
	}

	let user = $state<{ id: string; name: string; email: string; role: string | null } | null>(null);
	let authChecked = $state(false);
	let accessDenied = $state(false);
	let mobileMenuOpen = $state(false);
	let showShortcuts = $state(false);

	// Build the INK login URL on the Rails server.
	// This endpoint stores return_to in a cookie, then redirects to OAuth.
	// After login, the OAuth callback redirects back to our SvelteKit app.
	const API_BASE = import.meta.env.VITE_API_BASE || '/api/spa/v1';
	const INK_BASE = API_BASE.replace('/spa/', '/ink/');

	$effect(() => {
		inkApi
			.getMe()
			.then((u) => {
				user = u;
				authChecked = true;
			})
			.catch((err) => {
				authChecked = true;
				if (err?.status === 403) {
					accessDenied = true;
					return;
				}
				// 401 or network error — redirect to login
				const returnTo = encodeURIComponent(window.location.href);
				window.location.href = `${INK_BASE}/auth/login?return_to=${returnTo}`;
			});
	});

	let appVersion = $state<string | null>(null);

	let currentPath = $derived($page.url.pathname);
	let isEditorPage = $derived(currentPath.match(/\/documents\/[^/]+$/) !== null);

	const navItems = [
		{ href: `${base}/`, label: 'Dashboard', icon: LayoutDashboard },
		{ href: `${base}/documents`, label: 'Documents', icon: FileText },
		{ href: `${base}/search`, label: 'Search', icon: Search },
		{ href: `${base}/enrichment`, label: 'Enrichment', icon: Zap },
		{ href: `${base}/eval`, label: 'Eval', icon: BarChart3 },
		{ href: `${base}/lab`, label: 'Lab', icon: SlidersHorizontal },
		{ href: `${base}/feedback`, label: 'Feedback', icon: MessageSquare },
		{ href: `${base}/overview`, label: 'Overview', icon: Info }
	];

	function isActive(href: string): boolean {
		if (href === `${base}/`) return currentPath === `${base}` || currentPath === `${base}/`;
		return currentPath.startsWith(href);
	}

	function handleGlobalKeydown(e: KeyboardEvent) {
		if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
			const target = e.target as HTMLElement;
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
			e.preventDefault();
			showShortcuts = !showShortcuts;
		}
		if (e.key === 'Escape' && showShortcuts) {
			showShortcuts = false;
		}
	}
</script>

<svelte:head>
	<title>INK - HSDL Collection Management</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&family=Source+Serif+Pro:wght@400;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<svelte:window onkeydown={handleGlobalKeydown} />

<QueryClientProvider client={queryClient}>
	{#if !authChecked}
		<div class="min-h-screen flex items-center justify-center bg-surface">
			<div class="animate-pulse text-text-theme-secondary">Loading INK...</div>
		</div>
	{:else if accessDenied}
		<div class="min-h-screen flex items-center justify-center bg-surface">
			<div class="text-center">
				<p class="text-text-theme-primary text-lg font-semibold mb-2">Access Denied</p>
				<p class="text-text-theme-secondary text-sm">INK requires a librarian role. Contact your administrator.</p>
			</div>
		</div>
	{:else if !user}
		<div class="min-h-screen flex items-center justify-center bg-surface">
			<p class="text-text-theme-secondary">Redirecting to login...</p>
		</div>
	{:else}
		<div class="min-h-screen flex flex-col bg-surface text-text-theme-primary">
			<!-- Top Navigation Bar (compact, horizontal) -->
			<header class="h-10 bg-surface-elevated border-b border-theme flex items-center px-4 flex-shrink-0 z-40">
				<!-- Brand -->
				<a href="{base}/" class="flex items-center gap-1.5 mr-6 flex-shrink-0">
					<span class="text-sm font-bold text-interactive tracking-tight">INK</span>
					<span class="text-xs text-text-theme-tertiary hidden sm:inline">Collection Manager</span>
				</a>

				<!-- Desktop Nav -->
				<nav class="hidden md:flex items-center gap-0.5 flex-1">
					{#each navItems as item}
						{@const Icon = item.icon}
						<a
							href={item.href}
							class="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors
								{isActive(item.href)
								? 'bg-primary-100 text-primary-700'
								: 'text-text-theme-secondary hover:bg-surface-secondary hover:text-text-theme-primary'}"
						>
							<Icon size={14} />
							{item.label}
						</a>
					{/each}
				</nav>

				<!-- Right side: version, controls, user -->
				<div class="hidden md:flex items-center gap-3 ml-auto">
					{#if appVersion}
						<a
							href="{base}/releases"
							class="text-xs tabular-nums transition-colors
								{isActive(`${base}/releases`)
								? 'text-text-theme-primary font-medium'
								: 'text-text-theme-tertiary hover:text-text-theme-secondary'}"
						>v{appVersion}</a>
					{/if}
					<button
						onclick={cycleColorMode}
						class="text-text-theme-tertiary hover:text-text-theme-secondary transition-colors"
						aria-label="Toggle color mode ({themeState.colorMode})"
						title="Color mode: {themeState.colorMode}"
					>
						{#if modeIcons[themeState.colorMode]}
							{@const ModeIcon = modeIcons[themeState.colorMode]}
							<ModeIcon size={14} />
						{/if}
					</button>
					<button
						onclick={() => (showShortcuts = !showShortcuts)}
						class="text-text-theme-tertiary hover:text-text-theme-secondary transition-colors"
						aria-label="Keyboard shortcuts"
						title="Keyboard shortcuts (?)"
					>
						<Keyboard size={14} />
					</button>
					<div class="flex items-center gap-2 text-xs text-text-theme-secondary">
						<span class="truncate max-w-[120px]">{user.name || user.email}</span>
						<span class="text-text-theme-tertiary">{user.role || 'Librarian'}</span>
					</div>
				</div>

				<!-- Mobile hamburger -->
				<button onclick={() => (mobileMenuOpen = !mobileMenuOpen)} class="md:hidden ml-auto p-1.5 touch-target" aria-label="Toggle menu">
					{#if mobileMenuOpen}
						<X size={18} />
					{:else}
						<Menu size={18} />
					{/if}
				</button>
			</header>

			<!-- Mobile dropdown menu -->
			{#if mobileMenuOpen}
				<div class="md:hidden bg-surface-elevated border-b border-theme px-4 py-2 space-y-1 z-30">
					{#each navItems as item}
						{@const Icon = item.icon}
						<a
							href={item.href}
							onclick={() => (mobileMenuOpen = false)}
							class="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors
								{isActive(item.href)
								? 'bg-primary-100 text-primary-700'
								: 'text-text-theme-secondary hover:bg-surface-secondary hover:text-text-theme-primary'}"
						>
							<Icon size={16} />
							{item.label}
						</a>
					{/each}
					{#if appVersion}
						<a
							href="{base}/releases"
							onclick={() => (mobileMenuOpen = false)}
							class="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors
								{isActive(`${base}/releases`)
								? 'bg-primary-100 text-primary-700'
								: 'text-text-theme-secondary hover:bg-surface-secondary hover:text-text-theme-primary'}"
						>v{appVersion}</a>
					{/if}
					<div class="px-3 py-2 border-t border-theme mt-1 pt-2">
						<p class="text-xs text-text-theme-secondary">{user.name || user.email}</p>
					</div>
				</div>
			{/if}

			<!-- Main Content -->
			<main class="flex-1 overflow-auto {isEditorPage ? '' : 'py-4'}">
				<div class="{isEditorPage ? 'px-4 h-full' : 'max-w-7xl mx-auto px-4 sm:px-6'}">
					{@render children()}
				</div>
			</main>
		</div>

		<!-- Keyboard Shortcuts Modal -->
		{#if showShortcuts}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onclick={() => (showShortcuts = false)} onkeydown={() => {}}>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="bg-surface-elevated rounded-lg shadow-xl border border-theme max-w-sm w-full p-4" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-sm font-semibold text-text-theme-primary">Keyboard Shortcuts</h2>
						<button onclick={() => (showShortcuts = false)} class="text-text-theme-tertiary hover:text-text-theme-primary">
							<X size={16} />
						</button>
					</div>
					<div class="space-y-2 text-xs">
						<div class="font-medium text-text-theme-secondary uppercase tracking-wide mb-1">Document Browser</div>
						<div class="flex justify-between"><span class="text-text-theme-secondary">Move down</span><kbd class="kbd">j</kbd></div>
						<div class="flex justify-between"><span class="text-text-theme-secondary">Move up</span><kbd class="kbd">k</kbd></div>
						<div class="flex justify-between"><span class="text-text-theme-secondary">Open document</span><kbd class="kbd">Enter</kbd></div>
						<div class="flex justify-between"><span class="text-text-theme-secondary">Focus search</span><kbd class="kbd">/</kbd></div>
						<div class="flex justify-between"><span class="text-text-theme-secondary">Toggle selection</span><kbd class="kbd">x</kbd></div>
						<div class="border-t border-theme my-2"></div>
						<div class="font-medium text-text-theme-secondary uppercase tracking-wide mb-1">Global</div>
						<div class="flex justify-between"><span class="text-text-theme-secondary">Show shortcuts</span><kbd class="kbd">?</kbd></div>
						<div class="flex justify-between"><span class="text-text-theme-secondary">Close modal</span><kbd class="kbd">Esc</kbd></div>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</QueryClientProvider>
