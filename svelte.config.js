import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		paths: {
			base: '/ink'
		},
		adapter: adapter({
			// Build directly into Rails public/ink/ (no copy step needed)
			pages: '../public/ink',
			assets: '../public/ink',
			fallback: 'index.html', // SPA fallback
			precompress: true,
			strict: true
		}),
		alias: {
			$lib: 'src/lib',
			$components: 'src/lib/components',
			$stores: 'src/lib/stores',
			$services: 'src/lib/services'
		}
	}
};

export default config;
