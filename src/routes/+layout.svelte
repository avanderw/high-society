<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import '@picocss/pico/css/pico.min.css';

	let { children } = $props();

	// Register service worker
	onMount(() => {
		if ('serviceWorker' in navigator) {
			const base = import.meta.env.BASE_URL || '/';
			navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
				.then((registration) => {
					console.log('Service Worker registered:', registration);
				})
				.catch((error) => {
					console.error('Service Worker registration failed:', error);
				});
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>High Society - Card Game</title>
</svelte:head>

{@render children?.()}
