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
		return allPlayers.map((player, index) => ({
			player,
			gameIndex: index,
			currentStatus: calculator.calculate(player.getStatusCards()),
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
</script>

<article>
	<header>
		<h3>Player Status</h3>
	</header>

	<section>
		{#each playerStatuses as { player, gameIndex, currentStatus, statusCards }}
				<div class="player-status" class:disconnected={!isPlayerConnected(gameIndex)}>
					<div class="player-header">
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
						<span class="status-value">Status: {currentStatus}</span>
						{#if !isActive(player.id)}
							<small class="passed-badge">(Passed)</small>
						{/if}
						{#if player.getPendingLuxuryDiscard()}
							<mark style="background-color: var(--pico-del-color);">Must Discard</mark>
						{/if}
					</div>

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
						Money: {player.getTotalRemainingMoney().toLocaleString()} Francs
						({player.getMoneyHand().length} cards)
					</small>
				</div>
			{/each}
	</section>
</article>

<style>
	section {
		font-size: clamp(0.875rem, 2vw, 1rem);
	}

	.player-status {
		padding: 0.75rem;
		margin-bottom: 0.5rem;
		background-color: var(--pico-card-sectioning-background-color);
		border-radius: var(--pico-border-radius);
		border-left: 3px solid transparent;
		transition: opacity 0.3s ease;
	}

	.player-status.disconnected {
		opacity: 0.5;
		border-left-color: var(--pico-del-color);
	}

	.player-status:has(.passed-badge) {
		opacity: 0.7;
	}

	.player-status.disconnected:has(.passed-badge) {
		opacity: 0.4;
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

	.player-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}

	.player-header strong {
		font-size: clamp(0.875rem, 2vw, 1rem);
	}

	.turn-timer {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-weight: bold;
		font-size: clamp(0.75rem, 2vw, 0.875rem);
		padding: 0.125rem 0.375rem;
		border-radius: var(--pico-border-radius);
		background: var(--pico-card-background-color);
		border: 1px solid currentColor;
		animation: pulse-timer 1s infinite;
	}

	@keyframes pulse-timer {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	.status-value {
		color: var(--pico-primary);
		font-weight: 600;
		font-size: clamp(0.875rem, 2vw, 1rem);
	}

	.passed-badge {
		color: var(--pico-muted-color);
		font-style: italic;
	}

	.status-cards {
		margin: 0.5rem 0;
	}

	.card-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.status-card-mini {
		padding: 0.25rem 0.5rem;
		border: 2px solid var(--pico-primary);
		border-radius: var(--pico-border-radius);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.125rem;
		min-width: min(80px, 20vw);
		background: var(--pico-card-background-color);
	}

	@media (min-width: 768px) {
		.status-card-mini {
			padding: 0.375rem 0.625rem;
			min-width: 80px;
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
		font-size: clamp(0.65rem, 1.8vw, 0.75rem);
		text-align: center;
		line-height: 1.2;
	}

	.status-card-mini span {
		font-size: clamp(0.875rem, 2.5vw, 1rem);
		font-weight: bold;
	}

	.player-money {
		display: block;
		font-size: clamp(0.75rem, 1.8vw, 0.875rem);
		color: var(--pico-muted-color);
		margin-top: 0.5rem;
	}

	mark {
		padding: 0.125rem 0.25rem;
		font-size: clamp(0.65rem, 1.8vw, 0.75rem);
	}

	@media (min-width: 768px) {
		mark {
			padding: 0.25rem 0.5rem;
		}
	}
</style>
