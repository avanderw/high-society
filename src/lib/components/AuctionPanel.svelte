<script lang="ts">
	import type { Auction } from '$lib/domain/auction';
	import type { Player } from '$lib/domain/player';
	import { StatusCalculator } from '$lib/domain/scoring';
	import { LuxuryCard, PrestigeCard } from '$lib/domain/cards';
	import { Wifi, WifiOff, Clock } from 'lucide-svelte';

	interface Props {
		auction: Auction | null;
		currentPlayer: Player;
		currentPlayerIndex: number;
		allPlayers: Player[];
		updateKey?: number;
		connectedPlayerIds?: Set<string>;
		playerIdToGameIndex?: Map<string, number>;
		turnTimeRemaining?: number;
		turnTimerSeconds?: number;
	}

	let { auction, currentPlayer, currentPlayerIndex, allPlayers, updateKey = 0, connectedPlayerIds = new Set(), playerIdToGameIndex = new Map(), turnTimeRemaining = 0, turnTimerSeconds = 30 }: Props = $props();

	const calculator = new StatusCalculator();

	const isActive = $derived((playerId: string) => 
		auction?.getActivePlayers().has(playerId) ?? false
	);

	// Calculate timer percentage and color
	const timerPercentage = $derived((turnTimeRemaining / turnTimerSeconds) * 100);
	const timerColor = $derived(
		timerPercentage > 50 ? 'var(--pico-ins-color)' :
		timerPercentage > 25 ? 'orange' :
		'var(--pico-del-color)'
	);

	// Check if a player is connected based on their multiplayer ID
	const isPlayerConnected = $derived((gamePlayerIndex: number) => {
		// Find the multiplayer player ID for this game player index
		for (const [multiplayerId, index] of playerIdToGameIndex.entries()) {
			if (index === gamePlayerIndex) {
				return connectedPlayerIds.has(multiplayerId);
			}
		}
		// If we can't find a mapping, assume connected (fallback for safety)
		return true;
	});

	// Player status calculations
	const playerStatuses = $derived.by(() => {
		const _ = updateKey;
		// Safety check for undefined allPlayers during initialization
		if (!allPlayers || !Array.isArray(allPlayers)) {
			return [];
		}
		return allPlayers.map((player, index) => ({
			player,
			gameIndex: index,
			currentStatus: calculator.calculate(player.getStatusCards()),
			currentBid: player.getCurrentBidAmount(),
			statusCards: player.getStatusCards().sort((a, b) => {
				if (a instanceof LuxuryCard && b instanceof LuxuryCard) {
					return a.value - b.value;
				}
				if (a instanceof LuxuryCard) return -1;
				if (b instanceof LuxuryCard) return 1;
				if (a instanceof PrestigeCard && !(b instanceof PrestigeCard)) return -1;
				if (b instanceof PrestigeCard && !(a instanceof PrestigeCard)) return 1;
				return 0;
			})
		}));
	});

	// Get highest bid and winner info from auction
	const highestBid = $derived(auction?.getCurrentHighestBid() ?? 0);
	const hasHighestBid = $derived((player: Player) => {
		if (!auction || highestBid === 0) return false;
		return player.getCurrentBidAmount() === highestBid;
	});
</script>

<article>
	<header>
		<h3>Players</h3>
		{#if auction && highestBid > 0}
			<small class="highest-bid-display">
				High: <strong>{highestBid.toLocaleString()}F</strong>
			</small>
		{/if}
	</header>

	<section>
		{#each playerStatuses as { player, gameIndex, currentStatus, currentBid, statusCards }}
			<details class="player-status" class:disconnected={!isPlayerConnected(gameIndex)} open={gameIndex === currentPlayerIndex}>
				<summary>
					<span class="player-summary">
						<span style="color: {player.color};">●</span>
						<strong>{player.name}</strong>
						{#if !isPlayerConnected(gameIndex)}
							<span class="connection-status disconnected" title="Player disconnected">
								<WifiOff size={14} />
							</span>
						{:else}
							<span class="connection-status connected" title="Player connected">
								<Wifi size={14} />
							</span>
						{/if}
						{#if gameIndex === currentPlayerIndex && turnTimeRemaining > 0}
							<span class="turn-timer" style="color: {timerColor};">
								<Clock size={14} />
								{turnTimeRemaining}s
							</span>
						{/if}
						<span class="status-value">{currentStatus}</span>
						{#if !isActive(player.id)}
							<small class="passed-badge">(Pass)</small>
						{:else if auction && currentBid > 0}
							<span class="current-bid" class:highest-bid={hasHighestBid(player)}>
								{currentBid.toLocaleString()}F
								{#if hasHighestBid(player)}
									<small class="highest-badge">↑</small>
								{/if}
							</span>
						{/if}
						{#if player.getPendingLuxuryDiscard()}
							<mark style="background-color: var(--pico-del-color);">Discard</mark>
						{/if}
					</span>
				</summary>

				<div class="player-details">
					<div class="status-cards">
						{#if statusCards.length > 0}
							<div class="card-list">
								{#each statusCards as card}
									<div class="status-card-mini {card instanceof LuxuryCard ? 'luxury' : card instanceof PrestigeCard ? 'prestige' : 'disgrace'}">
										<strong>{card.name}</strong>
										<span>{card.getDisplayValue()}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<small class="player-money">
						{player.getTotalRemainingMoney().toLocaleString()}F
						({player.getMoneyHand().length} cards)
					</small>
				</div>
			</details>
		{/each}
	</section>
</article>

<style>
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.highest-bid-display {
		color: var(--pico-ins-color);
		font-size: clamp(0.8rem, 2.2vw, 1rem);
		font-weight: 600;
		padding: 0.35rem;
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(0, 255, 0, 0.05) 100%);
		border-radius: var(--pico-border-radius);
		border: 2px solid var(--pico-ins-color);
	}

	@media (min-width: 768px) {
		.highest-bid-display {
			padding: 0.5rem;
		}
	}

	.highest-bid-display strong {
		font-size: clamp(0.9rem, 2.5vw, 1.25rem);
	}

	section {
		font-size: clamp(0.875rem, 2vw, 1rem);
	}

	.player-status {
		padding: 0;
		margin-bottom: 0.25rem;
		background-color: var(--pico-card-sectioning-background-color);
		border-radius: var(--pico-border-radius);
		border-left: 4px solid transparent;
		transition: opacity 0.3s ease, border-color 0.3s ease;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	@media (min-width: 768px) {
		.player-status {
			margin-bottom: 0.35rem;
		}
	}

	.player-status summary {
		padding: 0.4rem 0.5rem;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}

	.player-status summary::-webkit-details-marker {
		display: none;
	}

	@media (min-width: 768px) {
		.player-status summary {
			padding: 0.5rem;
		}
	}

	.player-summary {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-wrap: wrap;
	}

	@media (min-width: 768px) {
		.player-summary {
			gap: 0.35rem;
		}
	}

	.player-details {
		padding: 0 0.5rem 0.4rem 0.5rem;
		border-top: 1px solid var(--pico-muted-border-color);
	}

	@media (min-width: 768px) {
		.player-details {
			padding: 0 0.5rem 0.5rem 0.5rem;
		}
	}

	.player-status.disconnected {
		opacity: 0.5;
		border-left-color: var(--pico-del-color);
		box-shadow: none;
	}

	.player-status:has(.passed-badge) {
		opacity: 0.7;
	}

	.player-status.disconnected:has(.passed-badge) {
		opacity: 0.4;
	}

	.player-status summary strong {
		font-size: clamp(0.8rem, 2vw, 1rem);
	}

	.connection-status {
		display: inline-flex;
		align-items: center;
		margin-left: 0.25rem;
	}

	.connection-status.connected {
		color: var(--pico-ins-color);
	}

	.connection-status.disconnected {
		color: var(--pico-del-color);
		animation: pulse-disconnect 2s infinite;
	}

	@keyframes pulse-disconnect {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.status-value {
		color: var(--pico-primary);
		font-weight: 700;
		font-size: clamp(0.85rem, 2.5vw, 1.25rem);
	}

	.turn-timer {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-weight: bold;
		font-size: clamp(0.7rem, 2vw, 0.875rem);
		padding: 0.1rem 0.3rem;
		border-radius: var(--pico-border-radius);
		background: var(--pico-card-background-color);
		border: 1px solid currentColor;
		animation: pulse-timer 1s infinite;
	}

	@media (min-width: 768px) {
		.turn-timer {
			gap: 0.25rem;
			padding: 0.125rem 0.375rem;
		}
	}

	@keyframes pulse-timer {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	.current-bid {
		color: var(--pico-primary);
		font-weight: 600;
		font-size: clamp(0.8rem, 2vw, 1rem);
		padding: 0.1rem 0.3rem;
		border-radius: var(--pico-border-radius);
		background: var(--pico-card-background-color);
		border: 1px solid var(--pico-primary);
	}

	@media (min-width: 768px) {
		.current-bid {
			padding: 0.125rem 0.375rem;
		}
	}

	.current-bid.highest-bid {
		border-color: var(--pico-ins-color);
		color: var(--pico-ins-color);
		font-weight: 700;
	}

	.highest-badge {
		color: var(--pico-ins-color);
		font-weight: bold;
		margin-left: 0.25rem;
	}

	.status-cards {
		margin: 0.3rem 0;
	}

	@media (min-width: 768px) {
		.status-cards {
			margin: 0.35rem 0;
		}
	}

	.card-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	@media (min-width: 768px) {
		.card-list {
			gap: 0.35rem;
		}
	}

	.status-card-mini {
		padding: 0.15rem 0.35rem;
		border: 2px solid var(--pico-primary);
		border-radius: var(--pico-border-radius);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.05rem;
		min-width: min(65px, 20vw);
		background: var(--pico-card-background-color);
	}

	@media (min-width: 768px) {
		.status-card-mini {
			padding: 0.2rem 0.4rem;
			min-width: 70px;
			gap: 0.1rem;
		}
	}

	.status-card-mini.luxury {
		border-color: var(--pico-primary);
	}

	.status-card-mini.prestige {
		border-color: var(--pico-ins-color);
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(0, 255, 0, 0.1) 100%);
	}

	.status-card-mini.disgrace {
		border-color: var(--pico-del-color);
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(255, 0, 0, 0.1) 100%);
	}

	.status-card-mini strong {
		font-size: clamp(0.6rem, 1.8vw, 0.75rem);
		text-align: center;
		line-height: 1.2;
	}

	.status-card-mini span {
		font-size: clamp(0.8rem, 2.5vw, 1rem);
		font-weight: bold;
	}

	.player-money {
		display: block;
		font-size: clamp(0.65rem, 1.8vw, 0.875rem);
		color: var(--pico-muted-color);
		margin-top: 0.3rem;
	}

	@media (min-width: 768px) {
		.player-money {
			margin-top: 0.35rem;
		}
	}

	mark {
		padding: 0.1rem 0.2rem;
		font-size: clamp(0.6rem, 1.8vw, 0.75rem);
	}

	@media (min-width: 768px) {
		mark {
			padding: 0.125rem 0.25rem;
		}
	}
</style>
