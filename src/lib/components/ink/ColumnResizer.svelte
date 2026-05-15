<script lang="ts">
	// Draggable vertical divider for resizing the tree-vs-editor split
	// on /ink/browse. Drags update the host's CSS variable; the host
	// uses that variable in its grid-template-columns track. Width is
	// persisted to localStorage per user.
	//
	// Designed to be self-contained: no parent state, no events. The
	// parent declares the CSS variable as the tree column's track width
	// and renders this component between the tree and the editor. The
	// resizer reads/writes that variable on the document root (or a
	// scoping element) so the grid recomputes natively.

	import { onMount, onDestroy } from 'svelte';

	let {
		// CSS custom property name to drive. Defaults to `--tree-width`.
		varName = '--tree-width',
		// Scoping element selector. null = document root.
		scope = null,
		min = 220,
		max = 600,
		defaultWidth = 320,
		storageKey = 'ink.browse.tree-width'
	}: {
		varName?: string;
		scope?: string | null;
		min?: number;
		max?: number;
		defaultWidth?: number;
		storageKey?: string;
	} = $props();

	let dragging = $state(false);
	let handleEl: HTMLDivElement | undefined = $state();
	let startX = 0;
	let startWidth = 0;

	function scopeEl(): HTMLElement {
		if (!scope) return document.documentElement;
		const el = document.querySelector(scope);
		return (el as HTMLElement) ?? document.documentElement;
	}

	function applyWidth(w: number) {
		const clamped = Math.min(Math.max(w, min), max);
		scopeEl().style.setProperty(varName, `${clamped}px`);
	}

	function loadStored(): number {
		if (typeof localStorage === 'undefined') return defaultWidth;
		const raw = localStorage.getItem(storageKey);
		const n = raw ? parseInt(raw, 10) : NaN;
		if (Number.isFinite(n) && n >= min && n <= max) return n;
		return defaultWidth;
	}

	function persist(w: number) {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(storageKey, String(Math.round(w)));
		} catch {
			// Quota / private-mode failures degrade silently.
		}
	}

	onMount(() => {
		applyWidth(loadStored());
	});

	function startDrag(e: PointerEvent) {
		dragging = true;
		startX = e.clientX;
		// Read current width from the computed style so we drag from
		// wherever we are now, not from the stored default.
		const current = getComputedStyle(scopeEl()).getPropertyValue(varName).trim();
		startWidth = parseInt(current, 10) || loadStored();
		handleEl?.setPointerCapture(e.pointerId);
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	}

	function onMove(e: PointerEvent) {
		if (!dragging) return;
		const dx = e.clientX - startX;
		applyWidth(startWidth + dx);
	}

	function endDrag(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		handleEl?.releasePointerCapture(e.pointerId);
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
		const current = getComputedStyle(scopeEl()).getPropertyValue(varName).trim();
		const w = parseInt(current, 10);
		if (Number.isFinite(w)) persist(w);
	}

	// Double-click to reset to the default width. Quick escape hatch
	// when a curator drags too far and wants a known-good state back.
	function resetWidth() {
		applyWidth(defaultWidth);
		persist(defaultWidth);
	}

	onDestroy(() => {
		if (typeof document !== 'undefined' && dragging) {
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		}
	});
</script>

<div
	bind:this={handleEl}
	class="group relative h-full w-1.5 cursor-col-resize select-none touch-none"
	class:is-dragging={dragging}
	onpointerdown={startDrag}
	onpointermove={onMove}
	onpointerup={endDrag}
	onpointercancel={endDrag}
	ondblclick={resetWidth}
	role="separator"
	aria-orientation="vertical"
	aria-label="Resize tree column (double-click to reset)"
	tabindex="0"
>
	<!-- Visible indicator: a thin track that lights up on hover/drag. -->
	<div
		class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border-theme transition-colors
		{dragging ? 'bg-primary-500 w-[2px]' : 'group-hover:bg-primary-400 group-hover:w-[2px]'}"
	></div>
</div>

<style>
	.is-dragging {
		/* Keep the cursor as col-resize even when the pointer briefly
		   leaves the thin handle during a fast drag. */
		cursor: col-resize !important;
	}
</style>
