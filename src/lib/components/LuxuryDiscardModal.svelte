<script lang="ts">
	import type { Player } from '$lib/domain/player';

	interface Props {
		player: Player;
		onDiscard: (cardId: string) => void;
		onClose?: () => void;
	}

	let { player, onDiscard, onClose }: Props = $props();

	// Sort luxury cards by value (ascending)
	const luxuryCards = $derived(
		[...player.getLuxuryCards()].sort((a, b) => a.value - b.value)
	);
</script>

<dialog open>
	<article>
		<header class="disgrace">
			<h3>Faux Pas!</h3>
			<p class="subtitle">Choose a luxury card to discard</p>
		</header>

		<section>
			<div class="player-info">
				<span class="player-dot" style="background-color: {player.color};"></span>
				<strong>{player.name}</strong>
			</div>

			<div class="luxury-cards">
				{#each luxuryCards as card}
					<button
						class="luxury-card"
						onclick={() => onDiscard(card.id)}
					>
						<div class="card-name">{card.name}</div>
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
		backdrop-filter: blur(2px);
		padding: 1rem;
	}

	article {
		max-width: min(500px, 95vw);
		margin: 0;
		max-height: 90vh;
		overflow-y: auto;
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			transform: translateY(-30px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	header {
		text-align: center;
		padding: 0.75rem 1rem;
		margin: -1rem -1rem 1rem -1rem;
		border-radius: var(--pico-border-radius) var(--pico-border-radius) 0 0;
	}

	header.disgrace {
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(255, 0, 0, 0.15) 100%);
		border-bottom: 2px solid var(--pico-del-color);
	}

	header h3 {
		margin: 0;
		font-size: clamp(1.1rem, 4vw, 1.3rem);
		color: var(--pico-del-color);
	}

	header .subtitle {
		margin: 0.25rem 0 0 0;
		font-size: clamp(0.8rem, 2.5vw, 0.9rem);
		color: var(--pico-muted-color);
	}

	section {
		padding: 0.5rem 0;
	}

	.player-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: center;
		margin-bottom: 1rem;
		font-size: clamp(0.9rem, 2.5vw, 1rem);
	}

	.player-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.luxury-cards {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: center;
	}

	@media (min-width: 768px) {
		.luxury-cards {
			gap: 1rem;
		}
	}

	.luxury-card {
		width: 100px;
		aspect-ratio: 2.5 / 3.5;
		padding: 0.5rem;
		border: 3px solid var(--pico-primary);
		border-radius: var(--pico-border-radius);
		background: var(--pico-card-background-color);
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		font-family: inherit;
		position: relative;
		overflow: hidden;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.luxury-card::before {
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
		0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
		100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
	}

	@media (min-width: 768px) {
		.luxury-card {
			width: 120px;
			padding: 0.75rem;
		}
	}

	.luxury-card:hover {
		transform: translateY(-6px) scale(1.03);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
		border-color: var(--pico-del-color);
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(255, 0, 0, 0.08) 100%);
	}

	.luxury-card:active {
		transform: translateY(-2px) scale(1.01);
	}

	.card-name {
		font-size: clamp(0.7rem, 2.5vw, 0.85rem);
		font-weight: 600;
		text-align: center;
		line-height: 1.2;
		position: relative;
		z-index: 1;
	}

	.card-value {
		font-size: clamp(1.5rem, 6vw, 2rem);
		font-weight: bold;
		color: var(--pico-primary);
		position: relative;
		z-index: 1;
	}

	.luxury-card:hover .card-value {
		color: var(--pico-del-color);
	}

	@media (prefers-reduced-motion: reduce) {
		.luxury-card::before {
			animation: none;
		}
		article {
			animation: none;
		}
		.luxury-card:hover {
			transform: none;
		}
	}
</style>
