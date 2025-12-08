/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				// Theme-aware colors using CSS variables
				primary: {
					50: 'var(--color-primary-50)',
					100: 'var(--color-primary-100)',
					200: 'var(--color-primary-200)',
					300: 'var(--color-primary-300)',
					400: 'var(--color-primary-400)',
					500: 'var(--color-primary-500)',
					600: 'var(--color-primary-600)',
					700: 'var(--color-primary-700)',
					800: 'var(--color-primary-800)',
					900: 'var(--color-primary-900)',
					DEFAULT: 'var(--color-primary-600)'
				},
				accent: {
					50: 'var(--color-accent-50)',
					100: 'var(--color-accent-100)',
					200: 'var(--color-accent-200)',
					300: 'var(--color-accent-300)',
					400: 'var(--color-accent-400)',
					500: 'var(--color-accent-500)',
					600: 'var(--color-accent-600)',
					700: 'var(--color-accent-700)',
					800: 'var(--color-accent-800)',
					900: 'var(--color-accent-900)',
					DEFAULT: 'var(--color-accent-500)'
				},
				// CHDS legacy colors (for backwards compatibility)
				chds: {
					navy: '#002B58',
					blue: '#0268BB',
					yellow: '#FED402',
					gold: '#FCB900'
				},
				// Semantic surface colors
				surface: {
					DEFAULT: 'var(--color-surface)',
					elevated: 'var(--color-surface-elevated)',
					secondary: 'var(--color-surface-secondary)',
					overlay: 'var(--color-surface-overlay)'
				},
				// Semantic text colors
				'text-theme': {
					primary: 'var(--color-text-primary)',
					secondary: 'var(--color-text-secondary)',
					tertiary: 'var(--color-text-tertiary)',
					inverse: 'var(--color-text-inverse)'
				},
				// Semantic border colors
				'border-theme': {
					DEFAULT: 'var(--color-border)',
					strong: 'var(--color-border-strong)'
				},
				// Interactive colors
				interactive: {
					DEFAULT: 'var(--color-interactive)',
					hover: 'var(--color-interactive-hover)',
					active: 'var(--color-interactive-active)'
				},
				// Header colors
				header: {
					bg: 'var(--color-header-bg)',
					text: 'var(--color-header-text)',
					accent: 'var(--color-header-accent)'
				},
				// Status colors
				success: {
					DEFAULT: 'var(--color-success)',
					light: 'var(--color-success-light)'
				},
				error: {
					DEFAULT: 'var(--color-error)',
					light: 'var(--color-error-light)'
				},
				warning: {
					DEFAULT: 'var(--color-warning)',
					light: 'var(--color-warning-light)'
				},
				info: {
					DEFAULT: 'var(--color-info)',
					light: 'var(--color-info-light)'
				}
			},
			fontFamily: {
				sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
				serif: ['var(--font-serif)', 'Georgia', 'serif'],
				mono: ['var(--font-mono)', 'monospace']
			},
			fontSize: {
				// Type scale on 8px baseline grid
				xs: ['0.75rem', { lineHeight: '1.4' }], // 12px
				sm: ['0.875rem', { lineHeight: '1.5' }], // 14px
				base: ['1rem', { lineHeight: '1.75' }], // 16px - optimized for reading
				lg: ['1.125rem', { lineHeight: '1.75' }], // 18px - document reading
				xl: ['1.25rem', { lineHeight: '1.5' }], // 20px
				'2xl': ['1.5rem', { lineHeight: '1.4' }], // 24px
				'3xl': ['2rem', { lineHeight: '1.3' }], // 32px
				'4xl': ['2.5rem', { lineHeight: '1.2' }], // 40px
				'5xl': ['3rem', { lineHeight: '1.1' }], // 48px
				'6xl': ['3.75rem', { lineHeight: '1.1' }] // 60px - display
			},
			spacing: {
				// 8px grid system
				0.5: '0.125rem', // 2px
				1: '0.25rem', // 4px
				1.5: '0.375rem', // 6px
				2: '0.5rem', // 8px
				2.5: '0.625rem', // 10px
				3: '0.75rem', // 12px
				4: '1rem', // 16px
				5: '1.25rem', // 20px
				6: '1.5rem', // 24px
				8: '2rem', // 32px
				10: '2.5rem', // 40px
				12: '3rem', // 48px
				16: '4rem', // 64px
				20: '5rem' // 80px
			},
			borderRadius: {
				DEFAULT: 'var(--radius-md)',
				none: 'var(--radius-none)',
				sm: 'var(--radius-sm)',
				md: 'var(--radius-md)',
				lg: 'var(--radius-lg)',
				xl: 'var(--radius-xl)',
				full: 'var(--radius-full)'
			},
			boxShadow: {
				sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
				DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
				md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
				lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
				xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
			},
			animation: {
				'skeleton-pulse': 'skeleton-pulse 1.5s ease-in-out infinite'
			},
			keyframes: {
				'skeleton-pulse': {
					'0%, 100%': { opacity: '0.4' },
					'50%': { opacity: '0.8' }
				}
			},
			transitionDuration: {
				fast: 'var(--duration-fast)',
				normal: 'var(--duration-normal)',
				slow: 'var(--duration-slow)'
			},
			transitionTimingFunction: {
				'ease-out': 'var(--ease-out)',
				'ease-in-out': 'var(--ease-in-out)'
			}
		}
	},
	plugins: [require('@tailwindcss/typography')]
};
