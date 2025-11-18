<script lang="ts">
	interface Props {
		title: string;
		message: string;
		onConfirm: () => void;
		onCancel: () => void;
		confirmText?: string;
		cancelText?: string;
		type?: 'warning' | 'danger' | 'info';
	}

	let { title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning' }: Props = $props();

	function handleConfirm() {
		onConfirm();
	}

	function handleCancel() {
		onCancel();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleCancel();
		}
	}

	const icons = {
		warning: '⚠️',
		danger: '🛑',
		info: 'ℹ️'
	};
</script>

<div class="modal-backdrop" onclick={handleBackdropClick} role="presentation">
	<dialog open>
		<article>
			<header>
				<h3>
					<span class="modal-icon modal-icon-{type}">{icons[type]}</span>
					{title}
				</h3>
			</header>
			<section>
				<p>{message}</p>
			</section>
			<footer>
				<div class="grid">
					<button onclick={handleCancel} class="secondary">
						{cancelText}
					</button>
					<button onclick={handleConfirm} class={type === 'danger' ? 'contrast' : 'primary'}>
						{confirmText}
					</button>
				</div>
			</footer>
		</article>
	</dialog>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9998;
		padding: 1rem;
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	dialog {
		margin: 0;
		padding: 0;
		border: none;
		background: transparent;
		max-width: min(450px, calc(100vw - 2rem));
		width: 100%;
		animation: scaleIn 0.2s ease-out;
	}

	@keyframes scaleIn {
		from {
			transform: scale(0.9);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	article {
		margin: 0;
	}

	header h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-size: clamp(1.1rem, 3vw, 1.25rem);
	}

	.modal-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.modal-icon-warning {
		filter: drop-shadow(0 0 4px orange);
	}

	.modal-icon-danger {
		filter: drop-shadow(0 0 4px var(--pico-del-color));
	}

	.modal-icon-info {
		filter: drop-shadow(0 0 4px var(--pico-primary));
	}

	section p {
		margin: 0;
		font-size: clamp(0.875rem, 2vw, 1rem);
		line-height: 1.6;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin: 0;
	}

	button {
		margin: 0;
		font-size: clamp(0.875rem, 2vw, 1rem);
	}

	@media (prefers-reduced-motion: reduce) {
		.modal-backdrop,
		dialog {
			animation: none;
		}
	}
</style>
