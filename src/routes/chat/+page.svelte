<script lang="ts">
	import { MessageSquare, Sparkles, Search, BookOpen, ArrowRight } from 'lucide-svelte';
</script>

<svelte:head>
	<title>AI Assistant | HSDL</title>
	<meta name="description" content="Chat with HSDL's AI research assistant" />
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-12 sm:py-16">
	<div class="text-center">
		<!-- Icon -->
		<div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-chds-blue to-chds-navy mb-6">
			<MessageSquare class="w-10 h-10 text-white" />
		</div>

		<!-- Title -->
		<h1 class="text-3xl sm:text-4xl font-bold text-chds-navy mb-4">
			AI Research Assistant
		</h1>

		<!-- Description -->
		<p class="text-lg text-text-theme-secondary mb-8 max-w-xl mx-auto">
			Ask questions about homeland security topics and get AI-powered answers with citations from the HSDL collection.
		</p>

		<!-- Coming Soon Badge -->
		<div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-chds-gold/20 text-chds-navy font-medium mb-10">
			<Sparkles class="w-4 h-4" />
			Coming Soon
		</div>

		<!-- Preview Features -->
		<div class="grid sm:grid-cols-2 gap-4 mb-10">
			<div class="card p-5 text-left">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
						<Search class="w-5 h-5 text-chds-blue" />
					</div>
					<h3 class="font-semibold text-text-theme-primary">Semantic Search</h3>
				</div>
				<p class="text-sm text-text-theme-secondary">
					Find documents based on meaning, not just keywords. Ask complex questions and get relevant results.
				</p>
			</div>
			<div class="card p-5 text-left">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
						<BookOpen class="w-5 h-5 text-chds-blue" />
					</div>
					<h3 class="font-semibold text-text-theme-primary">Cited Answers</h3>
				</div>
				<p class="text-sm text-text-theme-secondary">
					Every answer includes citations to source documents so you can verify and explore further.
				</p>
			</div>
		</div>

		<!-- CTA -->
		<div class="space-y-4">
			<p class="text-sm text-text-theme-tertiary">In the meantime, explore using traditional search:</p>
			<a href="/search" class="btn btn-primary inline-flex items-center gap-2">
				Search Documents
				<ArrowRight class="w-4 h-4" />
			</a>
		</div>
	</div>
</div>
