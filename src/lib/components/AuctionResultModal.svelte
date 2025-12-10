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
		<header class={isDisgrace ? 'disgrace' : 'success'}>
			<h2>{isDisgrace ? 'Disgrace!' : 'Auction Won!'}</h2>
		</header>

		<section class="result-content">
			<div class="layout-row">
				<!-- Card Display -->
				<div class="card-container">
					<div class="status-card {isDisgrace ? 'disgrace' : 'luxury'}">
						<div class="card-name">{card.name}</div>
						<div class="card-value">{card.getDisplayValue()}</div>
					</div>
				</div>

				<!-- Result Info -->
				<div class="result-info">
					{#if winner}
						<div class="winner-row">
							<span class="player-dot" style="background-color: {winner.color};"></span>
							<span class="player-name">{winner.name}</span>
						</div>
						
						{#if isDisgrace}
							<div class="result-detail refund">
								<span class="label">Refunded</span>
								<span class="value">{winningBid.toLocaleString()}F</span>
							</div>
						{:else}
							<div class="result-detail paid">
								<span class="label">Paid</span>
								<span class="value">{winningBid.toLocaleString()}F</span>
							</div>
						{/if}

						{#if isDisgrace && losersInfo.length > 0}
							<div class="losers-section">
								<span class="losers-label">Lost bids:</span>
								{#each losersInfo as { player, bidAmount }}
									<div class="loser-row">
										<span class="player-dot small" style="background-color: {player.color};"></span>
										<span class="loser-name">{player.name}</span>
										<span class="loser-amount">-{bidAmount.toLocaleString()}F</span>
									</div>
								{/each}
							</div>
						{/if}
					{:else}
						<div class="no-winner">
							<p>No winner</p>
							<small>Card returned to deck</small>
						</div>
					{/if}
				</div>
			</div>
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
		backdrop-filter: blur(2px);
		z-index: 1000;
		padding: 1rem;
	}

	article {
		max-width: min(420px, 95vw);
		width: 100%;
		margin: 0;
		animation: slideIn 0.3s ease-out;
		max-height: 90vh;
		overflow-y: auto;
	}

	@keyframes slideIn {
		from {
			transform: translateY(-30px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	header {
		text-align: center;
		padding: 0.75rem 1rem;
		margin: -1rem -1rem 1rem -1rem;
		border-radius: var(--pico-border-radius) var(--pico-border-radius) 0 0;
	}

	header.success {
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(0, 255, 0, 0.15) 100%);
		border-bottom: 2px solid var(--pico-ins-color);
	}

	header.disgrace {
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(255, 0, 0, 0.15) 100%);
		border-bottom: 2px solid var(--pico-del-color);
	}

	header h2 {
		margin: 0;
		font-size: clamp(1.1rem, 4vw, 1.3rem);
	}

	header.success h2 {
		color: var(--pico-ins-color);
	}

	header.disgrace h2 {
		color: var(--pico-del-color);
	}

	.result-content {
		padding: 0.5rem 0;
	}

	.layout-row {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}

	.card-container {
		flex: 0 0 auto;
	}

	.status-card {
		width: 100px;
		aspect-ratio: 2.5 / 3.5;
		padding: 0.5rem;
		border: 3px solid var(--pico-primary);
		border-radius: var(--pico-border-radius);
		text-align: center;
		background: var(--pico-card-background-color);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 0.25rem;
		position: relative;
		overflow: hidden;
	}

	.status-card::before {
		content: '';
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: linear-gradient(
			45deg,
			transparent 30%,
			rgba(255, 255, 255, 0.1) 50%,
			transparent 70%
		);
		animation: shimmer 3s infinite;
	}

	@keyframes shimmer {
		0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
		100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
	}

	.status-card.luxury {
		border-color: var(--pico-primary);
	}

	.status-card.disgrace {
		border-color: var(--pico-del-color);
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(255, 0, 0, 0.1) 100%);
	}

	.card-name {
		font-size: clamp(0.7rem, 2.5vw, 0.85rem);
		font-weight: 600;
		line-height: 1.2;
		position: relative;
		z-index: 1;
	}

	.card-value {
		font-size: clamp(1.5rem, 6vw, 2rem);
		font-weight: bold;
		color: var(--pico-primary);
		position: relative;
		z-index: 1;
	}

	.status-card.disgrace .card-value {
		color: var(--pico-del-color);
	}

	.result-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.winner-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.player-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.player-dot.small {
		width: 8px;
		height: 8px;
	}

	.player-name {
		font-weight: 700;
		font-size: clamp(1rem, 3vw, 1.15rem);
	}

	.result-detail {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.4rem 0.6rem;
		border-radius: var(--pico-border-radius);
		font-size: clamp(0.85rem, 2.5vw, 0.95rem);
	}

	.result-detail.paid {
		background: linear-gradient(90deg, transparent 0%, rgba(0, 255, 0, 0.1) 100%);
		border-left: 3px solid var(--pico-ins-color);
	}

	.result-detail.refund {
		background: linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.1) 100%);
		border-left: 3px solid #d4af37;
	}

	.result-detail .label {
		color: var(--pico-muted-color);
	}

	.result-detail .value {
		font-weight: 700;
	}

	.result-detail.paid .value {
		color: var(--pico-ins-color);
	}

	.result-detail.refund .value {
		color: #d4af37;
	}

	.losers-section {
		margin-top: 0.5rem;
		padding: 0.5rem;
		background: rgba(255, 0, 0, 0.05);
		border-radius: var(--pico-border-radius);
		border: 1px solid var(--pico-del-color);
	}

	.losers-label {
		display: block;
		font-size: clamp(0.7rem, 2vw, 0.8rem);
		color: var(--pico-del-color);
		font-weight: 600;
		margin-bottom: 0.35rem;
	}

	.loser-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: clamp(0.75rem, 2vw, 0.85rem);
		padding: 0.2rem 0;
	}

	.loser-name {
		flex: 1;
	}

	.loser-amount {
		font-weight: 600;
		color: var(--pico-del-color);
	}

	.no-winner {
		text-align: center;
		padding: 1rem 0;
	}

	.no-winner p {
		margin: 0;
		font-size: clamp(1rem, 3vw, 1.1rem);
		font-weight: 600;
	}

	.no-winner small {
		color: var(--pico-muted-color);
	}

	footer {
		text-align: center;
		padding-top: 0.5rem;
	}

	footer button {
		min-width: 120px;
		font-size: clamp(0.875rem, 2.5vw, 1rem);
	}

	@media (prefers-reduced-motion: reduce) {
		.status-card::before {
			animation: none;
		}
		article {
			animation: none;
		}
	}
</style>
