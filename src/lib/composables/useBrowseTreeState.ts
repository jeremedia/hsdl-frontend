// Persistent client-side state for the BrowseTree: which nodes are
// collapsed. localStorage-backed, namespaced per user so two librarians
// sharing a browser don't fight over expansion state.
//
// Survives reloads but is intentionally NOT synced to the server —
// collapse state is a personal navigation preference, not curatorial
// content.

import { writable, type Writable } from 'svelte/store';

const LS_KEY_PREFIX = 'ink.browse-tree.collapsed';

function loadFromStorage(userId: string): Set<string> {
	if (typeof localStorage === 'undefined') return new Set();
	try {
		const raw = localStorage.getItem(`${LS_KEY_PREFIX}.${userId}`);
		if (!raw) return new Set();
		const arr = JSON.parse(raw);
		return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []);
	} catch {
		return new Set();
	}
}

function saveToStorage(userId: string, set: Set<string>) {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(`${LS_KEY_PREFIX}.${userId}`, JSON.stringify(Array.from(set)));
	} catch {
		// Quota or private-mode storage failure — degrade silently.
	}
}

export interface BrowseTreeState {
	collapsed: Writable<Set<string>>;
	isCollapsed: (id: string) => boolean;
	toggle: (id: string) => void;
	expand: (id: string) => void;
	collapse: (id: string) => void;
	expandAll: () => void;
	collapseAll: (allIds: string[]) => void;
	expandAncestors: (ancestors: string[]) => void;
}

export function createBrowseTreeState(userId: string): BrowseTreeState {
	const initial = loadFromStorage(userId);
	const collapsed = writable<Set<string>>(initial);

	// Helper: read-modify-write with a fresh Set copy so Svelte detects
	// the change (sets are mutable; in-place edits don't trigger updates).
	function mutate(fn: (s: Set<string>) => void) {
		collapsed.update((s) => {
			const next = new Set(s);
			fn(next);
			saveToStorage(userId, next);
			return next;
		});
	}

	let snapshot = initial;
	collapsed.subscribe((s) => (snapshot = s));

	return {
		collapsed,
		isCollapsed: (id) => snapshot.has(id),
		toggle: (id) => mutate((s) => (s.has(id) ? s.delete(id) : s.add(id))),
		expand: (id) => mutate((s) => s.delete(id)),
		collapse: (id) => mutate((s) => s.add(id)),
		expandAll: () => mutate((s) => s.clear()),
		collapseAll: (allIds) =>
			mutate((s) => {
				s.clear();
				allIds.forEach((id) => s.add(id));
			}),
		expandAncestors: (ancestors) => mutate((s) => ancestors.forEach((id) => s.delete(id)))
	};
}
