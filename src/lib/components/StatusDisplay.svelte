<script lang="ts">
	import type { Player } from '$lib/domain/player';
	import { StatusCalculator } from '$lib/domain/scoring';
	import { LuxuryCard, PrestigeCard } from '$lib/domain/cards';
	import { Clock } from 'lucide-svelte';

	interface Props {
		players: Player[];
		updateKey?: number;
		currentPlayerIndex?: number;
		turnTimeRemaining?: number;
		turnTimerSeconds?: number;
	}

	let { players, updateKey = 0, currentPlayerIndex = -1, turnTimeRemaining = 0, turnTimerSeconds = 30 }: Props = $props();

	const calculator = new StatusCalculator();

	// Force reactivity by ensuring derived depends on updateKey
	const playerStatuses = $derived.by(() => {
		// This forces the derived to re-run when updateKey changes
		const _ = updateKey;
		// Safety check for undefined players during initialization
		if (!players || !Array.isArray(players)) {
			return [];
		}
		return players.map((player, index) => ({
			player,
			playerIndex: index,
			currentStatus: calculator.calculate(player.getStatusCards()),
			// Sort status cards by value (ascending) - luxury cards first, then prestige, then disgrace
			statusCards: player.getStatusCards().sort((a, b) => {
				// Luxury cards - sort by value ascending
				if (a instanceof LuxuryCard && b instanceof LuxuryCard) {
					return a.value - b.value;
				}
				// Keep luxury cards before prestige/disgrace
				if (a instanceof LuxuryCard) return -1;
				if (b instanceof LuxuryCard) return 1;
				// Keep prestige before disgrace
				if (a instanceof PrestigeCard && !(b instanceof PrestigeCard)) return -1;
				if (b instanceof PrestigeCard && !(a instanceof PrestigeCard)) return 1;
				// Within same type, maintain order
				return 0;
			})
		}));
	});

	// Calculate timer percentage and color
	const timerPercentage = $derived((turnTimeRemaining / turnTimerSeconds) * 100);
	const timerColor = $derived(
		timerPercentage > 50 ? 'var(--pico-ins-color)' :
		timerPercentage > 25 ? 'orange' :
		'var(--pico-del-color)'
	);
</script>

<article>
	<header>
		<h3>Player Status</h3>
	</header>

	<section>
		{#each playerStatuses as { player, playerIndex, currentStatus, statusCards }}
			<details>
				<summary>
					<span style="color: {player.color};">●</span>
					<strong>{player.name}</strong> - Status: {currentStatus}
					{#if player.getPendingLuxuryDiscard()}
						<mark style="background-color: var(--pico-del-color);">Must Discard</mark>
					{/if}
					{#if playerIndex === currentPlayerIndex && turnTimeRemaining > 0}
						<span class="turn-timer" style="color: {timerColor};">
							<Clock size={14} />
							{turnTimeRemaining}s
						</span>
					{/if}
				</summary>

				<div class="status-cards">
					{#if statusCards.length === 0}
						<p><em>No status cards yet</em></p>
					{:else}
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

				<small>
					Money remaining: {player.getTotalRemainingMoney().toLocaleString()} Francs
					({player.getMoneyHand().length} cards)
				</small>
			</details>
		{/each}
	</section>
</article>

<style>
	summary {
		cursor: pointer;
		padding: 0.5rem;
		margin: 0.25rem 0;
		font-size: clamp(0.875rem, 2vw, 1rem);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	summary:hover {
		background: var(--pico-card-sectioning-background-color);
	}

	.turn-timer {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-weight: bold;
		font-size: clamp(0.75rem, 2vw, 0.875rem);
		margin-left: auto;
		padding: 0.125rem 0.375rem;
		border-radius: var(--pico-border-radius);
		background: var(--pico-card-background-color);
		border: 1px solid currentColor;
	}

	.status-cards {
		padding: 0.5rem;
		margin: 0.5rem 0;
	}

	@media (min-width: 768px) {
		.status-cards {
			padding: 1rem;
		}
	}

	.card-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.status-card-mini {
		padding: 0.5rem 0.75rem;
		border: 2px solid var(--pico-primary);
		border-radius: var(--pico-border-radius);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		min-width: min(100px, 25vw);
		background: var(--pico-card-background-color);
	}

	@media (min-width: 768px) {
		.status-card-mini {
			padding: 0.5rem 1rem;
			min-width: 100px;
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
		font-size: clamp(0.75rem, 2vw, 0.875rem);
		text-align: center;
	}

	.status-card-mini span {
		font-size: clamp(1rem, 3vw, 1.25rem);
		font-weight: bold;
	}

	small {
		font-size: clamp(0.75rem, 1.8vw, 0.875rem);
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
