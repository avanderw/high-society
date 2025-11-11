import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'url';

export default defineConfig({
	plugins: [svelte({ hot: !process.env.VITEST })],
	test: {
		globals: true,
		environment: 'happy-dom',
		setupFiles: ['./src/tests/setup.ts']
	},
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	}
});
