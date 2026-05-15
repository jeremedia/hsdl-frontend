// Persistent client-side state for the BrowseTree: which nodes are
// collapsed. localStorage-backed, namespaced per user so two librarians
// sharing a browser don't fight over expansion state. Survives reloads
// but intentionally NOT synced to the server — collapse is a personal
// nav preference, not curatorial content.
//
// Uses Svelte 5 runes-state (not a writable store) so consumers can read
// .collapsedIds.has(id) reactively via property access. Stores wrapped
// in a plain-object holder triggered "subscribe is not a function" at
// flush time in Svelte 5; runes-state on a class-like holder doesn't.

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

export class BrowseTreeState {
	// Reactive Set of collapsed node ids. Reads in components compose
	// through .has(id); writes happen via the mutate helper which
	// reassigns to a fresh Set so Svelte detects the change.
	collapsedIds = $state<Set<string>>(new Set());
	#userId: string;

	constructor(userId: string) {
		this.#userId = userId;
		this.collapsedIds = loadFromStorage(userId);
	}

	#mutate(fn: (s: Set<string>) => void) {
		const next = new Set(this.collapsedIds);
		fn(next);
		this.collapsedIds = next;
		saveToStorage(this.#userId, next);
	}

	isCollapsed(id: string): boolean {
		return this.collapsedIds.has(id);
	}
	toggle(id: string): void {
		this.#mutate((s) => (s.has(id) ? s.delete(id) : s.add(id)));
	}
	expand(id: string): void {
		this.#mutate((s) => s.delete(id));
	}
	collapse(id: string): void {
		this.#mutate((s) => s.add(id));
	}
	expandAll(): void {
		this.#mutate((s) => s.clear());
	}
	collapseAll(allIds: string[]): void {
		this.#mutate((s) => {
			s.clear();
			allIds.forEach((id) => s.add(id));
		});
	}
	expandAncestors(ancestors: string[]): void {
		this.#mutate((s) => ancestors.forEach((id) => s.delete(id)));
	}
}

export function createBrowseTreeState(userId: string): BrowseTreeState {
	return new BrowseTreeState(userId);
}
