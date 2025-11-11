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

<article>
	<header>
		<hgroup>
			<h2>Game Over!</h2>
			<p>Final Rankings</p>
		</hgroup>
	</header>

	<section>
		{#if winner && !winner.isCastOut}
			<div class="winner-announcement">
				<h3>🎉 {winner.player.name} Wins! 🎉</h3>
				<p>Final Status: <strong>{winner.finalStatus}</strong></p>
			</div>
		{/if}

		<table role="grid">
			<thead>
				<tr>
					<th>Rank</th>
					<th>Player</th>
					<th>Status</th>
					<th>Money Left</th>
					<th>Result</th>
				</tr>
			</thead>
			<tbody>
				{#each rankings as ranking}
					<tr class={ranking.rank === 1 && !ranking.isCastOut ? 'winner-row' : ''}>
						<td>#{ranking.rank}</td>
						<td>
							<span style="color: {ranking.player.color};">●</span>
							{ranking.player.name}
						</td>
						<td>{ranking.finalStatus}</td>
						<td>{ranking.remainingMoney.toLocaleString()}</td>
						<td>
							{#if ranking.isCastOut}
								<mark style="background-color: var(--pico-del-color);">Cast Out</mark>
							{:else if ranking.rank === 1}
								<mark style="background-color: var(--pico-ins-color);">Winner</mark>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<details>
			<summary>Player Details</summary>
			{#each rankings as ranking}
				<article style="margin: 1rem 0;">
					<header>
						<h4>
							<span style="color: {ranking.player.color};">●</span>
							{ranking.player.name}
						</h4>
					</header>
					<section>
						<p><strong>Final Status:</strong> {ranking.finalStatus}</p>
						<p><strong>Money Left:</strong> {ranking.remainingMoney.toLocaleString()} Francs</p>
						<p><strong>Highest Luxury Card:</strong> {ranking.highestLuxuryCard}</p>
						
						<p><strong>Status Cards:</strong></p>
						<div class="card-list">
							{#each ranking.player.getStatusCards() as card}
								<span class="card-badge">{card.name} ({card.getDisplayValue()})</span>
							{/each}
						</div>
					</section>
				</article>
			{/each}
		</details>
	</section>

	<footer>
		{#if isMultiplayer && isHost && onPlayAgain}
			<button onclick={onPlayAgain} class="primary">🔄 Play Again with Same Players</button>
		{/if}
		<button onclick={onNewGame} class="secondary">New Game</button>
	</footer>
</article>

<style>
	.winner-announcement {
		text-align: center;
		padding: 2rem;
		margin: 1rem 0;
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(0, 255, 0, 0.1) 100%);
		border: 3px solid var(--pico-ins-color);
		border-radius: var(--pico-border-radius);
	}

	.winner-announcement h3 {
		margin: 0 0 0.5rem 0;
		color: var(--pico-ins-color);
	}

	.winner-row {
		background: linear-gradient(90deg, transparent 0%, rgba(0, 255, 0, 0.1) 100%);
		font-weight: bold;
	}

	.card-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.card-badge {
		padding: 0.25rem 0.75rem;
		background: var(--pico-card-sectioning-background-color);
		border-radius: var(--pico-border-radius);
		font-size: 0.875rem;
	}

	button {
		width: 100%;
		margin-top: 1rem;
	}
</style>
