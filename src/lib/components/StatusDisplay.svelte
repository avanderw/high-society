<script lang="ts">
	import type { Player } from '$lib/domain/player';
	import { StatusCalculator } from '$lib/domain/scoring';
	import { LuxuryCard, PrestigeCard } from '$lib/domain/cards';

	interface Props {
		players: Player[];
	}

	let { players }: Props = $props();

	const calculator = new StatusCalculator();

	const playerStatuses = $derived(
		players.map(player => ({
			player,
			currentStatus: calculator.calculate(player.getStatusCards()),
			statusCards: player.getStatusCards()
		}))
	);
</script>

<article>
	<header>
		<h3>Player Status</h3>
	</header>

	<section>
		{#each playerStatuses as { player, currentStatus, statusCards }}
			<details>
				<summary>
					<span style="color: {player.color};">●</span>
					<strong>{player.name}</strong> - Status: {currentStatus}
					{#if player.getPendingLuxuryDiscard()}
						<mark style="background-color: var(--pico-del-color);">Must Discard</mark>
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
	}

	summary:hover {
		background: var(--pico-card-sectioning-background-color);
	}

	.status-cards {
		padding: 1rem;
		margin: 0.5rem 0;
	}

	.card-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.status-card-mini {
		padding: 0.5rem 1rem;
		border: 2px solid var(--pico-primary);
		border-radius: var(--pico-border-radius);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		min-width: 100px;
		background: var(--pico-card-background-color);
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
		font-size: 0.875rem;
	}

	.status-card-mini span {
		font-size: 1.25rem;
		font-weight: bold;
	}
</style>
