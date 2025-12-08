/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				// CHDS Brand Colors
				chds: {
					navy: '#002B58',
					blue: '#0268BB',
					yellow: '#FED402',
					gold: '#FCB900'
				},
				// Semantic colors
				success: '#6B9D3F',
				error: '#ef4444',
				warning: '#FED402',
				info: '#0268BB'
			},
			fontFamily: {
				sans: ['Open Sans', 'Helvetica', 'Arial', 'sans-serif'],
				serif: ['Source Serif Pro', 'Georgia', 'serif']
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
				DEFAULT: '0.25rem',
				none: '0',
				sm: '0.125rem',
				md: '0.375rem',
				lg: '0.5rem',
				xl: '0.75rem',
				'2xl': '1rem',
				full: '9999px'
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
			}
		}
	},
	plugins: [require('@tailwindcss/typography')]
};
