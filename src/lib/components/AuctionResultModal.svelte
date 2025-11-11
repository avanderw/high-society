<script lang="ts">
	import type { Player } from '$lib/domain/player';
	import type { StatusCard } from '$lib/domain/cards';

	interface Props {
		winner: Player | null;
		card: StatusCard;
		winningBid: number;
		onClose: () => void;
	}

	let { winner, card, winningBid, onClose }: Props = $props();
</script>

<dialog open>
	<article>
		<header>
			<h2>🎯 Auction Complete!</h2>
		</header>

		<section class="result-content">
			{#if winner}
				<div class="winner-info">
					<h3>
						<span style="color: {winner.color};">●</span>
						{winner.name} wins!
					</h3>
					<p class="winning-bid">Winning bid: {winningBid.toLocaleString()} Francs</p>
				</div>

				<div class="card-won">
					<h4>Card Won:</h4>
					<div class="card-display">
						<strong>{card.name}</strong>
						<span class="card-value">{card.getDisplayValue()}</span>
					</div>
				</div>
			{:else}
				<div class="no-winner">
					<p>No one won this auction!</p>
					<p class="card-info">The card <strong>{card.name}</strong> goes back to the deck.</p>
				</div>
			{/if}
		</section>

		<footer>
			<button onclick={onClose} class="primary">Continue</button>
		</footer>
	</article>
</dialog>

<style>
	dialog {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: rgba(0, 0, 0, 0.7);
		z-index: 1000;
		padding: 1rem;
	}

	article {
		max-width: 500px;
		width: 100%;
		margin: 0;
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			transform: translateY(-50px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.result-content {
		text-align: center;
		padding: 1rem 0;
	}

	.winner-info h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
	}

	.winning-bid {
		font-size: 1.1rem;
		color: var(--pico-primary);
		font-weight: bold;
	}

	.card-won {
		margin-top: 1.5rem;
		padding: 1rem;
		background-color: var(--pico-card-sectioning-background-color);
		border-radius: var(--pico-border-radius);
	}

	.card-won h4 {
		margin: 0 0 1rem 0;
		color: var(--pico-muted-color);
	}

	.card-display {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		background-color: var(--pico-card-background-color);
		border: 2px solid var(--pico-primary);
		border-radius: var(--pico-border-radius);
	}

	.card-display strong {
		font-size: 1.2rem;
	}

	.card-value {
		font-size: 2rem;
		font-weight: bold;
		color: var(--pico-primary);
	}

	.no-winner {
		padding: 2rem 0;
	}

	.no-winner p {
		margin-bottom: 1rem;
		font-size: 1.1rem;
	}

	.card-info {
		color: var(--pico-muted-color);
	}

	footer {
		text-align: center;
		margin-top: 1rem;
	}

	footer button {
		min-width: 150px;
	}
</style>
