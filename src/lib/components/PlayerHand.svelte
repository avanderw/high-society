<script lang="ts">
	import type { Player } from '$lib/domain/player';
	import type { Auction } from '$lib/domain/auction';
	import { vibrate, HapticPattern } from '$lib/utils/haptics';

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
		currentPlayerName?: string;
		currentPlayerHasPendingDiscard?: boolean;
		hasPassed?: boolean;
	}

	let { player, selectedCards, onToggleCard, updateKey = 0, isMyTurn = true, auction, onBid, onPass, isMultiplayer = false, remainingStatusCards = 0, currentPlayerName = '', currentPlayerHasPendingDiscard = false, hasPassed = false }: Props = $props();

	function handleCardToggle(cardId: string) {
		vibrate(HapticPattern.SELECTION);
		onToggleCard(cardId);
	}

	function handleBid() {
		vibrate(HapticPattern.SUCCESS);
		onBid();
	}

	function handlePass() {
		vibrate(HapticPattern.LIGHT);
		onPass();
	}

	type MoneyColorTier = 'light' | 'normal' | 'dark';

	const MONEY_COLOR_PALETTE: Record<MoneyColorTier, { fill: string; stroke: string; text: string }> = {
		light: { fill: '#f7eed3', stroke: '#d8bf78', text: '#2f2200' },
		normal: { fill: '#f3d36a', stroke: '#c99b1f', text: '#2c1f00' },
		dark: { fill: '#d8a328', stroke: '#9f6b00', text: '#221500' }
	};

	function getMoneyColorTier(value: number): MoneyColorTier {
		if (value >= 15000) return 'dark';
		if (value <= 4000) return 'light';
		return 'normal';
	}

	function getMoneyCardStyle(value: number): string {
		const colors = MONEY_COLOR_PALETTE[getMoneyColorTier(value)];
		return `--card-color:${colors.stroke};--card-fill:${colors.fill};--card-text:${colors.text};`;
	}

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
	<section>
		<div class="money-cards">
			{#each moneyHand as card}
				<button
					class="money-card {selectedCards?.includes(card.id) ? 'selected' : ''}"
					onclick={() => handleCardToggle(card.id)}
					style={getMoneyCardStyle(card.value)}
					disabled={!isMyTurn}
				>
					<div class="card-content">
						<div class="card-value">{card.getDisplayValue()}</div>
						<small>{card.value.toLocaleString()}</small>
					</div>
				</button>
			{/each}
		</div>

	</section>

</article>

<style>
	article {
		padding: 0.5rem;
	}

	@media (min-width: 768px) {
		article {
			padding: 1rem;
		}
	}

	section {
		padding: 0.1rem 0;
	}

	@media (min-width: 768px) {
		section {
			padding: 0.3rem 0;
		}
	}

	footer {
		padding-top: 0.25rem;
	}

	@media (min-width: 768px) {
		footer {
			padding-top: 0.5rem;
		}
	}

	.money-cards {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin: 0.2rem 0;
		padding-bottom: 0.1rem;
	}

	@media (min-width: 768px) {
		.money-cards {
			gap: 0.4rem;
			margin: 0.5rem 0;
		}
	}

	.money-card {
		width: 70px;
		min-width: 70px;
		height: 90px;
		min-height: 90px;
		padding: 0.25rem;
		border: 2px solid var(--card-color, var(--pico-muted-border-color));
		border-radius: var(--pico-border-radius);
		background: linear-gradient(155deg, var(--card-fill, var(--pico-card-background-color)) 0%, var(--pico-card-background-color) 70%);
		color: var(--card-text, inherit);
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		animation: cardSlideIn 0.3s ease-out;
	}

	@keyframes cardSlideIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
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
		background: linear-gradient(135deg, var(--card-fill, var(--card-color)) 0%, var(--pico-card-background-color) 100%);
		box-shadow: 0 0 12px var(--card-color);
		animation: cardSelect 0.2s ease-out;
	}

	@keyframes cardSelect {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-8px) scale(1.05); }
	}

	.money-card.bid {
		opacity: 0.65;
		cursor: default;
		border-color: var(--card-color);
		background: linear-gradient(160deg, var(--card-fill, var(--pico-card-background-color)) 0%, var(--pico-card-background-color) 85%);
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
		padding: 0.4rem 0.5rem;
		margin-bottom: 0.4rem;
	}

	@media (min-width: 768px) {
		.bid-info {
			padding: 0.6rem 0.75rem;
			margin-bottom: 0.75rem;
		}
	}

	.bid-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.1rem 0;
		font-size: clamp(0.85rem, 2vw, 0.95rem);
	}

	@media (min-width: 768px) {
		.bid-row {
			padding: 0.2rem 0;
			font-size: 1rem;
		}
	}

	.bid-row.total {
		border-top: 2px solid var(--pico-ins-color);
		margin-top: 0.3rem;
		padding-top: 0.3rem;
		font-weight: bold;
	}

	.bid-label {
		color: var(--pico-muted-color);
	}

	.bid-value {
		font-weight: bold;
		font-size: clamp(1rem, 2.5vw, 1.1rem);
		color: var(--pico-ins-color);
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.35rem;
	}

	@media (min-width: 768px) {
		.grid {
			gap: 0.5rem;
		}
	}

	button {
		font-size: clamp(0.85rem, 2vw, 0.95rem);
		padding: 0.5rem 0.5rem;
	}

	@media (min-width: 768px) {
		button {
			font-size: 1rem;
			padding: 0.6rem 0.8rem;
		}
	}

	@media (min-width: 768px) {
		button {
			padding: 0.75rem 1rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.money-card,
		.money-card.selected {
			animation: none;
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
