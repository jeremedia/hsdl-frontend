// Performance tracking utilities for Speed dashboard

export interface WebVitals {
	lcp: number | null; // Largest Contentful Paint
	fid: number | null; // First Input Delay
	cls: number | null; // Cumulative Layout Shift
	fcp: number | null; // First Contentful Paint
	ttfb: number | null; // Time to First Byte
}

export interface SearchTiming {
	query: string;
	mode: 'semantic' | 'keyword';
	duration: number;
	resultCount: number;
	timestamp: number;
}

export interface NavigationTiming {
	dns: number;
	tcp: number;
	ttfb: number;
	download: number;
	domParsing: number;
	domInteractive: number;
	domComplete: number;
	total: number;
}

export interface ResourceTiming {
	name: string;
	type: string;
	size: number;
	duration: number;
	cached: boolean;
}

// Store for search timings (persists across navigation)
const searchTimings: SearchTiming[] = [];
const MAX_SEARCH_TIMINGS = 50;

// Store search timing
export function recordSearchTiming(timing: Omit<SearchTiming, 'timestamp'>) {
	searchTimings.unshift({
		...timing,
		timestamp: Date.now()
	});
	if (searchTimings.length > MAX_SEARCH_TIMINGS) {
		searchTimings.pop();
	}
}

// Get all search timings
export function getSearchTimings(): SearchTiming[] {
	return [...searchTimings];
}

// Get search timing stats
export function getSearchStats() {
	if (searchTimings.length === 0) {
		return {
			count: 0,
			avgDuration: 0,
			minDuration: 0,
			maxDuration: 0,
			semanticAvg: 0,
			keywordAvg: 0,
			p50: 0,
			p95: 0
		};
	}

	const durations = searchTimings.map((t) => t.duration).sort((a, b) => a - b);
	const semanticDurations = searchTimings.filter((t) => t.mode === 'semantic').map((t) => t.duration);
	const keywordDurations = searchTimings.filter((t) => t.mode === 'keyword').map((t) => t.duration);

	const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
	const percentile = (arr: number[], p: number) => {
		if (arr.length === 0) return 0;
		const idx = Math.ceil((p / 100) * arr.length) - 1;
		return arr[Math.max(0, idx)];
	};

	return {
		count: searchTimings.length,
		avgDuration: avg(durations),
		minDuration: Math.min(...durations),
		maxDuration: Math.max(...durations),
		semanticAvg: avg(semanticDurations),
		keywordAvg: avg(keywordDurations),
		p50: percentile(durations, 50),
		p95: percentile(durations, 95)
	};
}

// Get Core Web Vitals using PerformanceObserver
export function observeWebVitals(callback: (vitals: Partial<WebVitals>) => void) {
	const vitals: Partial<WebVitals> = {};

	// LCP - Largest Contentful Paint
	if ('PerformanceObserver' in window) {
		try {
			const lcpObserver = new PerformanceObserver((list) => {
				const entries = list.getEntries();
				const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
				vitals.lcp = lastEntry.startTime;
				callback({ ...vitals });
			});
			lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
		} catch {
			// LCP not supported
		}

		// FID - First Input Delay
		try {
			const fidObserver = new PerformanceObserver((list) => {
				const entries = list.getEntries();
				const firstEntry = entries[0] as PerformanceEntry & {
					processingStart: number;
					startTime: number;
				};
				vitals.fid = firstEntry.processingStart - firstEntry.startTime;
				callback({ ...vitals });
			});
			fidObserver.observe({ type: 'first-input', buffered: true });
		} catch {
			// FID not supported
		}

		// CLS - Cumulative Layout Shift
		try {
			let clsValue = 0;
			const clsObserver = new PerformanceObserver((list) => {
				for (const entry of list.getEntries() as (PerformanceEntry & {
					hadRecentInput: boolean;
					value: number;
				})[]) {
					if (!entry.hadRecentInput) {
						clsValue += entry.value;
					}
				}
				vitals.cls = clsValue;
				callback({ ...vitals });
			});
			clsObserver.observe({ type: 'layout-shift', buffered: true });
		} catch {
			// CLS not supported
		}
	}

	// FCP and TTFB from paint timing
	if ('performance' in window) {
		const paintEntries = performance.getEntriesByType('paint');
		for (const entry of paintEntries) {
			if (entry.name === 'first-contentful-paint') {
				vitals.fcp = entry.startTime;
			}
		}

		const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
		if (navEntries.length > 0) {
			vitals.ttfb = navEntries[0].responseStart - navEntries[0].requestStart;
		}

		callback({ ...vitals });
	}

	return vitals;
}

// Get navigation timing breakdown
export function getNavigationTiming(): NavigationTiming | null {
	if (!('performance' in window)) return null;

	const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
	if (navEntries.length === 0) return null;

	const nav = navEntries[0];

	return {
		dns: nav.domainLookupEnd - nav.domainLookupStart,
		tcp: nav.connectEnd - nav.connectStart,
		ttfb: nav.responseStart - nav.requestStart,
		download: nav.responseEnd - nav.responseStart,
		domParsing: nav.domInteractive - nav.responseEnd,
		domInteractive: nav.domInteractive - nav.fetchStart,
		domComplete: nav.domComplete - nav.fetchStart,
		total: nav.loadEventEnd - nav.fetchStart
	};
}

// Get resource timing for JS/CSS bundles
export function getResourceTimings(): ResourceTiming[] {
	if (!('performance' in window)) return [];

	const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

	return resources
		.filter((r) => r.initiatorType === 'script' || r.initiatorType === 'link' || r.initiatorType === 'fetch')
		.map((r) => ({
			name: r.name.split('/').pop() || r.name,
			type: r.initiatorType,
			size: r.transferSize,
			duration: r.duration,
			cached: r.transferSize === 0 && r.decodedBodySize > 0
		}))
		.sort((a, b) => b.size - a.size);
}

// Performance grade based on Core Web Vitals
export function getPerformanceGrade(vitals: Partial<WebVitals>): {
	grade: 'A' | 'B' | 'C' | 'D' | 'F';
	color: string;
	details: string[];
} {
	const details: string[] = [];
	let score = 100;

	// LCP thresholds: Good < 2.5s, Needs Improvement < 4s, Poor >= 4s
	if (vitals.lcp !== null && vitals.lcp !== undefined) {
		if (vitals.lcp < 2500) {
			details.push('LCP: Good');
		} else if (vitals.lcp < 4000) {
			details.push('LCP: Needs improvement');
			score -= 20;
		} else {
			details.push('LCP: Poor');
			score -= 40;
		}
	}

	// FID thresholds: Good < 100ms, Needs Improvement < 300ms, Poor >= 300ms
	if (vitals.fid !== null && vitals.fid !== undefined) {
		if (vitals.fid < 100) {
			details.push('FID: Good');
		} else if (vitals.fid < 300) {
			details.push('FID: Needs improvement');
			score -= 15;
		} else {
			details.push('FID: Poor');
			score -= 30;
		}
	}

	// CLS thresholds: Good < 0.1, Needs Improvement < 0.25, Poor >= 0.25
	if (vitals.cls !== null && vitals.cls !== undefined) {
		if (vitals.cls < 0.1) {
			details.push('CLS: Good');
		} else if (vitals.cls < 0.25) {
			details.push('CLS: Needs improvement');
			score -= 15;
		} else {
			details.push('CLS: Poor');
			score -= 30;
		}
	}

	// TTFB thresholds: Good < 800ms, Needs Improvement < 1800ms, Poor >= 1800ms
	if (vitals.ttfb !== null && vitals.ttfb !== undefined) {
		if (vitals.ttfb < 800) {
			details.push('TTFB: Good');
		} else if (vitals.ttfb < 1800) {
			details.push('TTFB: Needs improvement');
			score -= 10;
		} else {
			details.push('TTFB: Poor');
			score -= 20;
		}
	}

	let grade: 'A' | 'B' | 'C' | 'D' | 'F';
	let color: string;

	if (score >= 90) {
		grade = 'A';
		color = 'text-green-600';
	} else if (score >= 80) {
		grade = 'B';
		color = 'text-lime-600';
	} else if (score >= 70) {
		grade = 'C';
		color = 'text-yellow-600';
	} else if (score >= 60) {
		grade = 'D';
		color = 'text-orange-600';
	} else {
		grade = 'F';
		color = 'text-red-600';
	}

	return { grade, color, details };
}

// Format milliseconds for display
export function formatMs(ms: number | null | undefined): string {
	if (ms === null || ms === undefined) return '—';
	if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
	if (ms < 1000) return `${ms.toFixed(0)}ms`;
	return `${(ms / 1000).toFixed(2)}s`;
}

// Format bytes for display
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
