<script lang="ts">
	import { WifiOff } from 'lucide-svelte';

	interface Props {
		attempt: number;
		maxAttempts: number;
		nextDelay: number; // milliseconds
		onCancel?: () => void;
	}

	let { attempt, maxAttempts, nextDelay, onCancel }: Props = $props();

	const secondsUntilRetry = $derived(Math.ceil(nextDelay / 1000));
</script>

<div class="reconnection-banner" role="alert" aria-live="polite">
	<div class="banner-content">
		<WifiOff size={24} class="banner-icon" />
		<div class="banner-text">
			<strong>Connection Lost</strong>
			<p>
				Reconnecting... (Attempt {attempt}/{maxAttempts})
				{#if secondsUntilRetry > 0}
					<br />
					<small>Next attempt in {secondsUntilRetry}s</small>
				{/if}
			</p>
		</div>
	</div>
	{#if onCancel}
		<button onclick={onCancel} class="secondary small">Cancel</button>
	{/if}
</div>

<style>
	.reconnection-banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		background: var(--pico-del-color);
		color: white;
		padding: 1rem;
		z-index: 9999;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
		animation: slideDown 0.3s ease-out;
	}

	@keyframes slideDown {
		from {
			transform: translateY(-100%);
		}
		to {
			transform: translateY(0);
		}
	}

	.banner-content {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex: 1;
	}

	:global(.banner-icon) {
		flex-shrink: 0;
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.banner-text {
		flex: 1;
	}

	.banner-text strong {
		display: block;
		font-size: clamp(0.875rem, 2vw, 1rem);
		margin-bottom: 0.25rem;
	}

	.banner-text p {
		margin: 0;
		font-size: clamp(0.75rem, 1.8vw, 0.875rem);
		opacity: 0.9;
	}

	.banner-text small {
		font-size: clamp(0.7rem, 1.6vw, 0.8rem);
		opacity: 0.8;
	}

	button.small {
		padding: 0.375rem 0.75rem;
		font-size: clamp(0.75rem, 1.8vw, 0.875rem);
		margin: 0;
		background: white;
		color: var(--pico-del-color);
		border: none;
	}

	button.small:hover {
		background: rgba(255, 255, 255, 0.9);
	}

	@media (prefers-reduced-motion: reduce) {
		.reconnection-banner,
		:global(.banner-icon) {
			animation: none;
		}
	}
</style>
