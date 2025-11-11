<script lang="ts">
	import type { Player } from '$lib/domain/player';

	interface Props {
		player: Player;
		selectedCards: string[];
		onToggleCard: (cardId: string) => void;
		updateKey?: number;
		isMyTurn?: boolean;
	}

	let { player, selectedCards, onToggleCard, updateKey = 0, isMyTurn = true }: Props = $props();

	// Sort money cards by value (descending)
	const moneyHand = $derived(
		updateKey >= 0 
			? [...player.getMoneyHand()].sort((a, b) => b.value - a.value)
			: []
	);
	const playedMoney = $derived(
		updateKey >= 0 
			? [...player.getPlayedMoney()].sort((a, b) => b.value - a.value)
			: []
	);
	const totalSelected = $derived(
		selectedCards.reduce((sum, id) => {
			const card = moneyHand.find(c => c.id === id);
			return sum + (card?.value || 0);
		}, 0)
	);
</script>

<article>
	<header>
		<h3>Your Money ({player.name})</h3>
		<small>
			Available: {player.getTotalRemainingMoney().toLocaleString()} Francs
			{#if playedMoney.length > 0}
				• Currently Bid: {player.getCurrentBidAmount().toLocaleString()} Francs
			{/if}
		</small>
	</header>

	<section>
		<div class="money-cards">
			{#each moneyHand as card}
				<button
					class="money-card {selectedCards.includes(card.id) ? 'selected' : ''}"
					onclick={() => onToggleCard(card.id)}
					style="--card-color: {player.color};"
					disabled={!isMyTurn}
				>
					<div class="card-content">
						<div class="card-value">{card.getDisplayValue()}</div>
						<small>{card.value.toLocaleString()}</small>
					</div>
				</button>
			{/each}
		</div>

		{#if playedMoney.length > 0}
			<details open>
				<summary>Currently Bid</summary>
				<div class="money-cards">
					{#each playedMoney as card}
						<div class="money-card bid" style="--card-color: {player.color};">
							<div class="card-content">
								<div class="card-value">{card.getDisplayValue()}</div>
								<small>{card.value.toLocaleString()}</small>
							</div>
						</div>
					{/each}
				</div>
			</details>
		{/if}
	</section>

	<footer>
		<p>
			<strong>Selected Total:</strong> {totalSelected.toLocaleString()} Francs
		</p>
	</footer>
</article>

<style>
	.money-cards {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1rem 0;
	}

	.money-card {
		width: 80px;
		height: 100px;
		padding: 0.5rem;
		border: 2px solid var(--pico-muted-border-color);
		border-radius: var(--pico-border-radius);
		background: var(--pico-card-background-color);
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	button.money-card {
		font-family: inherit;
		font-size: inherit;
	}

	.money-card:not(:disabled):hover {
		transform: translateY(-4px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}

	.money-card:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.money-card.selected {
		border-color: var(--card-color);
		border-width: 3px;
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, var(--card-color) 10%, var(--pico-card-background-color) 100%);
		box-shadow: 0 0 12px var(--card-color);
	}

	.money-card.bid {
		opacity: 0.6;
		cursor: default;
		border-color: var(--card-color);
	}

	.card-content {
		text-align: center;
		width: 100%;
	}

	.card-value {
		font-size: 1.5rem;
		font-weight: bold;
		margin-bottom: 0.25rem;
	}

	small {
		display: block;
		font-size: 0.75rem;
	}
</style>
