<script lang="ts">
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import '../app.css';

	let { children } = $props();

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 5 * 60 * 1000, // 5 minutes
				gcTime: 30 * 60 * 1000 // 30 minutes (was cacheTime)
			}
		}
	});

	let mobileMenuOpen = $state(false);
</script>

<svelte:head>
	<title>HSDL - Homeland Security Digital Library</title>
	<meta name="description" content="Search and discover homeland security research documents" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<QueryClientProvider client={queryClient}>
	<div class="min-h-screen flex flex-col">
		<!-- Header -->
		<header class="bg-chds-navy text-white sticky top-0 z-50">
			<div class="max-w-7xl mx-auto px-4">
				<div class="flex items-center justify-between h-16">
					<!-- Logo -->
					<a href="/" class="flex items-center gap-2 font-semibold text-lg">
						<span class="text-chds-yellow">HSDL</span>
					</a>

					<!-- Desktop Nav -->
					<nav class="hidden md:flex items-center gap-6">
						<a href="/search" class="hover:text-chds-yellow transition-colors">Search</a>
						<a href="/browse" class="hover:text-chds-yellow transition-colors">Browse</a>
						<a href="/chat" class="hover:text-chds-yellow transition-colors">AI Assistant</a>
						<a href="/speed" class="flex items-center gap-1.5 hover:text-chds-yellow transition-colors">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
							Speed
							<span class="px-1 py-0.5 text-[10px] font-bold bg-amber-400 text-amber-900 rounded">DEV</span>
						</a>
					</nav>

					<!-- Mobile menu button -->
					<button
						class="md:hidden p-2 touch-target"
						onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
						aria-label="Toggle menu"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							{#if mobileMenuOpen}
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							{:else}
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 6h16M4 12h16M4 18h16"
								/>
							{/if}
						</svg>
					</button>
				</div>

				<!-- Mobile Nav -->
				{#if mobileMenuOpen}
					<nav class="md:hidden py-4 border-t border-white/20">
						<a
							href="/search"
							class="block py-2 hover:text-chds-yellow"
							onclick={() => (mobileMenuOpen = false)}
						>
							Search
						</a>
						<a
							href="/browse"
							class="block py-2 hover:text-chds-yellow"
							onclick={() => (mobileMenuOpen = false)}
						>
							Browse
						</a>
						<a
							href="/chat"
							class="block py-2 hover:text-chds-yellow"
							onclick={() => (mobileMenuOpen = false)}
						>
							AI Assistant
						</a>
						<a
							href="/speed"
							class="flex items-center gap-2 py-2 hover:text-chds-yellow"
							onclick={() => (mobileMenuOpen = false)}
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
							Speed
							<span class="px-1 py-0.5 text-[10px] font-bold bg-amber-400 text-amber-900 rounded">DEV</span>
						</a>
					</nav>
				{/if}
			</div>
		</header>

		<!-- Main Content -->
		<main class="flex-1">
			{@render children()}
		</main>

		<!-- Footer -->
		<footer class="bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
			<div class="max-w-7xl mx-auto px-4 py-8">
				<div class="text-center text-sm text-gray-600 dark:text-gray-400">
					<p>Homeland Security Digital Library</p>
					<p class="mt-1">A service of the Center for Homeland Defense and Security</p>
				</div>
			</div>
		</footer>
	</div>
</QueryClientProvider>
