<script lang="ts">
	import { onMount } from 'svelte';

	let updateAvailable = $state(false);
	let registration: ServiceWorkerRegistration | null = null;

	onMount(() => {
		if ('serviceWorker' in navigator) {
			// Check for updates every 30 seconds
			const interval = setInterval(() => {
				navigator.serviceWorker.getRegistration().then((reg) => {
					if (reg) {
						reg.update();
					}
				});
			}, 30000);

			// Listen for service worker updates
			navigator.serviceWorker.ready.then((reg) => {
				registration = reg;

				// Check if there's a waiting service worker
				if (reg.waiting) {
					updateAvailable = true;
				}

				// Listen for new service worker
				reg.addEventListener('updatefound', () => {
					const newWorker = reg.installing;
					if (newWorker) {
						newWorker.addEventListener('statechange', () => {
							if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
								// New service worker is ready
								updateAvailable = true;
							}
						});
					}
				});
			});

			// Listen for messages from service worker
			navigator.serviceWorker.addEventListener('controllerchange', () => {
				// Service worker has been updated and is now controlling the page
				window.location.reload();
			});

			return () => {
				clearInterval(interval);
			};
		}
	});

	function updateApp() {
		if (registration && registration.waiting) {
			// Tell the service worker to skip waiting and activate immediately
			registration.waiting.postMessage({ type: 'SKIP_WAITING' });
			// Also manually call skipWaiting on the waiting worker
			registration.waiting.postMessage('skipWaiting');
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
