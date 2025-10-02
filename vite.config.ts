import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			srcDir: './src',
			mode: 'development',
			strategies: 'injectManifest',
			filename: 'service-worker.ts',
			scope: '/',
			base: '/',
			manifest: {
				name: 'High Society Card Game',
				short_name: 'High Society',
				description: 'A digital implementation of Reiner Knizia\'s High Society auction card game',
				theme_color: '#1095c1',
				background_color: '#11191f',
				display: 'standalone',
				start_url: '/',
				icons: [
					{
						src: '/icon-192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/icon-512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: '/icon-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable'
					}
				]
			},
			injectManifest: {
				globPatterns: ['**/*.{js,css,html,svg,png,ico,txt}']
			},
			devOptions: {
				enabled: true,
				type: 'module',
				navigateFallback: '/'
			}
		})
	]
});
