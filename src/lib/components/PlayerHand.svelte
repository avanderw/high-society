<script lang="ts">
	import type { Player } from '$lib/domain/player';
	import type { Auction } from '$lib/domain/auction';

	interface Props {
		player: Player;
		selectedCards: string[];
		onToggleCard: (cardId: string) => void;
		updateKey?: number;
		isMyTurn?: boolean;
		auction: Auction | null;
		onBid: () => void;
		onPass: () => void;
		isMultiplayer?: boolean;
		remainingStatusCards?: number;
	}

	let { player, selectedCards, onToggleCard, updateKey = 0, isMyTurn = true, auction, onBid, onPass, isMultiplayer = false, remainingStatusCards = 0 }: Props = $props();

	// Track whether we're on mobile (for default details state)
	let isMobile = $state(false);
	
	$effect(() => {
		if (typeof window !== 'undefined') {
			isMobile = window.innerWidth < 768;
			const handleResize = () => {
				isMobile = window.innerWidth < 768;
			};
			window.addEventListener('resize', handleResize);
			return () => window.removeEventListener('resize', handleResize);
		}
	});

	// Sort money cards by value (ascending)
	const moneyHand = $derived(
		updateKey >= 0 
			? [...player.getMoneyHand()].sort((a, b) => a.value - b.value)
			: []
	);
	const playedMoney = $derived(
		updateKey >= 0 
			? [...player.getPlayedMoney()].sort((a, b) => a.value - b.value)
			: []
	);
	const totalSelected = $derived(
		selectedCards.reduce((sum, id) => {
			const card = moneyHand.find(c => c.id === id);
			return sum + (card?.value || 0);
		}, 0)
	);

	// Bid calculations
	const currentBid = $derived.by(() => {
		const _ = updateKey;
		return auction?.getCurrentHighestBid() ?? 0;
	});
	const playerCurrentBid = $derived.by(() => {
		const _ = updateKey;
		return player.getCurrentBidAmount();
	});
	const newTotalBid = $derived(playerCurrentBid + totalSelected);
	const canBid = $derived(newTotalBid > currentBid);

	// Warning for spending too much too early
	const STARTING_MONEY = 106000; // Sum of all money cards
	const WARNING_THRESHOLD = 0.8; // 80%
	const CARDS_THRESHOLD = 11; // More than 11 cards left
	
	const shouldShowMoneyWarning = $derived.by(() => {
		// Only show warning if there are still more than 11 cards left in the deck
		if (remainingStatusCards <= CARDS_THRESHOLD) return false;
		
		// Calculate total money that would be spent (including current bid)
		const totalSpent = player.getCurrentBidAmount() + totalSelected;
		
		// Show warning if player is about to spend 80% or more of their starting money
		return totalSpent >= STARTING_MONEY * WARNING_THRESHOLD;
	});
	
	const moneyWarningText = $derived.by(() => {
		const totalSpent = player.getCurrentBidAmount() + totalSelected;
		const percentageSpent = Math.round((totalSpent / STARTING_MONEY) * 100);
		return `⚠️ Warning: You're about to spend ${percentageSpent}% of your starting money with ${remainingStatusCards} cards still remaining!`;
	});
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
			<details open={!isMobile}>
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
		{#if isMultiplayer && !isMyTurn}
			<div class="not-your-turn">
				<p>⏳ Waiting for your turn...</p>
			</div>
		{:else}
			<div class="bid-info">
				<div class="bid-row">
					<span class="bid-label">High Bid:</span>
					<span class="bid-value">{currentBid.toLocaleString()}</span>
				</div>
				{#if playerCurrentBid > 0}
					<div class="bid-row">
						<span class="bid-label">Your Bid:</span>
						<span class="bid-value">{playerCurrentBid.toLocaleString()}</span>
					</div>
					<div class="bid-row">
						<span class="bid-label">Adding:</span>
						<span class="bid-value">+{totalSelected.toLocaleString()}</span>
					</div>
					<div class="bid-row total">
						<span class="bid-label">New Total:</span>
						<span class="bid-value">{newTotalBid.toLocaleString()}</span>
					</div>
				{:else if totalSelected > 0}
					<div class="bid-row">
						<span class="bid-label">Selected:</span>
						<span class="bid-value">{totalSelected.toLocaleString()}</span>
					</div>
				{/if}
			</div>
			
			<div class="grid">
				<button 
					onclick={onBid} 
					disabled={!canBid || totalSelected === 0}
					class="primary"
				>
					Place Bid ({totalSelected.toLocaleString()})
				</button>
				<button 
					onclick={onPass}
					class="secondary"
				>
					Pass
				</button>
			</div>
			{#if !canBid && totalSelected > 0}
				<div class="warning-text">
					⚠️ Your new total ({newTotalBid.toLocaleString()}) must be higher than {currentBid.toLocaleString()}
				</div>
			{/if}
			{#if shouldShowMoneyWarning && totalSelected > 0}
				<div class="warning-text money-warning">
					{moneyWarningText}
				</div>
			{/if}
		{/if}
	</footer>
</article>

<style>
	.money-cards {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1rem 0;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.money-card {
		width: min(80px, 15vw);
		min-width: 60px;
		height: min(100px, 20vw);
		min-height: 75px;
		padding: 0.25rem;
		border: 2px solid var(--pico-muted-border-color);
		border-radius: var(--pico-border-radius);
		background: var(--pico-card-background-color);
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	@media (min-width: 768px) {
		.money-card {
			width: 80px;
			height: 100px;
			padding: 0.5rem;
		}
	}

	button.money-card {
		font-family: inherit;
		font-size: inherit;
	}

	.money-card:not(:disabled):hover {
		transform: translateY(-4px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}

	.money-card:not(:disabled):active {
		transform: translateY(-2px);
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
		font-size: clamp(1.25rem, 3vw, 1.5rem);
		font-weight: bold;
		margin-bottom: 0.25rem;
	}

	small {
		display: block;
		font-size: clamp(0.65rem, 1.5vw, 0.75rem);
	}

	footer p {
		font-size: clamp(0.875rem, 2vw, 1rem);
	}

	.bid-info {
		background-color: var(--pico-card-background-color);
		border-radius: var(--pico-border-radius);
		padding: 0.75rem;
		margin-bottom: 1rem;
	}

	.bid-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.25rem 0;
		font-size: clamp(0.875rem, 2vw, 1rem);
	}

	.bid-row.total {
		border-top: 2px solid var(--pico-primary);
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		font-weight: bold;
	}

	.bid-label {
		color: var(--pico-muted-color);
	}

	.bid-value {
		font-weight: bold;
		font-size: clamp(1rem, 2.5vw, 1.1rem);
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.5rem;
	}

	@media (min-width: 480px) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	button {
		font-size: clamp(0.875rem, 2vw, 1rem);
		padding: 0.5rem 0.75rem;
	}

	@media (min-width: 768px) {
		button {
			padding: 0.75rem 1rem;
		}
	}

	.not-your-turn {
		text-align: center;
		padding: 1rem;
		background-color: var(--pico-card-background-color);
		border-radius: var(--pico-border-radius);
		color: var(--pico-muted-color);
	}

	.not-your-turn p {
		margin: 0;
		font-size: clamp(0.875rem, 2vw, 1rem);
	}

	.warning-text {
		display: block;
		color: var(--pico-del-color);
		background-color: rgba(255, 0, 0, 0.1);
		padding: 0.5rem 0.75rem;
		border-radius: var(--pico-border-radius);
		font-size: clamp(0.75rem, 1.8vw, 0.875rem);
		font-weight: 600;
		border: 1px solid var(--pico-del-color);
		margin-top: 0.5rem;
		text-align: center;
	}

	.warning-text.money-warning {
		color: #ff8c00;
		background-color: rgba(255, 140, 0, 0.1);
		border-color: #ff8c00;
	}

	@media (min-width: 768px) {
		.warning-text {
			padding: 0.625rem 1rem;
		}
	}
</style>
