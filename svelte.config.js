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
			// Static adapter for SPA mode
			pages: 'build',
			assets: 'build',
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
