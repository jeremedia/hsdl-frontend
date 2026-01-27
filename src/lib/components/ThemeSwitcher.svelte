<script lang="ts">
	import { onMount } from 'svelte';
	import { Sun, Moon, Monitor, Palette, ChevronDown, Check } from 'lucide-svelte';
	import {
		initTheme,
		destroyTheme,
		setTheme,
		setColorMode,
		getThemeState,
		THEME_INFO,
		COLOR_MODE_INFO,
		type ThemeName,
		type ColorMode
	} from '$lib/stores/theme.svelte';

	// Get reactive theme state
	let themeState = $derived(getThemeState());

	// Dropdown open state
	let isOpen = $state(false);
	let dropdownRef: HTMLDivElement | null = $state(null);

	// Initialize theme on mount, consolidate cleanup to prevent memory leaks
	onMount(() => {
		initTheme();

		// Close dropdown when clicking outside
		const handleClickOutside = (e: MouseEvent) => {
			if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
				isOpen = false;
			}
		};

		document.addEventListener('click', handleClickOutside);

		// Cleanup both listeners on destroy
		return () => {
			document.removeEventListener('click', handleClickOutside);
			destroyTheme();
		};
	});

	// Handle theme selection
	function handleThemeSelect(theme: ThemeName) {
		setTheme(theme);
	}

	// Handle color mode selection
	function handleColorModeSelect(mode: ColorMode) {
		setColorMode(mode);
	}

	// Get icon component for color mode
	function getColorModeIcon(mode: ColorMode) {
		switch (mode) {
			case 'light':
				return Sun;
			case 'dark':
				return Moon;
			case 'auto':
				return Monitor;
		}
	}

	// Get the current display icon based on resolved mode
	function getCurrentIcon() {
		if (themeState.colorMode === 'auto') {
			return Monitor;
		}
		return themeState.resolvedMode === 'dark' ? Moon : Sun;
	}

	// Toggle dropdown
	function toggleDropdown() {
		isOpen = !isOpen;
	}
</script>

<div class="theme-switcher" bind:this={dropdownRef}>
	<!-- Trigger Button -->
	<button
		class="theme-trigger"
		onclick={toggleDropdown}
		aria-expanded={isOpen}
		aria-haspopup="true"
		aria-label="Theme settings"
	>
		<div class="trigger-content">
			<Palette class="trigger-icon" size={18} />
			<span class="trigger-label">{THEME_INFO[themeState.theme].name}</span>
			<div class="trigger-mode">
				<svelte:component this={getCurrentIcon()} size={14} />
			</div>
			<span class="trigger-chevron" class:open={isOpen}>
				<ChevronDown size={14} />
			</span>
		</div>
	</button>

	<!-- Dropdown Panel -->
	{#if isOpen}
		<div class="dropdown-panel" role="menu">
			<!-- Theme Section -->
			<div class="section">
				<div class="section-label">Theme</div>
				<div class="option-grid">
					{#each Object.entries(THEME_INFO) as [key, info]}
						{@const themeName = key as ThemeName}
						<button
							class="theme-option"
							class:active={themeState.theme === themeName}
							onclick={() => handleThemeSelect(themeName)}
							role="menuitemradio"
							aria-checked={themeState.theme === themeName}
						>
							<div class="option-preview theme-preview-{themeName}">
								<div class="preview-header"></div>
								<div class="preview-body">
									<div class="preview-line"></div>
									<div class="preview-line short"></div>
								</div>
							</div>
							<div class="option-info">
								<span class="option-name">{info.name}</span>
								{#if themeState.theme === themeName}
									<Check class="check-icon" size={14} />
								{/if}
							</div>
						</button>
					{/each}
				</div>
			</div>

			<!-- Divider -->
			<div class="divider"></div>

			<!-- Color Mode Section -->
			<div class="section">
				<div class="section-label">Appearance</div>
				<div class="mode-options">
					{#each Object.entries(COLOR_MODE_INFO) as [key, info]}
						{@const mode = key as ColorMode}
						{@const IconComponent = getColorModeIcon(mode)}
						<button
							class="mode-option"
							class:active={themeState.colorMode === mode}
							onclick={() => handleColorModeSelect(mode)}
							role="menuitemradio"
							aria-checked={themeState.colorMode === mode}
						>
							<IconComponent size={16} />
							<span>{info.name}</span>
							{#if themeState.colorMode === mode}
								<Check class="check-icon" size={14} />
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<!-- Current Status -->
			<div class="status-bar">
				<span class="status-text">
					{#if themeState.colorMode === 'auto'}
						Following system ({themeState.resolvedMode})
					{:else}
						{themeState.colorMode === 'dark' ? 'Dark' : 'Light'} mode
					{/if}
				</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.theme-switcher {
		position: relative;
		z-index: 100;
	}

	/* Trigger Button */
	.theme-trigger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 0.5rem;
		color: inherit;
		cursor: pointer;
		transition: all 0.15s ease;
		font-size: 0.875rem;
	}

	.theme-trigger:hover {
		background: rgba(255, 255, 255, 0.15);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.trigger-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.trigger-icon {
		opacity: 0.9;
	}

	.trigger-label {
		font-weight: 500;
	}

	.trigger-mode {
		display: flex;
		align-items: center;
		padding: 0.125rem 0.25rem;
		background: rgba(255, 255, 255, 0.15);
		border-radius: 0.25rem;
	}

	.trigger-chevron {
		display: flex;
		align-items: center;
		opacity: 0.7;
		transition: transform 0.2s ease;
	}

	.trigger-chevron.open {
		transform: rotate(180deg);
	}

	/* Dropdown Panel */
	.dropdown-panel {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		width: 280px;
		background: var(--color-surface-elevated);
		border: 1px solid var(--color-border);
		border-radius: 0.75rem;
		box-shadow:
			0 10px 40px -10px rgba(0, 0, 0, 0.2),
			0 0 0 1px rgba(0, 0, 0, 0.05);
		overflow: hidden;
		animation: dropdown-enter 0.15s ease-out;
	}

	@keyframes dropdown-enter {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Sections */
	.section {
		padding: 0.75rem;
	}

	.section-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-tertiary);
		margin-bottom: 0.5rem;
	}

	.divider {
		height: 1px;
		background: var(--color-border);
		margin: 0 0.75rem;
	}

	/* Theme Options Grid */
	.option-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}

	.theme-option {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem;
		background: transparent;
		border: 2px solid var(--color-border);
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
	}

	.theme-option:hover {
		border-color: var(--color-interactive);
		background: var(--color-surface-secondary);
	}

	.theme-option.active {
		border-color: var(--color-interactive);
		background: var(--color-info-light);
	}

	/* Theme Preview Mini Cards */
	.option-preview {
		width: 100%;
		height: 48px;
		border-radius: 0.25rem;
		overflow: hidden;
		background: #f5f5f5;
	}

	.preview-header {
		height: 12px;
	}

	.preview-body {
		padding: 4px;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.preview-line {
		height: 4px;
		border-radius: 2px;
		opacity: 0.6;
	}

	.preview-line.short {
		width: 60%;
	}

	/* CHDS Theme Preview */
	.theme-preview-chds .preview-header {
		background: #002b58;
	}

	.theme-preview-chds .preview-body {
		background: #ffffff;
	}

	.theme-preview-chds .preview-line {
		background: #0268bb;
	}

	/* Developer Theme Preview */
	.theme-preview-developer .preview-header {
		background: #0f172a;
	}

	.theme-preview-developer .preview-body {
		background: #f8fafc;
	}

	.theme-preview-developer .preview-line {
		background: #8b5cf6;
	}

	.option-info {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.option-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-primary);
	}

	.check-icon {
		color: var(--color-interactive);
	}

	/* Color Mode Options */
	.mode-options {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.mode-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		background: transparent;
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.15s ease;
		color: var(--color-text-primary);
		font-size: 0.875rem;
		width: 100%;
		text-align: left;
	}

	.mode-option:hover {
		background: var(--color-surface-secondary);
	}

	.mode-option.active {
		background: var(--color-info-light);
		color: var(--color-interactive);
	}

	.mode-option .check-icon {
		margin-left: auto;
	}

	/* Status Bar */
	.status-bar {
		padding: 0.5rem 0.75rem;
		background: var(--color-surface-secondary);
		border-top: 1px solid var(--color-border);
	}

	.status-text {
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
	}

	/* Mobile adjustments */
	@media (max-width: 640px) {
		.trigger-label {
			display: none;
		}

		.dropdown-panel {
			width: 260px;
			right: -0.5rem;
		}
	}
</style>
