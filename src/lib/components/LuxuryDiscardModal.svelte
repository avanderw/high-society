<script lang="ts">
	import type { Player } from '$lib/domain/player';

	interface Props {
		player: Player;
		onDiscard: (cardId: string) => void;
	}

	let { player, onDiscard }: Props = $props();

	// Sort luxury cards by value (ascending)
	const luxuryCards = $derived(
		[...player.getLuxuryCards()].sort((a, b) => a.value - b.value)
	);
</script>

<dialog open>
	<article>
		<header>
			<h3>Faux Pas! Choose a Luxury Card to Discard</h3>
		</header>

		<section>
			<p>
				<strong>{player.name}</strong>, you must discard one of your luxury cards due to the Faux Pas.
			</p>

			<div class="luxury-cards">
				{#each luxuryCards as card}
					<button
						class="luxury-card"
						onclick={() => onDiscard(card.id)}
					>
						<h4>{card.name}</h4>
						<div class="card-value">{card.value}</div>
					</button>
				{/each}
			</div>
		</section>
	</article>
</dialog>

<style>
	dialog {
		display: flex;
		align-items: center;
		justify-content: center;
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.7);
		padding: 1rem;
	}

	article {
		max-width: min(600px, 95vw);
		margin: 0;
		max-height: 90vh;
		overflow-y: auto;
	}

	header h3 {
		font-size: clamp(1.125rem, 3vw, 1.25rem);
	}

	section p {
		font-size: clamp(0.875rem, 2vw, 1rem);
	}

	.luxury-cards {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 1rem 0;
		justify-content: center;
	}

	@media (min-width: 768px) {
		.luxury-cards {
			gap: 1rem;
		}
	}

	.luxury-card {
		width: min(150px, 40vw);
		height: min(200px, 50vw);
		padding: 1rem;
		border: 3px solid var(--pico-primary);
		border-radius: var(--pico-border-radius);
		background: var(--pico-card-background-color);
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-family: inherit;
	}

	@media (min-width: 768px) {
		.luxury-card {
			width: 150px;
			height: 200px;
			padding: 1.5rem;
		}
	}

	.luxury-card:hover {
		transform: scale(1.05);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
		border-color: var(--pico-del-color);
	}

	.luxury-card:active {
		transform: scale(1.02);
	}

	.luxury-card h4 {
		margin: 0 0 0.75rem 0;
		font-size: clamp(0.875rem, 2.5vw, 1.125rem);
		text-align: center;
	}

	@media (min-width: 768px) {
		.luxury-card h4 {
			margin: 0 0 1rem 0;
		}
	}

	.card-value {
		font-size: clamp(1.75rem, 6vw, 2.5rem);
		font-weight: bold;
		color: var(--pico-primary);
	}
</style>
