<script lang="ts">
	import type { Player } from '$lib/domain/player';
	import type { GameScoringService } from '$lib/domain/scoring';

	interface Props {
		players: Player[];
		scoringService: GameScoringService;
		onNewGame: () => void;
		isHost?: boolean;
		onPlayAgain?: () => void;
		isMultiplayer?: boolean;
	}

	let { players, scoringService, onNewGame, isHost = false, onPlayAgain, isMultiplayer = false }: Props = $props();

	const rankings = $derived(scoringService.calculateFinalRankings(players));
	const winner = $derived(rankings[0]);
</script>

<dialog open class="score-dialog">
	<article>
		<header class="score-header">
			<h2>Game Over!</h2>
		</header>

		<section class="score-content">
			{#if winner && !winner.isCastOut}
				<div class="winner-announcement">
					<span class="winner-emoji">🎉</span>
					<div class="winner-info">
						<span class="winner-name" style="color: {winner.player.color};">{winner.player.name}</span>
						<span class="winner-score">Status: {winner.finalStatus}</span>
					</div>
					<span class="winner-emoji">🎉</span>
				</div>
			{/if}

			<div class="rankings-list">
				{#each rankings as ranking}
					<div class="ranking-row {ranking.rank === 1 && !ranking.isCastOut ? 'winner' : ''} {ranking.isCastOut ? 'cast-out' : ''}">
						<span class="rank">#{ranking.rank}</span>
						<span class="player-dot" style="background-color: {ranking.player.color};"></span>
						<span class="player-name">{ranking.player.name}</span>
						<span class="player-score">{ranking.finalStatus}</span>
						{#if ranking.isCastOut}
							<span class="result-badge cast-out">Cast Out</span>
						{:else if ranking.rank === 1}
							<span class="result-badge winner">Winner</span>
						{/if}
					</div>
				{/each}
			</div>

			<details class="player-details">
				<summary>Details</summary>
				{#each rankings as ranking}
					<div class="detail-card">
						<div class="detail-header">
							<span class="player-dot" style="background-color: {ranking.player.color};"></span>
							<span class="detail-name">{ranking.player.name}</span>
						</div>
						<div class="detail-stats">
							<span>Status: <strong>{ranking.finalStatus}</strong></span>
							<span>Money: <strong>{ranking.remainingMoney.toLocaleString()}F</strong></span>
						</div>
						{#if ranking.player.getStatusCards().length > 0}
							<div class="card-list">
								{#each ranking.player.getStatusCards() as card}
									<span class="card-badge">{card.name} ({card.getDisplayValue()})</span>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</details>
		</section>

		<footer class="score-footer">
			{#if isMultiplayer && isHost && onPlayAgain}
				<button onclick={onPlayAgain} class="primary btn-small">🔄 Play Again</button>
			{/if}
			<button onclick={onNewGame} class="secondary btn-small">New Game</button>
		</footer>
	</article>
</dialog>

<style>
	.score-dialog {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(2px);
		z-index: 1000;
		padding: 0.5rem;
	}

	.score-dialog article {
		max-width: min(380px, 95vw);
		width: 100%;
		margin: 0;
		animation: slideIn 0.3s ease-out;
		max-height: 85vh;
		overflow-y: auto;
	}

	@keyframes slideIn {
		from { transform: translateY(-30px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}

	.score-header {
		text-align: center;
		padding: 0.5rem 0.75rem;
		margin: -1rem -1rem 0.5rem -1rem;
		border-radius: var(--pico-border-radius) var(--pico-border-radius) 0 0;
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(0, 255, 0, 0.15) 100%);
		border-bottom: 2px solid var(--pico-ins-color);
	}

	.score-header h2 {
		margin: 0;
		font-size: clamp(1rem, 4vw, 1.2rem);
		color: var(--pico-ins-color);
	}

	.score-content {
		padding: 0.25rem 0;
	}

	.winner-announcement {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem;
		margin-bottom: 0.5rem;
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(0, 255, 0, 0.1) 100%);
		border: 2px solid var(--pico-ins-color);
		border-radius: var(--pico-border-radius);
	}

	.winner-emoji {
		font-size: 1.25rem;
	}

	.winner-info {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.winner-name {
		font-weight: 700;
		font-size: clamp(0.9rem, 3vw, 1.1rem);
	}

	.winner-score {
		font-size: 0.75rem;
		color: var(--pico-muted-color);
	}

	.rankings-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.ranking-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.5rem;
		background: var(--pico-card-sectioning-background-color);
		border-radius: var(--pico-border-radius);
		font-size: 0.8rem;
	}

	.ranking-row.winner {
		background: linear-gradient(90deg, transparent 0%, rgba(0, 255, 0, 0.1) 100%);
		border-left: 3px solid var(--pico-ins-color);
	}

	.ranking-row.cast-out {
		opacity: 0.7;
		border-left: 3px solid var(--pico-del-color);
	}

	.rank {
		font-weight: 600;
		min-width: 1.5rem;
		color: var(--pico-muted-color);
	}

	.player-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.player-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.player-score {
		font-weight: 700;
		color: var(--pico-primary);
	}

	.result-badge {
		font-size: 0.65rem;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-weight: 600;
	}

	.result-badge.winner {
		background-color: var(--pico-ins-color);
		color: var(--pico-background-color);
	}

	.result-badge.cast-out {
		background-color: var(--pico-del-color);
		color: white;
	}

	.player-details {
		margin-top: 0.5rem;
		font-size: 0.75rem;
	}

	.player-details summary {
		cursor: pointer;
		padding: 0.25rem 0;
		color: var(--pico-muted-color);
	}

	.detail-card {
		margin: 0.35rem 0;
		padding: 0.35rem;
		background: var(--pico-card-sectioning-background-color);
		border-radius: var(--pico-border-radius);
	}

	.detail-header {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-bottom: 0.2rem;
	}

	.detail-name {
		font-weight: 600;
	}

	.detail-stats {
		display: flex;
		gap: 0.75rem;
		font-size: 0.7rem;
		color: var(--pico-muted-color);
	}

	.card-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem;
		margin-top: 0.25rem;
	}

	.card-badge {
		padding: 0.1rem 0.35rem;
		background: var(--pico-card-background-color);
		border-radius: 3px;
		font-size: 0.65rem;
		border: 1px solid var(--pico-muted-border-color);
	}

	.score-footer {
		display: flex;
		gap: 0.5rem;
		padding-top: 0.5rem;
		margin-top: 0.25rem;
		border-top: 1px solid var(--pico-muted-border-color);
	}

	.btn-small {
		flex: 1;
		padding: 0.4rem 0.5rem;
		font-size: 0.75rem;
		margin: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.score-dialog article {
			animation: none;
		}
	}
</style>
