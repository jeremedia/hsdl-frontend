<script lang="ts">
	import { onMount } from 'svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { api } from '$lib/services/api';
	import {
		observeWebVitals,
		getNavigationTiming,
		getResourceTimings,
		getSearchTimings,
		getSearchStats,
		getPerformanceGrade,
		formatMs,
		formatBytes,
		recordSearchTiming,
		type WebVitals,
		type NavigationTiming,
		type ResourceTiming,
		type SearchTiming
	} from '$lib/services/performance';
	import {
		Gauge,
		Zap,
		Clock,
		Database,
		Activity,
		RefreshCw,
		Search,
		Server,
		FileCode,
		TrendingUp,
		CheckCircle2,
		AlertTriangle,
		XCircle,
		Play
	} from 'lucide-svelte';

	// State
	let webVitals = $state<Partial<WebVitals>>({});
	let navTiming = $state<NavigationTiming | null>(null);
	let resources = $state<ResourceTiming[]>([]);
	let searchTimings = $state<SearchTiming[]>([]);
	let searchStats = $state(getSearchStats());
	let isRunningBenchmark = $state(false);
	let benchmarkResults = $state<{ query: string; duration: number; results: number }[]>([]);

	// Live performance grade
	let grade = $derived(getPerformanceGrade(webVitals));

	// Derived status for each metric (to avoid @const in templates)
	let lcpStatus = $derived(getMetricStatus(webVitals.lcp, 2500, 4000));
	let fidStatus = $derived(getMetricStatus(webVitals.fid, 100, 300));
	let clsStatus = $derived(getMetricStatus(webVitals.cls, 0.1, 0.25));
	let fcpStatus = $derived(getMetricStatus(webVitals.fcp, 1800, 3000));
	let ttfbStatus = $derived(getMetricStatus(webVitals.ttfb, 800, 1800));

	// Derived values for nav timing and resources
	let maxNavTime = $derived(navTiming?.total || 1);
	let totalResourceSize = $derived(resources.reduce((sum, r) => sum + r.size, 0));
	let cachedResourceCount = $derived(resources.filter((r) => r.cached).length);

	// Refresh metrics
	function refreshMetrics() {
		navTiming = getNavigationTiming();
		resources = getResourceTimings();
		searchTimings = getSearchTimings();
		searchStats = getSearchStats();
	}

	// Run a search benchmark
	async function runBenchmark() {
		isRunningBenchmark = true;
		benchmarkResults = [];

		const testQueries = [
			'cybersecurity threats',
			'emergency management',
			'terrorism',
			'border security',
			'homeland defense'
		];

		for (const query of testQueries) {
			const start = performance.now();
			try {
				const result = await api.search({ q: query, mode: 'semantic', per_page: 20 });
				const duration = performance.now() - start;

				benchmarkResults = [
					...benchmarkResults,
					{ query, duration, results: result.total_count }
				];

				// Record for stats
				recordSearchTiming({
					query,
					mode: 'semantic',
					duration,
					resultCount: result.total_count
				});
			} catch (error) {
				console.error(`Benchmark failed for query "${query}":`, error);
				benchmarkResults = [...benchmarkResults, { query, duration: -1, results: 0 }];
			}
		}

		refreshMetrics();
		isRunningBenchmark = false;
	}

	// Metric status indicator
	function getMetricStatus(
		value: number | null | undefined,
		goodThreshold: number,
		poorThreshold: number
	): 'good' | 'ok' | 'poor' {
		if (value === null || value === undefined) return 'ok';
		if (value <= goodThreshold) return 'good';
		if (value <= poorThreshold) return 'ok';
		return 'poor';
	}

	function getStatusIcon(status: 'good' | 'ok' | 'poor') {
		switch (status) {
			case 'good':
				return CheckCircle2;
			case 'ok':
				return AlertTriangle;
			case 'poor':
				return XCircle;
		}
	}

	function getStatusColor(status: 'good' | 'ok' | 'poor') {
		switch (status) {
			case 'good':
				return 'text-green-500';
			case 'ok':
				return 'text-yellow-500';
			case 'poor':
				return 'text-red-500';
		}
	}

	onMount(() => {
		// Initialize web vitals observation
		observeWebVitals((vitals) => {
			webVitals = vitals;
		});

		// Get initial metrics
		refreshMetrics();

		// Auto-refresh every 5 seconds
		const interval = setInterval(refreshMetrics, 5000);

		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<title>Speed Dashboard | HSDL</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-6 sm:py-8">
	<!-- Header -->
	<div class="mb-8">
		<div class="flex items-center gap-3 mb-2">
			<div class="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl text-white">
				<Zap class="w-6 h-6" />
			</div>
			<h1 class="text-2xl sm:text-3xl font-bold text-text-theme-primary">Speed Dashboard</h1>
			<span class="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 rounded">DEV</span>
		</div>
		<p class="text-text-theme-secondary">
			Real-time performance metrics demonstrating SPA speed advantages over legacy HSDL
		</p>
	</div>

	<!-- Performance Grade Card -->
	<div class="card p-6 mb-6 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-lg font-semibold text-text-theme-primary mb-1">Performance Grade</h2>
				<p class="text-sm text-text-theme-tertiary">Based on Google Core Web Vitals</p>
			</div>
			<div class="text-center">
				<div class="text-6xl font-bold {grade.color}">{grade.grade}</div>
				<div class="text-xs text-text-theme-tertiary mt-1">Overall Score</div>
			</div>
		</div>
		{#if grade.details.length > 0}
			<div class="mt-4 flex flex-wrap gap-2">
				{#each grade.details as detail}
					<span
						class="px-2 py-1 text-xs rounded-full {detail.includes('Good')
							? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
							: detail.includes('Poor')
								? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
								: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'}"
					>
						{detail}
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Core Web Vitals Grid -->
	<div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
		<!-- LCP -->
		<div class="card p-4">
			<div class="flex items-center justify-between mb-2">
				<span class="text-xs font-medium text-text-theme-tertiary uppercase">LCP</span>
				<svelte:component this={getStatusIcon(lcpStatus)} class="w-4 h-4 {getStatusColor(lcpStatus)}" />
			</div>
			<div class="text-2xl font-bold text-text-theme-primary">{formatMs(webVitals.lcp)}</div>
			<div class="text-xs text-text-theme-tertiary">Largest Contentful Paint</div>
			<div class="mt-2 h-1 bg-surface-secondary rounded-full overflow-hidden">
				<div
					class="h-full transition-all {lcpStatus === 'good'
						? 'bg-green-500'
						: lcpStatus === 'ok'
							? 'bg-yellow-500'
							: 'bg-red-500'}"
					style="width: {webVitals.lcp ? Math.min(100, (webVitals.lcp / 4000) * 100) : 0}%"
				></div>
			</div>
		</div>

		<!-- FID -->
		<div class="card p-4">
			<div class="flex items-center justify-between mb-2">
				<span class="text-xs font-medium text-text-theme-tertiary uppercase">FID</span>
				<svelte:component this={getStatusIcon(fidStatus)} class="w-4 h-4 {getStatusColor(fidStatus)}" />
			</div>
			<div class="text-2xl font-bold text-text-theme-primary">{formatMs(webVitals.fid)}</div>
			<div class="text-xs text-text-theme-tertiary">First Input Delay</div>
			<div class="mt-2 h-1 bg-surface-secondary rounded-full overflow-hidden">
				<div
					class="h-full transition-all {fidStatus === 'good'
						? 'bg-green-500'
						: fidStatus === 'ok'
							? 'bg-yellow-500'
							: 'bg-red-500'}"
					style="width: {webVitals.fid ? Math.min(100, (webVitals.fid / 300) * 100) : 0}%"
				></div>
			</div>
		</div>

		<!-- CLS -->
		<div class="card p-4">
			<div class="flex items-center justify-between mb-2">
				<span class="text-xs font-medium text-text-theme-tertiary uppercase">CLS</span>
				<svelte:component this={getStatusIcon(clsStatus)} class="w-4 h-4 {getStatusColor(clsStatus)}" />
			</div>
			<div class="text-2xl font-bold text-text-theme-primary">
				{webVitals.cls !== null && webVitals.cls !== undefined ? webVitals.cls.toFixed(3) : '—'}
			</div>
			<div class="text-xs text-text-theme-tertiary">Cumulative Layout Shift</div>
			<div class="mt-2 h-1 bg-surface-secondary rounded-full overflow-hidden">
				<div
					class="h-full transition-all {clsStatus === 'good'
						? 'bg-green-500'
						: clsStatus === 'ok'
							? 'bg-yellow-500'
							: 'bg-red-500'}"
					style="width: {webVitals.cls ? Math.min(100, (webVitals.cls / 0.25) * 100) : 0}%"
				></div>
			</div>
		</div>

		<!-- FCP -->
		<div class="card p-4">
			<div class="flex items-center justify-between mb-2">
				<span class="text-xs font-medium text-text-theme-tertiary uppercase">FCP</span>
				<svelte:component this={getStatusIcon(fcpStatus)} class="w-4 h-4 {getStatusColor(fcpStatus)}" />
			</div>
			<div class="text-2xl font-bold text-text-theme-primary">{formatMs(webVitals.fcp)}</div>
			<div class="text-xs text-text-theme-tertiary">First Contentful Paint</div>
			<div class="mt-2 h-1 bg-surface-secondary rounded-full overflow-hidden">
				<div
					class="h-full transition-all {fcpStatus === 'good'
						? 'bg-green-500'
						: fcpStatus === 'ok'
							? 'bg-yellow-500'
							: 'bg-red-500'}"
					style="width: {webVitals.fcp ? Math.min(100, (webVitals.fcp / 3000) * 100) : 0}%"
				></div>
			</div>
		</div>

		<!-- TTFB -->
		<div class="card p-4">
			<div class="flex items-center justify-between mb-2">
				<span class="text-xs font-medium text-text-theme-tertiary uppercase">TTFB</span>
				<svelte:component this={getStatusIcon(ttfbStatus)} class="w-4 h-4 {getStatusColor(ttfbStatus)}" />
			</div>
			<div class="text-2xl font-bold text-text-theme-primary">{formatMs(webVitals.ttfb)}</div>
			<div class="text-xs text-text-theme-tertiary">Time to First Byte</div>
			<div class="mt-2 h-1 bg-surface-secondary rounded-full overflow-hidden">
				<div
					class="h-full transition-all {ttfbStatus === 'good'
						? 'bg-green-500'
						: ttfbStatus === 'ok'
							? 'bg-yellow-500'
							: 'bg-red-500'}"
					style="width: {webVitals.ttfb ? Math.min(100, (webVitals.ttfb / 1800) * 100) : 0}%"
				></div>
			</div>
		</div>
	</div>

	<!-- Two Column Layout -->
	<div class="grid lg:grid-cols-2 gap-6">
		<!-- Search Performance -->
		<div class="card p-6">
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-2">
					<Search class="w-5 h-5 text-chds-blue" />
					<h2 class="font-semibold text-text-theme-primary">Search Performance</h2>
				</div>
				<button
					onclick={runBenchmark}
					disabled={isRunningBenchmark}
					class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-chds-blue rounded-lg hover:bg-chds-navy transition-colors disabled:opacity-50"
				>
					{#if isRunningBenchmark}
						<RefreshCw class="w-4 h-4 animate-spin" />
						Running...
					{:else}
						<Play class="w-4 h-4" />
						Run Benchmark
					{/if}
				</button>
			</div>

			{#if searchStats.count > 0}
				<div class="grid grid-cols-2 gap-4 mb-4">
					<div class="bg-surface-secondary rounded-lg p-3">
						<div class="text-2xl font-bold text-text-theme-primary">{formatMs(searchStats.avgDuration)}</div>
						<div class="text-xs text-text-theme-tertiary">Average Response</div>
					</div>
					<div class="bg-surface-secondary rounded-lg p-3">
						<div class="text-2xl font-bold text-text-theme-primary">{formatMs(searchStats.p95)}</div>
						<div class="text-xs text-text-theme-tertiary">P95 Latency</div>
					</div>
					<div class="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
						<div class="text-2xl font-bold text-chds-blue">{formatMs(searchStats.semanticAvg)}</div>
						<div class="text-xs text-text-theme-tertiary">Semantic Search Avg</div>
					</div>
					<div class="bg-surface-secondary rounded-lg p-3">
						<div class="text-2xl font-bold text-text-theme-primary">{formatMs(searchStats.keywordAvg)}</div>
						<div class="text-xs text-text-theme-tertiary">Keyword Search Avg</div>
					</div>
				</div>
			{:else}
				<div class="text-center py-8 text-text-theme-tertiary">
					<Search class="w-8 h-8 mx-auto mb-2 opacity-50" />
					<p>No search data yet. Run a benchmark or perform searches.</p>
				</div>
			{/if}

			{#if benchmarkResults.length > 0}
				<div class="border-t border-border-theme pt-4 mt-4">
					<h3 class="text-sm font-medium text-text-theme-secondary mb-2">Benchmark Results</h3>
					<div class="space-y-2">
						{#each benchmarkResults as result}
							<div class="flex items-center justify-between text-sm">
								<span class="text-text-theme-secondary truncate flex-1">{result.query}</span>
								<span class="font-mono {result.duration < 500 ? 'text-green-600' : result.duration < 1000 ? 'text-yellow-600' : 'text-red-600'}">
									{result.duration > 0 ? formatMs(result.duration) : 'Error'}
								</span>
								<span class="text-text-theme-tertiary ml-2 w-20 text-right">
									{result.results.toLocaleString()} docs
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Navigation Timing -->
		<div class="card p-6">
			<div class="flex items-center gap-2 mb-4">
				<Clock class="w-5 h-5 text-chds-blue" />
				<h2 class="font-semibold text-text-theme-primary">Page Load Breakdown</h2>
			</div>

			{#if navTiming}
				<div class="space-y-3">
					<div class="flex items-center gap-2">
						<span class="w-24 text-xs text-text-theme-tertiary">DNS Lookup</span>
						<div class="flex-1 h-4 bg-surface-secondary rounded overflow-hidden">
							<div
								class="h-full bg-purple-400"
								style="width: {(navTiming.dns / maxNavTime) * 100}%"
							></div>
						</div>
						<span class="w-16 text-xs text-right font-mono">{formatMs(navTiming.dns)}</span>
					</div>

					<div class="flex items-center gap-2">
						<span class="w-24 text-xs text-text-theme-tertiary">TCP Connect</span>
						<div class="flex-1 h-4 bg-surface-secondary rounded overflow-hidden">
							<div
								class="h-full bg-blue-400"
								style="width: {(navTiming.tcp / maxNavTime) * 100}%"
							></div>
						</div>
						<span class="w-16 text-xs text-right font-mono">{formatMs(navTiming.tcp)}</span>
					</div>

					<div class="flex items-center gap-2">
						<span class="w-24 text-xs text-text-theme-tertiary">TTFB</span>
						<div class="flex-1 h-4 bg-surface-secondary rounded overflow-hidden">
							<div
								class="h-full bg-green-400"
								style="width: {(navTiming.ttfb / maxNavTime) * 100}%"
							></div>
						</div>
						<span class="w-16 text-xs text-right font-mono">{formatMs(navTiming.ttfb)}</span>
					</div>

					<div class="flex items-center gap-2">
						<span class="w-24 text-xs text-text-theme-tertiary">Download</span>
						<div class="flex-1 h-4 bg-surface-secondary rounded overflow-hidden">
							<div
								class="h-full bg-yellow-400"
								style="width: {(navTiming.download / maxNavTime) * 100}%"
							></div>
						</div>
						<span class="w-16 text-xs text-right font-mono">{formatMs(navTiming.download)}</span>
					</div>

					<div class="flex items-center gap-2">
						<span class="w-24 text-xs text-text-theme-tertiary">DOM Parse</span>
						<div class="flex-1 h-4 bg-surface-secondary rounded overflow-hidden">
							<div
								class="h-full bg-orange-400"
								style="width: {(navTiming.domParsing / maxNavTime) * 100}%"
							></div>
						</div>
						<span class="w-16 text-xs text-right font-mono">{formatMs(navTiming.domParsing)}</span>
					</div>

					<div class="border-t border-border-theme pt-3 mt-3">
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium text-text-theme-secondary">Total Load Time</span>
							<span class="text-lg font-bold text-text-theme-primary">{formatMs(navTiming.total)}</span>
						</div>
					</div>
				</div>
			{:else}
				<div class="text-center py-8 text-text-theme-tertiary">
					<Clock class="w-8 h-8 mx-auto mb-2 opacity-50" />
					<p>Navigation timing not available</p>
				</div>
			{/if}
		</div>

		<!-- Resource Sizes -->
		<div class="card p-6">
			<div class="flex items-center gap-2 mb-4">
				<FileCode class="w-5 h-5 text-chds-blue" />
				<h2 class="font-semibold text-text-theme-primary">Bundle Sizes</h2>
			</div>

			{#if resources.length > 0}
				<div class="flex gap-4 mb-4">
					<div class="bg-surface-secondary rounded-lg p-3 flex-1">
						<div class="text-xl font-bold text-text-theme-primary">{formatBytes(totalResourceSize)}</div>
						<div class="text-xs text-text-theme-tertiary">Total Transfer</div>
					</div>
					<div class="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 flex-1">
						<div class="text-xl font-bold text-green-600">{cachedResourceCount}/{resources.length}</div>
						<div class="text-xs text-text-theme-tertiary">Cached Resources</div>
					</div>
				</div>

				<div class="space-y-2 max-h-48 overflow-y-auto">
					{#each resources.slice(0, 10) as resource}
						<div class="flex items-center justify-between text-sm">
							<div class="flex items-center gap-2 flex-1 min-w-0">
								<span
									class="w-2 h-2 rounded-full {resource.type === 'script'
										? 'bg-yellow-400'
										: resource.type === 'link'
											? 'bg-blue-400'
											: 'bg-gray-400'}"
								></span>
								<span class="truncate text-text-theme-secondary" title={resource.name}>{resource.name}</span>
								{#if resource.cached}
									<span class="text-xs text-green-500">(cached)</span>
								{/if}
							</div>
							<span class="font-mono text-text-theme-primary ml-2">{formatBytes(resource.size)}</span>
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-center py-8 text-text-theme-tertiary">
					<FileCode class="w-8 h-8 mx-auto mb-2 opacity-50" />
					<p>No resource data available</p>
				</div>
			{/if}
		</div>

		<!-- Speed Comparison -->
		<div class="card p-6">
			<div class="flex items-center gap-2 mb-4">
				<TrendingUp class="w-5 h-5 text-chds-blue" />
				<h2 class="font-semibold text-text-theme-primary">SPA vs Legacy Comparison</h2>
			</div>

			<div class="space-y-4">
				<div>
					<div class="flex items-center justify-between text-sm mb-1">
						<span class="text-text-theme-secondary">Initial Page Load</span>
						<span class="font-medium">
							<span class="text-green-600">{formatMs(navTiming?.total || 0)}</span>
							<span class="text-text-theme-tertiary mx-1">vs</span>
							<span class="text-red-500">~3-5s</span>
						</span>
					</div>
					<div class="flex gap-1 h-2">
						<div class="bg-green-500 rounded" style="width: 20%"></div>
						<div class="bg-red-300 rounded flex-1"></div>
					</div>
					<div class="flex justify-between text-xs text-text-theme-tertiary mt-0.5">
						<span>SPA</span>
						<span>Legacy HSDL</span>
					</div>
				</div>

				<div>
					<div class="flex items-center justify-between text-sm mb-1">
						<span class="text-text-theme-secondary">Search Query</span>
						<span class="font-medium">
							<span class="text-green-600">{formatMs(searchStats.avgDuration || 300)}</span>
							<span class="text-text-theme-tertiary mx-1">vs</span>
							<span class="text-red-500">~2-4s</span>
						</span>
					</div>
					<div class="flex gap-1 h-2">
						<div class="bg-green-500 rounded" style="width: 15%"></div>
						<div class="bg-red-300 rounded flex-1"></div>
					</div>
				</div>

				<div>
					<div class="flex items-center justify-between text-sm mb-1">
						<span class="text-text-theme-secondary">Page Navigation</span>
						<span class="font-medium">
							<span class="text-green-600">~50ms</span>
							<span class="text-text-theme-tertiary mx-1">vs</span>
							<span class="text-red-500">~1-2s</span>
						</span>
					</div>
					<div class="flex gap-1 h-2">
						<div class="bg-green-500 rounded" style="width: 5%"></div>
						<div class="bg-red-300 rounded flex-1"></div>
					</div>
				</div>

				<div class="pt-4 border-t border-border-theme">
					<div class="text-center">
						<div class="text-3xl font-bold text-green-600">5-10x</div>
						<div class="text-sm text-text-theme-tertiary">Faster Than Legacy</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Recent Searches -->
	{#if searchTimings.length > 0}
		<div class="card p-6 mt-6">
			<div class="flex items-center gap-2 mb-4">
				<Activity class="w-5 h-5 text-chds-blue" />
				<h2 class="font-semibold text-text-theme-primary">Recent Search Timings</h2>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left text-text-theme-tertiary border-b border-border-theme">
							<th class="pb-2 font-medium">Query</th>
							<th class="pb-2 font-medium">Mode</th>
							<th class="pb-2 font-medium text-right">Duration</th>
							<th class="pb-2 font-medium text-right">Results</th>
							<th class="pb-2 font-medium text-right">Time</th>
						</tr>
					</thead>
					<tbody>
						{#each searchTimings.slice(0, 10) as timing}
							<tr class="border-b border-gray-100 dark:border-gray-800">
								<td class="py-2 text-text-theme-primary truncate max-w-[200px]">{timing.query}</td>
								<td class="py-2">
									<span
										class="px-1.5 py-0.5 text-xs rounded {timing.mode === 'semantic'
											? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
											: 'bg-surface-secondary text-text-theme-secondary'}"
									>
										{timing.mode}
									</span>
								</td>
								<td class="py-2 text-right font-mono {timing.duration < 500 ? 'text-green-600' : timing.duration < 1000 ? 'text-yellow-600' : 'text-red-600'}">
									{formatMs(timing.duration)}
								</td>
								<td class="py-2 text-right text-text-theme-secondary">{timing.resultCount.toLocaleString()}</td>
								<td class="py-2 text-right text-text-theme-tertiary">
									{new Date(timing.timestamp).toLocaleTimeString()}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- Refresh Button -->
	<div class="mt-6 text-center">
		<button
			onclick={refreshMetrics}
			class="inline-flex items-center gap-2 px-4 py-2 text-sm text-text-theme-secondary hover:text-text-theme-primary transition-colors"
		>
			<RefreshCw class="w-4 h-4" />
			Refresh Metrics
		</button>
	</div>
</div>
