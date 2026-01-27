import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		sveltekit(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
			manifest: {
				name: 'HSDL - Homeland Security Digital Library',
				short_name: 'HSDL',
				description: 'Search and discover homeland security research documents',
				theme_color: '#002B58',
				background_color: '#ffffff',
				display: 'standalone',
				icons: [
					{
						src: 'pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
				runtimeCaching: [
					{
						// Taxonomy - cache first (24h)
						urlPattern: /\/api\/spa\/v1\/taxonomy/,
						handler: 'CacheFirst',
						options: {
							cacheName: 'taxonomy-cache',
							expiration: {
								maxAgeSeconds: 86400 // 24 hours
							}
						}
					},
					{
						// Search results - stale while revalidate (5min)
						urlPattern: /\/api\/spa\/v1\/search/,
						handler: 'StaleWhileRevalidate',
						options: {
							cacheName: 'search-cache',
							expiration: {
								maxAgeSeconds: 1800, // 30 minutes max
								maxEntries: 50
							}
						}
					},
					{
						// Document metadata - network first with fallback
						urlPattern: /\/api\/spa\/v1\/documents\/[^/]+$/,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'document-cache',
							networkTimeoutSeconds: 3,
							expiration: {
								maxAgeSeconds: 3600 // 1 hour
							}
						}
					},
					{
						// PDFs - cache first (immutable)
						urlPattern: /\.pdf$/,
						handler: 'CacheFirst',
						options: {
							cacheName: 'pdf-cache',
							expiration: {
								maxEntries: 20
							}
						}
					}
				]
			}
		})
	],
	server: {
		host: '0.0.0.0',
		port: 5173,
		strictPort: true,
		allowedHosts: ['hsdl-ui.dev.domt.app', 'localhost']
	},
	preview: {
		port: 4173
	}
});
