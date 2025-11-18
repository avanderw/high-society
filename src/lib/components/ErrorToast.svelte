<script lang="ts">
	interface Props {
		message: string;
		type?: 'error' | 'warning' | 'info' | 'success';
		onDismiss?: () => void;
		onRetry?: () => void;
		duration?: number; // Auto-dismiss after duration (ms), 0 = no auto-dismiss
	}

	let { message, type = 'error', onDismiss, onRetry, duration = 0 }: Props = $props();

	let visible = $state(true);
	let timeoutId: number | null = null;

	$effect(() => {
		if (duration > 0 && visible) {
			timeoutId = window.setTimeout(() => {
				visible = false;
				if (onDismiss) onDismiss();
			}, duration);

			return () => {
				if (timeoutId) window.clearTimeout(timeoutId);
			};
		}
	});

	function handleDismiss() {
		visible = false;
		if (onDismiss) onDismiss();
	}

	const icons = {
		error: '⚠️',
		warning: '⚠️',
		info: 'ℹ️',
		success: '✓'
	};
</script>

{#if visible}
	<div class="toast toast-{type}" role="alert" aria-live="assertive">
		<div class="toast-content">
			<span class="toast-icon">{icons[type]}</span>
			<p class="toast-message">{message}</p>
		</div>
		<div class="toast-actions">
			{#if onRetry}
				<button onclick={onRetry} class="secondary">Retry</button>
			{/if}
			{#if onDismiss}
				<button onclick={handleDismiss} class="outline">Dismiss</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.toast {
		position: fixed;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		max-width: min(500px, calc(100vw - 2rem));
		width: 100%;
		background: var(--pico-card-background-color);
		border-radius: var(--pico-border-radius);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
		padding: 1rem;
		z-index: 9999;
		animation: slideUp 0.3s ease-out;
		border-left: 4px solid;
	}

	@keyframes slideUp {
		from {
			transform: translateX(-50%) translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateX(-50%) translateY(0);
			opacity: 1;
		}
	}

	.toast-error {
		border-left-color: var(--pico-del-color);
	}

	.toast-warning {
		border-left-color: orange;
	}

	.toast-info {
		border-left-color: var(--pico-primary);
	}

	.toast-success {
		border-left-color: var(--pico-ins-color);
	}

	.toast-content {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.toast-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.toast-message {
		margin: 0;
		flex: 1;
		font-size: clamp(0.875rem, 2vw, 1rem);
		line-height: 1.5;
	}

	.toast-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.toast-actions button {
		margin: 0;
		padding: 0.375rem 0.75rem;
		font-size: clamp(0.75rem, 1.8vw, 0.875rem);
	}

	@media (prefers-reduced-motion: reduce) {
		.toast {
			animation: none;
		}
	}
</style>
