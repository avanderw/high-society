<script lang="ts">
	import type { GameState } from '$lib/domain/gameState';
	import { GamePhase } from '$lib/domain/gameState';

	interface Props {
		gameState: GameState;
		updateKey?: number;
	}

	let { gameState, updateKey = 0 }: Props = $props();

	const publicState = $derived(updateKey >= 0 ? gameState.getPublicState() : gameState.getPublicState());
	const currentCard = $derived(publicState.currentCard);
	const phase = $derived(publicState.phase);
</script>

<article>
	<header>
		<hgroup>
			<h3>Current Auction</h3>
			<p>
				{#if phase === GamePhase.DISGRACE_AUCTION}
					<mark>Disgrace! Bid to avoid this card</mark>
				{:else}
					Bid to win this luxury item
				{/if}
			</p>
		</hgroup>
	</header>

	{#if currentCard}
		<section class="card-display">
			<div class="status-card {phase === GamePhase.DISGRACE_AUCTION ? 'disgrace' : 'luxury'}">
				<h2>{currentCard.name}</h2>
				<div class="card-value">
					{currentCard.getDisplayValue()}
				</div>
			</div>
		</section>
	{/if}

	<footer>
		<small>
			Game End Triggers: {publicState.gameEndTriggerCount} / 4
			• Cards Remaining: {publicState.remainingStatusCards}
		</small>
	</footer>
</article>

<style>
	.card-display {
		display: flex;
		justify-content: center;
		padding: 2rem 0;
	}

	.status-card {
		width: 200px;
		padding: 2rem;
		border: 3px solid var(--pico-primary);
		border-radius: var(--pico-border-radius);
		text-align: center;
		background: var(--pico-card-background-color);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
	}

	.status-card.disgrace {
		border-color: var(--pico-del-color);
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(255, 0, 0, 0.1) 100%);
	}

	.status-card h2 {
		margin: 0 0 1rem 0;
		font-size: 1.5rem;
	}

	.card-value {
		font-size: 3rem;
		font-weight: bold;
		color: var(--pico-primary);
	}

	.status-card.disgrace .card-value {
		color: var(--pico-del-color);
	}

	footer small {
		display: block;
		text-align: center;
	}
</style>
