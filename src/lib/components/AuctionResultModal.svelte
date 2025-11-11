<script lang="ts">
	import type { Player } from '$lib/domain/player';
	import type { StatusCard } from '$lib/domain/cards';

	interface Props {
		winner: Player | null;
		card: StatusCard;
		winningBid: number;
		onClose: () => void;
		isDisgrace?: boolean;
		losersInfo?: Array<{ player: Player; bidAmount: number }>;
	}

	let { winner, card, winningBid, onClose, isDisgrace = false, losersInfo = [] }: Props = $props();
</script>

<dialog open>
	<article>
		<header>
			<h2>{isDisgrace ? '😱 Disgrace!' : '🎯 Auction Complete!'}</h2>
		</header>

		<section class="result-content">
			{#if winner}
				{#if isDisgrace}
					<!-- Disgrace card result -->
					<div class="disgrace-info">
						<h3>
							<span style="color: {winner.color};">●</span>
							{winner.name} gets the disgrace card
						</h3>
						<p class="disgrace-note">They passed first and got their money back: {winningBid.toLocaleString()} Francs</p>
					</div>

					<div class="card-won disgrace-card">
						<h4>Card Received:</h4>
						<div class="card-display disgrace">
							<strong>{card.name}</strong>
							<span class="card-value">{card.getDisplayValue()}</span>
						</div>
					</div>

					{#if losersInfo.length > 0}
						<div class="bids-section">
							<h4>Other Players' Bids (Lost):</h4>
							<div class="bids-list">
								{#each losersInfo as { player, bidAmount }}
									<div class="bid-item paid">
										<span style="color: {player.color};">●</span>
										<strong>{player.name}</strong>
										<span class="bid-amount lost">{bidAmount.toLocaleString()} Francs</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{:else}
					<!-- Regular luxury card result -->
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
				{/if}
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
		max-width: min(500px, 95vw);
		width: 100%;
		margin: 0;
		animation: slideIn 0.3s ease-out;
		max-height: 90vh;
		overflow-y: auto;
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

	header h2 {
		font-size: clamp(1.25rem, 4vw, 1.5rem);
	}

	.result-content {
		text-align: center;
		padding: 1rem 0;
	}

	.winner-info h3 {
		margin: 0 0 0.5rem 0;
		font-size: clamp(1.25rem, 4vw, 1.5rem);
	}

	.winning-bid {
		font-size: clamp(1rem, 2.5vw, 1.1rem);
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
		font-size: clamp(0.875rem, 2.5vw, 1rem);
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

	.card-display.disgrace {
		border-color: var(--pico-del-color);
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(255, 0, 0, 0.1) 100%);
	}

	.card-display strong {
		font-size: clamp(1rem, 3vw, 1.2rem);
	}

	.card-value {
		font-size: clamp(1.5rem, 5vw, 2rem);
		font-weight: bold;
		color: var(--pico-primary);
	}

	.card-display.disgrace .card-value {
		color: var(--pico-del-color);
	}

	.disgrace-info h3 {
		margin: 0 0 0.5rem 0;
		font-size: clamp(1.25rem, 4vw, 1.5rem);
	}

	.disgrace-note {
		font-size: clamp(0.875rem, 2.5vw, 1rem);
		color: var(--pico-muted-color);
		font-style: italic;
	}

	.card-won.disgrace-card {
		border: 2px solid var(--pico-del-color);
	}

	.bids-section {
		margin-top: 1.5rem;
		padding: 1rem;
		background-color: rgba(255, 0, 0, 0.05);
		border-radius: var(--pico-border-radius);
		border: 1px solid var(--pico-del-color);
	}

	.bids-section h4 {
		margin: 0 0 1rem 0;
		color: var(--pico-del-color);
		font-size: clamp(0.875rem, 2.5vw, 1rem);
	}

	.bids-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.bid-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background-color: var(--pico-card-background-color);
		border-radius: var(--pico-border-radius);
		border-left: 3px solid var(--pico-del-color);
	}

	.bid-item strong {
		flex: 1;
	}

	.bid-amount {
		font-weight: bold;
		font-size: clamp(0.875rem, 2vw, 1rem);
		color: var(--pico-del-color);
	}

	.no-winner {
		padding: 2rem 0;
	}

	.no-winner p {
		margin-bottom: 1rem;
		font-size: clamp(1rem, 2.5vw, 1.1rem);
	}

	.card-info {
		color: var(--pico-muted-color);
		font-size: clamp(0.875rem, 2vw, 1rem);
	}

	footer {
		text-align: center;
		margin-top: 1rem;
	}

	footer button {
		min-width: min(150px, 100%);
		font-size: clamp(0.875rem, 2.5vw, 1rem);
	}
</style>
