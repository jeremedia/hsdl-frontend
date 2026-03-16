/**
 * INK UI Preferences Store
 *
 * Persists user preferences to localStorage and restores them on load.
 * Prevents flicker by resolving state before rendering content.
 *
 * Usage:
 *   import { inkPrefs } from '$lib/stores/ink-preferences.svelte';
 *   let perPage = $derived(inkPrefs.get('documents.perPage', 50));
 *   inkPrefs.set('documents.perPage', 100);
 */

const STORAGE_KEY = 'ink-preferences';

interface InkPreferences {
	// Document browser
	'documents.perPage': number;
	'documents.sort': string;
	'documents.direction': string;
	'documents.enableStatus': string;
	'documents.hasPdf': string;
	'documents.hasEmbedding': string;
	// Search
	'search.mode': string;
	'search.perPage': number;
	// Editor
	'editor.collapsedSections': string[];
	'editor.showPdf': boolean;
	// Allow arbitrary keys
	[key: string]: unknown;
}

const DEFAULTS: Partial<InkPreferences> = {
	'documents.perPage': 50,
	'documents.sort': 'updated_at',
	'documents.direction': 'desc',
	'documents.enableStatus': '',
	'documents.hasPdf': '',
	'documents.hasEmbedding': '',
	'search.mode': 'semantic',
	'search.perPage': 25,
	'editor.collapsedSections': [],
	'editor.showPdf': true
};

function loadAll(): Record<string, unknown> {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

function saveAll(data: Record<string, unknown>): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch {
		// Storage full or unavailable -- silently degrade
	}
}

// Reactive state
let prefs = $state<Record<string, unknown>>(loadAll());

export const inkPrefs = {
	/** Get a preference value, falling back to default. Cast with the generic: inkPrefs.get<number>(...) */
	get<T = unknown>(key: string, fallback?: T): T {
		if (key in prefs) return prefs[key] as T;
		if (fallback !== undefined) return fallback;
		return (DEFAULTS as Record<string, unknown>)[key] as T;
	},

	/** Set a preference value and persist */
	set(key: string, value: unknown): void {
		prefs[key] = value;
		saveAll(prefs);
	},

	/** Reset a single key to default */
	reset(key: string): void {
		delete prefs[key];
		saveAll(prefs);
	},

	/** Reset all preferences */
	resetAll(): void {
		prefs = {};
		saveAll(prefs);
	}
};
