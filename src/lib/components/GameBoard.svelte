<script lang="ts">
	import type { GameState } from '$lib/domain/gameState';
	import { GamePhase } from '$lib/domain/gameState';

	interface Props {
		gameState: GameState;
		updateKey?: number;
	}

	let { gameState, updateKey = 0 }: Props = $props();

	// Force reactivity by ensuring derived depends on updateKey
	const publicState = $derived.by(() => {
		// This forces the derived to re-run when updateKey changes
		const _ = updateKey;
		return gameState.getPublicState();
	});
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
		padding: 1rem 0;
	}

	@media (min-width: 768px) {
		.card-display {
			padding: 2rem 0;
		}
	}

	.status-card {
		width: min(200px, 80vw);
		padding: 1rem;
		border: 3px solid var(--pico-primary);
		border-radius: var(--pico-border-radius);
		text-align: center;
		background: var(--pico-card-background-color);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
		animation: cardReveal 0.4s ease-out;
		position: relative;
		overflow: hidden;
	}

	@keyframes cardReveal {
		from {
			opacity: 0;
			transform: translateY(-30px) rotateX(15deg);
		}
		to {
			opacity: 1;
			transform: translateY(0) rotateX(0);
		}
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
		0% {
			transform: translateX(-100%) translateY(-100%) rotate(45deg);
		}
		100% {
			transform: translateX(100%) translateY(100%) rotate(45deg);
		}
	}

	@media (min-width: 768px) {
		.status-card {
			width: 200px;
			padding: 2rem;
			box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
		}
	}

	.status-card.disgrace {
		border-color: var(--pico-del-color);
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(255, 0, 0, 0.1) 100%);
	}

	.status-card.disgrace::before {
		background: linear-gradient(
			45deg,
			transparent 30%,
			rgba(255, 0, 0, 0.1) 50%,
			transparent 70%
		);
	}

	.status-card h2 {
		margin: 0 0 0.75rem 0;
		font-size: clamp(1.25rem, 4vw, 1.5rem);
	}

	@media (min-width: 768px) {
		.status-card h2 {
			margin: 0 0 1rem 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.status-card,
		.status-card::before {
			animation: none;
		}
	}

	.card-value {
		font-size: clamp(2rem, 8vw, 3rem);
		font-weight: bold;
		color: var(--pico-primary);
	}

	.status-card.disgrace .card-value {
		color: var(--pico-del-color);
	}

	footer small {
		display: block;
		text-align: center;
		font-size: clamp(0.75rem, 2vw, 0.875rem);
	}
</style>
