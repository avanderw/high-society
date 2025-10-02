<script lang="ts">
	import { onMount } from 'svelte';

	let updateAvailable = $state(false);
	let registration: ServiceWorkerRegistration | null = null;
	let hasShownPrompt = false;

	onMount(() => {
		if ('serviceWorker' in navigator) {
			// Listen for controller change (new SW activated)
			let refreshing = false;
			navigator.serviceWorker.addEventListener('controllerchange', () => {
				if (!refreshing) {
					refreshing = true;
					window.location.reload();
				}
			});

			// Wait for service worker to be ready
			navigator.serviceWorker.ready.then((reg) => {
				registration = reg;

				// Check for updates every 60 seconds (not too aggressive)
				const interval = setInterval(() => {
					if (reg && !hasShownPrompt) {
						reg.update();
					}
				}, 60000);

				// Check if there's already a waiting service worker
				if (reg.waiting && !hasShownPrompt) {
					updateAvailable = true;
					hasShownPrompt = true;
				}

				// Listen for new service worker being installed
				reg.addEventListener('updatefound', () => {
					const newWorker = reg.installing;
					if (!newWorker) return;

					newWorker.addEventListener('statechange', () => {
						if (newWorker.state === 'installed' && navigator.serviceWorker.controller && !hasShownPrompt) {
							// New service worker is ready
							updateAvailable = true;
							hasShownPrompt = true;
						}
					});
				});

				return () => {
					clearInterval(interval);
				};
			});
		}
	});

	function updateApp() {
		updateAvailable = false;
		if (registration && registration.waiting) {
			// Tell the service worker to skip waiting
			registration.waiting.postMessage({ type: 'SKIP_WAITING' });
		}
	}

	function dismissUpdate() {
		updateAvailable = false;
	}
</script>

{#if updateAvailable}
	<dialog open>
		<article>
			<header>
				<h3>Update Available</h3>
			</header>
			<p>
				A new version of High Society is available. Update now to get the latest features and improvements.
			</p>
			<footer>
				<button onclick={dismissUpdate} class="secondary">
					Later
				</button>
				<button onclick={updateApp}>
					Update Now
				</button>
			</footer>
		</article>
	</dialog>
{/if}

<style>
	dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		max-width: 90%;
		width: 400px;
		z-index: 9999;
		background: var(--background-color);
		border: 1px solid var(--muted-border-color);
		border-radius: var(--border-radius);
		box-shadow: var(--card-box-shadow);
	}

	article {
		margin: 0;
	}

	header {
		padding-bottom: 0;
	}

	footer {
		display: flex;
		gap: var(--spacing);
		justify-content: flex-end;
	}
</style>
