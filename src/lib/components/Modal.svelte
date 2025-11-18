<script lang="ts">
	/**
	 * Generic Modal Component - Svelte 5
	 * Replaces individual modal components with a reusable pattern
	 */
	
	interface ModalProps {
		show?: boolean;
		title?: string;
		size?: 'small' | 'medium' | 'large';
		type?: 'default' | 'success' | 'warning' | 'danger' | 'info';
		closable?: boolean;
		onClose?: () => void;
		children?: import('svelte').Snippet;
		footer?: import('svelte').Snippet;
	}
	
	let {
		show = $bindable(false),
		title,
		size = 'medium',
		type = 'default',
		closable = true,
		onClose,
		children,
		footer
	} = $props<ModalProps>();
	
	function handleClose() {
		if (closable && onClose) {
			onClose();
		}
	}
	
	function handleBackdropClick() {
		if (closable) {
			handleClose();
		}
	}
	
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && closable) {
			handleClose();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
	<div class="modal-container" role="presentation">
		<!-- Backdrop -->
		<div 
			class="modal-backdrop" 
			onclick={handleBackdropClick}
			role="presentation"
		></div>
		
		<!-- Modal -->
		<dialog open class="modal modal-{size} modal-{type}" role="dialog" aria-modal="true">
			<article>
				{#if title || closable}
					<header>
						{#if title}
							<h3>{title}</h3>
						{/if}
						{#if closable && onClose}
							<button 
								class="close" 
								onclick={handleClose}
								aria-label="Close"
								type="button"
							>
								✕
							</button>
						{/if}
					</header>
				{/if}
				
				<div class="modal-body">
					{#if children}
						{@render children()}
					{/if}
				</div>
				
				{#if footer}
					<footer>
						{@render footer()}
					</footer}
				{/if}
			</article>
		</dialog>
	</div>
{/if}

<style>
	.modal-container {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}
	
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(2px);
		z-index: 1001;
	}
	
	.modal {
		position: relative;
		z-index: 1002;
		margin: 0;
		max-height: 90vh;
		overflow-y: auto;
		animation: modalSlideIn 0.2s ease-out;
	}
	
	@keyframes modalSlideIn {
		from {
			opacity: 0;
			transform: translateY(-20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	
	.modal-small {
		max-width: 400px;
		width: 100%;
	}
	
	.modal-medium {
		max-width: 600px;
		width: 100%;
	}
	
	.modal-large {
		max-width: 900px;
		width: 100%;
	}
	
	.modal article {
		margin: 0;
	}
	
	.modal header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	
	.modal header h3 {
		margin: 0;
		flex: 1;
	}
	
	.modal .close {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.25rem;
		color: var(--color);
		opacity: 0.6;
		transition: opacity 0.2s, background 0.2s;
	}
	
	.modal .close:hover {
		opacity: 1;
		background: var(--secondary-hover);
	}
	
	.modal-body {
		margin-bottom: 1rem;
	}
	
	.modal footer {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--muted-border-color);
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
	
	/* Type variants */
	.modal-success header {
		color: var(--success, #2ecc71);
	}
	
	.modal-warning header {
		color: var(--warning, #f39c12);
	}
	
	.modal-danger header {
		color: var(--danger, #e74c3c);
	}
	
	.modal-info header {
		color: var(--info, #3498db);
	}
</style>
