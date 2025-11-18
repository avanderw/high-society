<script lang="ts">
	import { 
		loadStats, 
		getWinRate, 
		getAverageScore, 
		getAverageMoneySpent, 
		getMostWonLuxuryCard,
		resetStats,
		type GameStats
	} from '$lib/utils/statistics';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let stats = $state<GameStats>(loadStats());
	let showResetConfirm = $state(false);

	const winRate = $derived(getWinRate(stats));
	const avgScore = $derived(getAverageScore(stats));
	const avgMoneySpent = $derived(getAverageMoneySpent(stats));
	const favCard = $derived(getMostWonLuxuryCard(stats));

	function handleReset() {
		resetStats();
		stats = loadStats();
		showResetConfirm = false;
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}
</script>

<div class="modal-backdrop" onclick={handleBackdropClick} role="presentation">
	<dialog open>
		<article>
			<header>
				<h3>📊 Your Statistics</h3>
			</header>
			<section>
				{#if stats.gamesPlayed === 0}
					<p class="no-stats">No games played yet. Start playing to track your statistics!</p>
				{:else}
					<div class="stats-grid">
						<div class="stat-card">
							<div class="stat-value">{stats.gamesPlayed}</div>
							<div class="stat-label">Games Played</div>
						</div>

						<div class="stat-card highlight">
							<div class="stat-value">{stats.gamesWon}</div>
							<div class="stat-label">Games Won</div>
						</div>

						<div class="stat-card">
							<div class="stat-value">{winRate.toFixed(1)}%</div>
							<div class="stat-label">Win Rate</div>
						</div>

						<div class="stat-card">
							<div class="stat-value">{stats.highestScore}</div>
							<div class="stat-label">Highest Score</div>
						</div>

						<div class="stat-card">
							<div class="stat-value">{avgScore.toFixed(1)}</div>
							<div class="stat-label">Avg Score</div>
						</div>

						<div class="stat-card">
							<div class="stat-value">{avgMoneySpent.toFixed(0)}</div>
							<div class="stat-label">Avg Money Spent</div>
						</div>

						<div class="stat-card">
							<div class="stat-value">{stats.averageFinalMoney.toFixed(0)}</div>
							<div class="stat-label">Avg Final Money</div>
						</div>

						<div class="stat-card">
							<div class="stat-value">{stats.timesCastOut}</div>
							<div class="stat-label">Times Cast Out</div>
						</div>

						<div class="stat-card">
							<div class="stat-value">{stats.prestigeCardsWon}</div>
							<div class="stat-label">Prestige Cards</div>
						</div>

						<div class="stat-card warning">
							<div class="stat-value">{stats.disgraceCardsReceived}</div>
							<div class="stat-label">Disgrace Cards</div>
						</div>
					</div>

					{#if favCard}
						<div class="favorite-card">
							<strong>Most Won Card:</strong>
							<span class="card-name">{favCard.name}</span>
							<span class="card-count">({favCard.count}x)</span>
						</div>
					{/if}

					<details>
						<summary>All Luxury Cards Won</summary>
						<div class="luxury-list">
							{#each Object.entries(stats.luxuryCardsWon).sort((a, b) => b[1] - a[1]) as [cardName, count]}
								<div class="luxury-item">
									<span>{cardName}</span>
									<span class="count">×{count}</span>
								</div>
							{/each}
						</div>
					</details>

					<details>
						<summary>Reset Statistics</summary>
						<div style="padding: 1rem 0;">
							{#if !showResetConfirm}
								<button onclick={() => showResetConfirm = true} class="secondary">
									Reset All Stats
								</button>
							{:else}
								<p style="margin-bottom: 1rem;">
									<mark>Are you sure? This cannot be undone.</mark>
								</p>
								<div class="grid">
									<button onclick={() => showResetConfirm = false} class="secondary">
										Cancel
									</button>
									<button onclick={handleReset} class="contrast">
										Yes, Reset
									</button>
								</div>
							{/if}
						</div>
					</details>
				{/if}
			</section>
			<footer>
				<button onclick={onClose} class="primary">Close</button>
			</footer>
		</article>
	</dialog>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9998;
		padding: 1rem;
		overflow-y: auto;
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	dialog {
		margin: auto;
		padding: 0;
		border: none;
		background: transparent;
		max-width: min(600px, calc(100vw - 2rem));
		width: 100%;
		animation: scaleIn 0.2s ease-out;
	}

	@keyframes scaleIn {
		from {
			transform: scale(0.9);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	article {
		margin: 0;
		max-height: 85vh;
		overflow-y: auto;
	}

	header h3 {
		margin: 0;
		font-size: clamp(1.1rem, 3vw, 1.25rem);
	}

	.no-stats {
		text-align: center;
		color: var(--pico-muted-color);
		padding: 2rem;
		margin: 0;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.stat-card {
		background: var(--pico-card-sectioning-background-color);
		border-radius: var(--pico-border-radius);
		padding: 1rem;
		text-align: center;
		border: 2px solid transparent;
		transition: transform 0.2s, border-color 0.2s;
	}

	.stat-card:hover {
		transform: translateY(-2px);
		border-color: var(--pico-primary);
	}

	.stat-card.highlight {
		border-color: var(--pico-ins-color);
		background: linear-gradient(135deg, var(--pico-card-sectioning-background-color) 0%, rgba(0, 255, 0, 0.05) 100%);
	}

	.stat-card.warning {
		border-color: var(--pico-del-color);
		background: linear-gradient(135deg, var(--pico-card-sectioning-background-color) 0%, rgba(255, 0, 0, 0.05) 100%);
	}

	.stat-value {
		font-size: clamp(1.5rem, 4vw, 2rem);
		font-weight: bold;
		color: var(--pico-primary);
		margin-bottom: 0.25rem;
	}

	.stat-card.highlight .stat-value {
		color: var(--pico-ins-color);
	}

	.stat-card.warning .stat-value {
		color: var(--pico-del-color);
	}

	.stat-label {
		font-size: clamp(0.75rem, 1.8vw, 0.875rem);
		color: var(--pico-muted-color);
	}

	.favorite-card {
		text-align: center;
		padding: 1rem;
		background: var(--pico-card-sectioning-background-color);
		border-radius: var(--pico-border-radius);
		margin-bottom: 1rem;
		font-size: clamp(0.875rem, 2vw, 1rem);
	}

	.card-name {
		color: var(--pico-primary);
		font-weight: bold;
		margin: 0 0.5rem;
	}

	.card-count {
		color: var(--pico-muted-color);
	}

	.luxury-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem 0;
	}

	.luxury-item {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem;
		background: var(--pico-card-sectioning-background-color);
		border-radius: var(--pico-border-radius);
		font-size: clamp(0.875rem, 2vw, 1rem);
	}

	.count {
		color: var(--pico-muted-color);
		font-weight: bold;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin: 0;
	}

	button {
		margin: 0;
		font-size: clamp(0.875rem, 2vw, 1rem);
	}

	@media (prefers-reduced-motion: reduce) {
		.modal-backdrop,
		dialog,
		.stat-card {
			animation: none;
		}
		.stat-card:hover {
			transform: none;
		}
	}
</style>
