<script lang="ts">
	import {
		FileText, Search, LayoutDashboard, ScrollText, Database,
		Shield, Eye, Keyboard, Save, BarChart3, Tags, BookOpen,
		Layers, ArrowRight, CheckCircle2, Users, Sparkles, Clock,
		Filter, Table2, PanelLeftClose, Heart
	} from 'lucide-svelte';

	// Smooth scroll to section
	function scrollTo(id: string) {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	const sections = [
		{ id: 'browser', label: 'Document Browser' },
		{ id: 'editor', label: 'Document Editor' },
		{ id: 'search', label: 'Search' },
		{ id: 'dashboard', label: 'Dashboard' },
		{ id: 'health', label: 'Health Scores' },
		{ id: 'persistence', label: 'State Persistence' },
		{ id: 'releases', label: 'Version Notes' },
		{ id: 'next', label: 'What\'s Next' }
	];
</script>

<svelte:head>
	<title>Overview | INK</title>
</svelte:head>

<div class="max-w-4xl mx-auto space-y-16 pb-16">

	<!-- Hero -->
	<section class="text-center pt-8 pb-4">
		<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs font-medium mb-4">
			<Sparkles size={12} />
			Phase 1 -- March 2026
		</div>
		<h1 class="text-3xl font-bold text-text-theme-primary tracking-tight">
			INK Collection Manager
		</h1>
		<p class="text-lg text-text-theme-secondary mt-3 max-w-2xl mx-auto leading-relaxed">
			A purpose-built workspace for managing the 307,000-document HSDL collection.
			Replaces the MDT module with an interface designed around how librarians actually work.
		</p>
		<div class="flex items-center justify-center gap-6 mt-6 text-sm text-text-theme-tertiary">
			<span class="flex items-center gap-1.5"><Database size={14} /> 307K documents</span>
			<span class="flex items-center gap-1.5"><Tags size={14} /> 150K vocabulary terms</span>
			<span class="flex items-center gap-1.5"><Users size={14} /> 5 librarians</span>
		</div>
	</section>

	<!-- Section Nav -->
	<nav class="sticky top-10 z-30 bg-surface/90 backdrop-blur-sm -mx-4 px-4 py-2 border-b border-theme">
		<div class="flex items-center gap-1 overflow-x-auto text-xs">
			{#each sections as s}
				<button
					onclick={() => scrollTo(s.id)}
					class="px-2.5 py-1 rounded whitespace-nowrap text-text-theme-secondary hover:text-text-theme-primary hover:bg-surface-secondary transition-colors"
				>
					{s.label}
				</button>
			{/each}
		</div>
	</nav>

	<!-- Document Browser -->
	<section id="browser" class="scroll-mt-24">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
				<Table2 size={18} class="text-blue-600 dark:text-blue-400" />
			</div>
			<div>
				<h2 class="text-xl font-bold text-text-theme-primary">Document Browser</h2>
				<p class="text-sm text-text-theme-tertiary">The main workhorse -- browse, filter, and sort the entire collection</p>
			</div>
		</div>

		<div class="card p-5 space-y-4">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<div class="flex gap-3">
					<Filter size={16} class="text-blue-500 mt-0.5 flex-shrink-0" />
					<div>
						<p class="text-sm font-medium text-text-theme-primary">Filters</p>
						<p class="text-xs text-text-theme-secondary">By enable status, PDF availability, embedding status, and text search. All filters combine and persist.</p>
					</div>
				</div>
				<div class="flex gap-3">
					<BarChart3 size={16} class="text-blue-500 mt-0.5 flex-shrink-0" />
					<div>
						<p class="text-sm font-medium text-text-theme-primary">Sortable Columns</p>
						<p class="text-xs text-text-theme-secondary">Title, source, terms, health score, year, status, last modified. Click any header to sort.</p>
					</div>
				</div>
				<div class="flex gap-3">
					<Keyboard size={16} class="text-blue-500 mt-0.5 flex-shrink-0" />
					<div>
						<p class="text-sm font-medium text-text-theme-primary">Keyboard Navigation</p>
						<p class="text-xs text-text-theme-secondary"><kbd class="kbd">j</kbd>/<kbd class="kbd">k</kbd> to move, <kbd class="kbd">Enter</kbd> to open, <kbd class="kbd">/</kbd> to search, <kbd class="kbd">n</kbd>/<kbd class="kbd">p</kbd> for pages.</p>
					</div>
				</div>
				<div class="flex gap-3">
					<Layers size={16} class="text-blue-500 mt-0.5 flex-shrink-0" />
					<div>
						<p class="text-sm font-medium text-text-theme-primary">Page Size</p>
						<p class="text-xs text-text-theme-secondary">25, 50, or 100 rows per page. Your choice persists across sessions.</p>
					</div>
				</div>
			</div>
			<div class="pt-2 border-t border-theme">
				<a href="/ink/documents" class="text-xs font-medium text-interactive hover:underline inline-flex items-center gap-1">
					Open Document Browser <ArrowRight size={12} />
				</a>
			</div>
		</div>
	</section>

	<!-- Document Editor -->
	<section id="editor" class="scroll-mt-24">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
				<FileText size={18} class="text-purple-600 dark:text-purple-400" />
			</div>
			<div>
				<h2 class="text-xl font-bold text-text-theme-primary">Document Editor</h2>
				<p class="text-sm text-text-theme-tertiary">Two-column layout: metadata on the left, PDF preview on the right</p>
			</div>
		</div>

		<div class="card p-5">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
				<!-- Left: metadata form -->
				<div class="space-y-3">
					<h3 class="text-sm font-semibold text-text-theme-primary flex items-center gap-2">
						<PanelLeftClose size={14} /> Metadata Form
					</h3>
					<div class="space-y-2">
						{#each [
							{ label: 'Core Metadata', desc: 'Title, description, publish date, URL, report number' },
							{ label: 'Classification', desc: 'Enable/disable toggle, audience selector' },
							{ label: 'Vocabulary Terms', desc: 'All 20 vocabulary fields grouped with term counts' },
							{ label: 'MARC Subjects', desc: 'Topical, geographic, and genre/form headings' },
							{ label: 'Health Score', desc: 'Visual breakdown of all 12 health signals' },
							{ label: 'AI Content', desc: 'Tags, summary, entities (read-only)' }
						] as item}
							<div class="flex items-start gap-2">
								<CheckCircle2 size={12} class="text-purple-400 mt-0.5 flex-shrink-0" />
								<div>
									<span class="text-xs font-medium text-text-theme-primary">{item.label}</span>
									<span class="text-xs text-text-theme-tertiary"> -- {item.desc}</span>
								</div>
							</div>
						{/each}
					</div>
					<p class="text-xs text-text-theme-tertiary italic">All sections are collapsible and remember their state.</p>
				</div>

				<!-- Right: preview -->
				<div class="space-y-3">
					<h3 class="text-sm font-semibold text-text-theme-primary flex items-center gap-2">
						<Eye size={14} /> PDF Preview
					</h3>
					<div class="bg-surface-secondary rounded-lg p-4 space-y-2">
						<p class="text-xs text-text-theme-secondary">
							Inline PDF viewer when a document has a PDF attached. For documents without PDFs, falls back to an external link.
						</p>
						<p class="text-xs text-text-theme-secondary">
							Toggle with the header button or <kbd class="kbd">Ctrl+Shift+P</kbd>. Visibility persists across sessions.
						</p>
						<p class="text-xs text-text-theme-secondary">
							65% of the collection (200K documents) now has PDFs in S3.
						</p>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Search -->
	<section id="search" class="scroll-mt-24">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
				<Search size={18} class="text-sky-600 dark:text-sky-400" />
			</div>
			<div>
				<h2 class="text-xl font-bold text-text-theme-primary">Search</h2>
				<p class="text-sm text-text-theme-tertiary">Three modes for different needs</p>
			</div>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
			{#each [
				{
					mode: 'Semantic',
					desc: 'Finds documents by meaning, even when exact words differ. Ask a question or describe a concept.',
					example: '"documents about critical infrastructure resilience"',
					color: 'bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800'
				},
				{
					mode: 'Keyword',
					desc: 'Matches exact terms in title and description. Best for duplicate checking by title.',
					example: '"National Infrastructure Protection Plan"',
					color: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
				},
				{
					mode: 'Combined',
					desc: 'Blends semantic meaning with keyword matching for balanced results.',
					example: '"NIPP critical infrastructure"',
					color: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
				}
			] as s}
				<div class="card p-4 border {s.color}">
					<h3 class="text-sm font-semibold text-text-theme-primary mb-1">{s.mode}</h3>
					<p class="text-xs text-text-theme-secondary mb-2">{s.desc}</p>
					<p class="text-[0.625rem] text-text-theme-tertiary italic">{s.example}</p>
				</div>
			{/each}
		</div>
		<div class="mt-3">
			<a href="/ink/search" class="text-xs font-medium text-interactive hover:underline inline-flex items-center gap-1">
				Open Search <ArrowRight size={12} />
			</a>
		</div>
	</section>

	<!-- Dashboard -->
	<section id="dashboard" class="scroll-mt-24">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
				<LayoutDashboard size={18} class="text-emerald-600 dark:text-emerald-400" />
			</div>
			<div>
				<h2 class="text-xl font-bold text-text-theme-primary">Dashboard</h2>
				<p class="text-sm text-text-theme-tertiary">Collection overview at a glance</p>
			</div>
		</div>

		<div class="card p-5">
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
				{#each [
					{ label: 'Total Documents', value: '307K', icon: Database },
					{ label: 'Health Average', value: 'Scored', icon: Heart },
					{ label: 'Missing Metadata', value: 'Tracked', icon: BarChart3 },
					{ label: 'Recent Additions', value: 'Last 10', icon: Clock }
				] as stat}
					{@const Icon = stat.icon}
					<div class="text-center">
						<div class="w-8 h-8 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-1.5">
							<Icon size={14} class="text-text-theme-tertiary" />
						</div>
						<p class="text-sm font-semibold text-text-theme-primary">{stat.value}</p>
						<p class="text-[0.625rem] text-text-theme-tertiary">{stat.label}</p>
					</div>
				{/each}
			</div>
			<p class="text-xs text-text-theme-secondary border-t border-theme pt-3">
				Quick-link filters jump straight to problem areas: documents missing descriptions, low health scores, no FAST subjects, no embeddings.
			</p>
			<div class="pt-2">
				<a href="/ink" class="text-xs font-medium text-interactive hover:underline inline-flex items-center gap-1">
					Open Dashboard <ArrowRight size={12} />
				</a>
			</div>
		</div>
	</section>

	<!-- Health Scores -->
	<section id="health" class="scroll-mt-24">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
				<Heart size={18} class="text-orange-600 dark:text-orange-400" />
			</div>
			<div>
				<h2 class="text-xl font-bold text-text-theme-primary">Document Health</h2>
				<p class="text-sm text-text-theme-tertiary">12 signals scored 0-100% for every document</p>
			</div>
		</div>

		<div class="card p-5">
			<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
				{#each [
					{ signal: 'Has PDF', weight: '15%' },
					{ signal: 'Has Docling Markdown', weight: '15%' },
					{ signal: 'Has Embedding', weight: '10%' },
					{ signal: 'Has Full-Text Embedding', weight: '10%' },
					{ signal: 'Has MARC Subjects', weight: '10%' },
					{ signal: 'Has Entity Mentions', weight: '10%' },
					{ signal: 'Has Tags', weight: '8%' },
					{ signal: 'Has Summary', weight: '7%' },
					{ signal: 'URL Alive', weight: '5%' },
					{ signal: 'Has Vocab Terms', weight: '5%' },
					{ signal: 'Has Title', weight: '3%' },
					{ signal: 'Has Description', weight: '2%' }
				] as s}
					<div class="flex items-center justify-between bg-surface-secondary rounded px-3 py-1.5">
						<span class="text-xs text-text-theme-secondary">{s.signal}</span>
						<span class="text-xs font-mono font-medium text-text-theme-primary">{s.weight}</span>
					</div>
				{/each}
			</div>
			<p class="text-xs text-text-theme-tertiary mt-3">
				Health scores surface what needs attention. A document with a PDF, embedding, subjects, and description scores high. One missing everything scores low. The browser and dashboard both sort and filter by health.
			</p>
		</div>
	</section>

	<!-- State Persistence -->
	<section id="persistence" class="scroll-mt-24">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
				<Save size={18} class="text-indigo-600 dark:text-indigo-400" />
			</div>
			<div>
				<h2 class="text-xl font-bold text-text-theme-primary">State Persistence</h2>
				<p class="text-sm text-text-theme-tertiary">The interface remembers your preferences</p>
			</div>
		</div>

		<div class="card p-5">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{#each [
					{ where: 'Document Browser', what: 'Page size, sort column, sort direction, all filter states' },
					{ where: 'Search', what: 'Mode selection (semantic / keyword / combined)' },
					{ where: 'Editor', what: 'PDF preview visibility, collapsed/expanded sections' },
					{ where: 'Theme', what: 'Light / dark / auto mode' }
				] as pref}
					<div class="bg-surface-secondary rounded-lg px-4 py-3">
						<p class="text-xs font-semibold text-text-theme-primary">{pref.where}</p>
						<p class="text-xs text-text-theme-secondary mt-0.5">{pref.what}</p>
					</div>
				{/each}
			</div>
			<p class="text-xs text-text-theme-secondary mt-4 leading-relaxed">
				When you set the document browser to 100 rows sorted by health score, that's how it looks next Tuesday.
				No flicker on reload. Preferences resolve before the page renders.
			</p>
			<p class="text-xs text-text-theme-tertiary mt-2 italic">
				This was a deliberate design decision. Amber pointed out during interviews that losing filter state was one of the friction points in the old system.
			</p>
		</div>
	</section>

	<!-- Version Notes -->
	<section id="releases" class="scroll-mt-24">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
				<ScrollText size={18} class="text-rose-600 dark:text-rose-400" />
			</div>
			<div>
				<h2 class="text-xl font-bold text-text-theme-primary">Version Notes</h2>
				<p class="text-sm text-text-theme-tertiary">What changed, when, and who asked for it</p>
			</div>
		</div>

		<div class="card p-5 space-y-3">
			<p class="text-xs text-text-theme-secondary leading-relaxed">
				Every release is documented with what changed and why. The people who request features, report bugs, and shape the direction of the tool are named in the notes. 14 releases tracked so far, tagged by area (ink, search, feed, infrastructure, and more).
			</p>
			<p class="text-xs text-text-theme-secondary leading-relaxed">
				This is internal tooling built in collaboration with its users, not software delivered at arm's length.
			</p>
			<a href="/ink/releases" class="text-xs font-medium text-interactive hover:underline inline-flex items-center gap-1">
				Read Version Notes <ArrowRight size={12} />
			</a>
		</div>
	</section>

	<!-- What's Next -->
	<section id="next" class="scroll-mt-24">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
				<Sparkles size={18} class="text-amber-600 dark:text-amber-400" />
			</div>
			<div>
				<h2 class="text-xl font-bold text-text-theme-primary">What's Next</h2>
				<p class="text-sm text-text-theme-tertiary">Phase 2 priorities from librarian interviews</p>
			</div>
		</div>

		<div class="card p-5">
			<div class="space-y-3">
				{#each [
					{
						title: 'Inline Editing with Save',
						desc: 'Edit metadata fields directly and save with optimistic updates. No more tab-switching between the editor and the source document.',
						from: 'Amber & Donna'
					},
					{
						title: 'Batch Operations',
						desc: 'Select multiple documents and enable/disable them in one action. Bulk subject assignment for groups of related documents.',
						from: 'Donna'
					},
					{
						title: 'FAST Subject Typeahead',
						desc: 'Autocomplete against the 10,800 FAST Subject terms. The most-used vocabulary field gets dedicated search.',
						from: 'Amber'
					},
					{
						title: 'Description Writing Assistant',
						desc: 'Use the document\'s PDF content to draft descriptions. The librarian reviews and edits, not the AI.',
						from: 'Amber'
					},
					{
						title: 'QC Workflow',
						desc: 'Replace the current Excel spreadsheet + Slack relay with an in-app review queue. Assignments, approvals, and notes in one place.',
						from: 'Donna'
					}
				] as item, i}
					<div class="flex gap-3 {i > 0 ? 'border-t border-theme pt-3' : ''}">
						<span class="text-sm font-bold text-text-theme-tertiary w-5 text-right flex-shrink-0">{i + 1}</span>
						<div>
							<p class="text-sm font-medium text-text-theme-primary">{item.title}</p>
							<p class="text-xs text-text-theme-secondary mt-0.5">{item.desc}</p>
							<p class="text-[0.625rem] text-text-theme-tertiary mt-1">Requested by {item.from}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- Footer -->
	<section class="text-center pt-4 pb-8 border-t border-theme">
		<p class="text-xs text-text-theme-tertiary">
			INK v0.13.0 -- Built for HSDL librarians, March 2026
		</p>
		<div class="flex items-center justify-center gap-4 mt-3">
			<a href="/ink" class="text-xs font-medium text-interactive hover:underline">Dashboard</a>
			<a href="/ink/documents" class="text-xs font-medium text-interactive hover:underline">Documents</a>
			<a href="/ink/search" class="text-xs font-medium text-interactive hover:underline">Search</a>
			<a href="/ink/releases" class="text-xs font-medium text-interactive hover:underline">Releases</a>
		</div>
	</section>
</div>
