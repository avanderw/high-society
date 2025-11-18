<script lang="ts">
	interface Props {
		message?: string;
		size?: 'small' | 'medium' | 'large';
	}

	let { message = 'Loading...', size = 'medium' }: Props = $props();

	const sizeClasses = {
		small: 'loader-small',
		medium: 'loader-medium',
		large: 'loader-large'
	};
</script>

<div class="loading-container {sizeClasses[size]}" role="status" aria-live="polite">
	<div class="spinner"></div>
	<p>{message}</p>
</div>

<style>
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 2rem;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid var(--pico-muted-border-color);
		border-top-color: var(--pico-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.loader-small .spinner {
		width: 24px;
		height: 24px;
		border-width: 2px;
	}

	.loader-medium .spinner {
		width: 48px;
		height: 48px;
		border-width: 4px;
	}

	.loader-large .spinner {
		width: 72px;
		height: 72px;
		border-width: 6px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	p {
		margin: 0;
		color: var(--pico-muted-color);
		font-size: clamp(0.875rem, 2vw, 1rem);
		text-align: center;
	}

	.loader-small p {
		font-size: clamp(0.75rem, 1.8vw, 0.875rem);
	}

	.loader-large p {
		font-size: clamp(1rem, 2.5vw, 1.25rem);
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation-duration: 2s;
		}
	}
</style>
