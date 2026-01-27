<script lang="ts">
	import { goto } from '$app/navigation';
	import { Search } from 'lucide-svelte';

	let searchQuery = $state('');

	function handleSearch(event: Event) {
		event.preventDefault();
		if (searchQuery.trim()) {
			goto(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
		}
	}
</script>

<div class="min-h-[80vh] flex flex-col">
	<!-- Hero Section -->
	<section class="flex-1 flex items-center justify-center bg-gradient-to-b from-chds-navy to-blue-900 text-white px-4 py-16">
		<div class="max-w-3xl w-full text-center">
			<h1 class="text-4xl md:text-5xl font-bold mb-4 !text-white">
				<span class="whitespace-nowrap">Homeland Security</span>{' '}
				<span class="whitespace-nowrap">Digital Library</span>
			</h1>
			<p class="text-lg md:text-xl text-blue-100 mb-8">
				Search over 70,000 documents on homeland security policy, strategy, and research
			</p>

			<!-- Search Box -->
			<form onsubmit={handleSearch} class="relative max-w-2xl mx-auto">
				<div class="relative">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search documents..."
						class="w-full px-6 py-4 pr-14 text-lg rounded-full text-text-theme-primary placeholder:text-text-theme-tertiary shadow-xl focus:outline-none focus:ring-4 focus:ring-chds-yellow"
					/>
					<button
						type="submit"
						class="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-chds-blue text-white rounded-full hover:bg-blue-700 transition-colors"
						aria-label="Search"
					>
						<Search class="w-5 h-5" />
					</button>
				</div>
			</form>

			<!-- Quick Links -->
			<div class="mt-8 flex flex-wrap justify-center gap-3">
				<a href="/search?q=cybersecurity&mode=semantic" class="badge bg-surface-elevated/20 text-white hover:bg-surface-elevated/30 transition-colors px-4 py-2 rounded-full text-sm">
					Cybersecurity
				</a>
				<a href="/search?q=terrorism&mode=semantic" class="badge bg-surface-elevated/20 text-white hover:bg-surface-elevated/30 transition-colors px-4 py-2 rounded-full text-sm">
					Terrorism
				</a>
				<a href="/search?q=emergency+management&mode=semantic" class="badge bg-surface-elevated/20 text-white hover:bg-surface-elevated/30 transition-colors px-4 py-2 rounded-full text-sm">
					Emergency Management
				</a>
				<a href="/search?q=border+security&mode=semantic" class="badge bg-surface-elevated/20 text-white hover:bg-surface-elevated/30 transition-colors px-4 py-2 rounded-full text-sm">
					Border Security
				</a>
			</div>
		</div>
	</section>

	<!-- Features Section -->
	<section class="py-16 px-4 bg-surface-elevated">
		<div class="max-w-6xl mx-auto">
			<h2 class="text-2xl font-bold text-center mb-12 text-text-theme-primary dark:text-white">
				Discover Research
			</h2>

			<div class="grid md:grid-cols-3 gap-8">
				<!-- Semantic Search -->
				<div class="card p-6">
					<div class="w-12 h-12 bg-chds-blue/10 rounded-lg flex items-center justify-center mb-4">
						<Search class="w-6 h-6 text-chds-blue" />
					</div>
					<h3 class="font-semibold text-lg mb-2">Semantic Search</h3>
					<p class="text-text-theme-secondary dark:text-text-theme-tertiary">
						Find documents by meaning, not just keywords. Our AI-powered search understands your research intent.
					</p>
				</div>

				<!-- Browse Topics -->
				<div class="card p-6">
					<div class="w-12 h-12 bg-chds-blue/10 rounded-lg flex items-center justify-center mb-4">
						<svg class="w-6 h-6 text-chds-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16" />
						</svg>
					</div>
					<h3 class="font-semibold text-lg mb-2">Browse by Topic</h3>
					<p class="text-text-theme-secondary dark:text-text-theme-tertiary">
						Explore documents organized by subject area, document type, and organization.
					</p>
				</div>

				<!-- AI Assistant -->
				<div class="card p-6">
					<div class="w-12 h-12 bg-chds-blue/10 rounded-lg flex items-center justify-center mb-4">
						<svg class="w-6 h-6 text-chds-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
						</svg>
					</div>
					<h3 class="font-semibold text-lg mb-2">AI Assistant</h3>
					<p class="text-text-theme-secondary dark:text-text-theme-tertiary">
						Ask questions in natural language and get intelligent answers from our document collection.
					</p>
				</div>
			</div>
		</div>
	</section>
</div>
