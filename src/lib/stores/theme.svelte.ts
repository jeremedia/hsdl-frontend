/**
 * HSDL Theme System
 *
 * Manages two themes (CHDS Official & Developer) with three color modes each:
 * - light: Light color scheme
 * - dark: Dark color scheme
 * - auto: Follow system preference
 *
 * Persists to localStorage and applies appropriate classes/attributes to document.
 */

// Theme identifiers
export type ThemeName = 'chds' | 'developer';

// Color mode settings
export type ColorMode = 'light' | 'dark' | 'auto';

// Combined theme state
export interface ThemeState {
	theme: ThemeName;
	colorMode: ColorMode;
	// Resolved mode (what's actually applied - 'light' or 'dark')
	resolvedMode: 'light' | 'dark';
}

// Storage keys
const STORAGE_KEY_THEME = 'hsdl-theme';
const STORAGE_KEY_COLOR_MODE = 'hsdl-color-mode';

// Default theme state
const DEFAULT_STATE: ThemeState = {
	theme: 'chds',
	colorMode: 'auto',
	resolvedMode: 'light'
};

// Create reactive state using Svelte 5 runes pattern
let themeState = $state<ThemeState>(DEFAULT_STATE);

// System preference media query (only available in browser)
let mediaQuery: MediaQueryList | null = null;

/**
 * Determine the resolved color mode based on setting and system preference
 */
function resolveColorMode(mode: ColorMode): 'light' | 'dark' {
	if (mode === 'auto') {
		// Check system preference
		if (typeof window !== 'undefined') {
			return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		}
		return 'light'; // Default for SSR
	}
	return mode;
}

/**
 * Apply theme to document
 */
function applyTheme(state: ThemeState): void {
	if (typeof document === 'undefined') return;

	const html = document.documentElement;

	// Set theme attribute
	html.setAttribute('data-theme', state.theme);

	// Set color mode class
	if (state.resolvedMode === 'dark') {
		html.classList.add('dark');
	} else {
		html.classList.remove('dark');
	}

	// Store the color mode setting as attribute for CSS
	html.setAttribute('data-color-mode', state.colorMode);
}

/**
 * Save theme to localStorage
 */
function persistTheme(state: ThemeState): void {
	if (typeof localStorage === 'undefined') return;

	localStorage.setItem(STORAGE_KEY_THEME, state.theme);
	localStorage.setItem(STORAGE_KEY_COLOR_MODE, state.colorMode);
}

/**
 * Load theme from localStorage
 */
function loadTheme(): Partial<ThemeState> {
	if (typeof localStorage === 'undefined') return {};

	const theme = localStorage.getItem(STORAGE_KEY_THEME) as ThemeName | null;
	const colorMode = localStorage.getItem(STORAGE_KEY_COLOR_MODE) as ColorMode | null;

	return {
		...(theme && ['chds', 'developer'].includes(theme) ? { theme } : {}),
		...(colorMode && ['light', 'dark', 'auto'].includes(colorMode) ? { colorMode } : {})
	};
}

/**
 * Handle system preference changes
 */
function handleSystemPreferenceChange(e: MediaQueryListEvent): void {
	if (themeState.colorMode === 'auto') {
		const newResolvedMode = e.matches ? 'dark' : 'light';
		themeState = {
			...themeState,
			resolvedMode: newResolvedMode
		};
		applyTheme(themeState);
	}
}

/**
 * Initialize the theme system
 * Call this in the root layout's onMount
 */
export function initTheme(): void {
	if (typeof window === 'undefined') return;

	// Load persisted preferences
	const saved = loadTheme();

	// Build initial state
	const initialTheme = saved.theme || DEFAULT_STATE.theme;
	const initialColorMode = saved.colorMode || DEFAULT_STATE.colorMode;
	const resolvedMode = resolveColorMode(initialColorMode);

	themeState = {
		theme: initialTheme,
		colorMode: initialColorMode,
		resolvedMode
	};

	// Apply immediately
	applyTheme(themeState);

	// Set up system preference listener
	mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	mediaQuery.addEventListener('change', handleSystemPreferenceChange);
}

/**
 * Clean up theme system listeners
 */
export function destroyTheme(): void {
	if (mediaQuery) {
		mediaQuery.removeEventListener('change', handleSystemPreferenceChange);
		mediaQuery = null;
	}
}

/**
 * Set the theme (CHDS or Developer)
 */
export function setTheme(theme: ThemeName): void {
	const resolvedMode = resolveColorMode(themeState.colorMode);
	themeState = {
		...themeState,
		theme,
		resolvedMode
	};
	applyTheme(themeState);
	persistTheme(themeState);
}

/**
 * Set the color mode (light, dark, or auto)
 */
export function setColorMode(colorMode: ColorMode): void {
	const resolvedMode = resolveColorMode(colorMode);
	themeState = {
		...themeState,
		colorMode,
		resolvedMode
	};
	applyTheme(themeState);
	persistTheme(themeState);
}

/**
 * Toggle between themes
 */
export function toggleTheme(): void {
	setTheme(themeState.theme === 'chds' ? 'developer' : 'chds');
}

/**
 * Cycle through color modes: light -> dark -> auto -> light
 */
export function cycleColorMode(): void {
	const modes: ColorMode[] = ['light', 'dark', 'auto'];
	const currentIndex = modes.indexOf(themeState.colorMode);
	const nextIndex = (currentIndex + 1) % modes.length;
	setColorMode(modes[nextIndex]);
}

/**
 * Get current theme state
 * Returns a reactive reference for use in components
 */
export function getThemeState(): ThemeState {
	return themeState;
}

// Theme display names and metadata
export const THEME_INFO: Record<ThemeName, { name: string; description: string }> = {
	chds: {
		name: 'CHDS Official',
		description: 'Professional institutional theme with navy, blue, and gold'
	},
	developer: {
		name: 'Developer',
		description: 'Modern tech-focused theme with Berkeley Mono font'
	}
};

export const COLOR_MODE_INFO: Record<ColorMode, { name: string; icon: string }> = {
	light: { name: 'Light', icon: 'sun' },
	dark: { name: 'Dark', icon: 'moon' },
	auto: { name: 'Auto', icon: 'monitor' }
};
