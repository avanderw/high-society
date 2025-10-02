import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

// Use /high-society/ for production (GitHub Pages), / for local dev
const base = '/high-society/';

export default defineConfig({
	base,
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			srcDir: './src',
			mode: 'production',
			strategies: 'generateSW',
			scope: base,
			base: base,
			includeAssets: ['favicon.svg', 'robots.txt'],
			manifest: {
				name: 'High Society Card Game',
				short_name: 'High Society',
				description: 'A digital implementation of Reiner Knizia\'s High Society auction card game',
				theme_color: '#1095c1',
				background_color: '#11191f',
				display: 'standalone',
				orientation: 'portrait',
				start_url: base,
				scope: base,
				icons: [
					{
						src: `${base}icon-192.png`,
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: `${base}icon-512.png`,
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: `${base}icon-512.png`,
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365 // 365 days
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					}
				],
				navigateFallback: null,
				cleanupOutdatedCaches: true,
				skipWaiting: true,
				clientsClaim: true
			},
			kit: {
				includeVersionFile: true
			},
			devOptions: {
				enabled: true,
				type: 'module',
				navigateFallback: '/'
			}
		})
	]
});
