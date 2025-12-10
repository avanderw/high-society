<script lang="ts">
	import type { GameState } from '$lib/domain/gameState';
	import { GamePhase } from '$lib/domain/gameState';
	import { vibrate, HapticPattern } from '$lib/utils/haptics';

	interface Props {
		gameState: GameState;
		updateKey?: number;
		onBid?: () => void;
		onPass?: () => void;
		isMyTurn?: boolean;
		isMultiplayer?: boolean;
		selectedCards?: string[];
		currentBid?: number;
		newTotalBid?: number;
		canBid?: boolean;
		currentPlayerName?: string;
		currentPlayerHasPendingDiscard?: boolean;
		hasPassed?: boolean;
	}

	let { gameState, updateKey = 0, onBid, onPass, isMyTurn = true, isMultiplayer = false, selectedCards = [], currentBid = 0, newTotalBid = 0, canBid = true, currentPlayerName = '', currentPlayerHasPendingDiscard = false, hasPassed = false }: Props = $props();

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
	{#if currentCard}
		<div class="card-and-tracker-row">
			<div class="main-card-area">
				<div class="status-card {phase === GamePhase.DISGRACE_AUCTION ? 'disgrace' : 'luxury'}">
					<h2>{currentCard.name}</h2>
					<div class="card-value">
						{currentCard.getDisplayValue()}
					</div>
					{#if phase === GamePhase.DISGRACE_AUCTION}
						<div class="card-instruction disgrace-instruction"><mark>Bid to avoid</mark></div>
					{:else}
						<div class="card-instruction">Bid to win</div>
					{/if}
				</div>
			</div>
			<div class="progress-bar-section compact horizontal">
				<span class="progress-bar-label">End Game Tracker</span>
				<span class="progress-bar-4">
					{#each Array(4) as _, i}
						<span class="progress-bar-segment {i < publicState.gameEndTriggerCount ? 'filled' : ''}"></span>
					{/each}
				</span>
				<span class="progress-bar-cards">{publicState.remainingStatusCards} cards left</span>
				
				{#if onBid && onPass}
					{#if isMultiplayer && !isMyTurn}
						<div class="not-your-turn">
							{#if currentPlayerHasPendingDiscard}
								<p>⏳ Waiting for <strong>{currentPlayerName}</strong> to discard...</p>
							{:else if hasPassed}
								<p>✓ You passed. Waiting...</p>
							{:else}
								<p>⏳ Waiting for {currentPlayerName}...</p>
							{/if}
						</div>
					{:else}
						<div class="action-buttons">
							<button 
								onclick={() => { vibrate(HapticPattern.LIGHT); onPass(); }}
								class="secondary"
							>
								Pass
							</button>
							<button 
								onclick={() => { vibrate(HapticPattern.SUCCESS); onBid(); }} 
								disabled={!canBid || (selectedCards?.length ?? 0) === 0}
								class="primary"
							>
								Place Bid ({newTotalBid.toLocaleString()})
							</button>
						</div>
						{#if !canBid && (selectedCards?.length ?? 0) > 0}
							<div class="warning-text">
								⚠️ New total ({newTotalBid.toLocaleString()}) must be higher than {currentBid.toLocaleString()}
							</div>
						{/if}
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</article>

<style>
	article {
		margin-bottom: 0;
	}

	.card-and-tracker-row {
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		gap: 0.5rem;
		width: 100%;
	}

	.main-card-area {
		flex: 0 0 50%;
		min-width: 0;
	}

	.progress-bar-section {
		flex: 0 0 50%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 0.5rem;
		min-width: 0;
		max-width: 50%;
		word-wrap: break-word;
		overflow-wrap: break-word;
		box-sizing: border-box;
	}

	.action-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
	}

	.action-buttons button {
		width: 100%;
		max-width: 100%;
		padding: 0.75rem 0.5rem;
		font-size: 0.85rem;
		margin: 0;
		box-sizing: border-box;
		white-space: normal;
		word-wrap: break-word;
	}

	.not-your-turn {
		margin-top: 0.5rem;
		padding: 0.5rem;
		background: var(--pico-card-background-color);
		border-radius: var(--pico-border-radius);
		text-align: center;
		font-size: 0.85rem;
		opacity: 0.8;
		word-wrap: break-word;
		overflow-wrap: break-word;
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
	}

	.not-your-turn p {
		margin: 0;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.warning-text {
		margin-top: 0.25rem;
		padding: 0.4rem;
		background: rgba(var(--pico-del-color), 0.1);
		border-radius: var(--pico-border-radius);
		font-size: 0.75rem;
		color: var(--pico-del-color);
		text-align: center;
		word-wrap: break-word;
		overflow-wrap: break-word;
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
	}

	@media (min-width: 768px) {
		footer {
			padding-top: 0.5rem;
			padding-bottom: 0.5rem;
		}
	}

	.card-instruction {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		font-weight: 600;
		opacity: 0.8;
		letter-spacing: 0.5px;
	}

	@media (min-width: 768px) {
		.card-instruction {
			font-size: 0.85rem;
			margin-top: 0.75rem;
		}
	}

	.card-instruction mark {
		padding: 0.2rem 0.4rem;
		font-size: inherit;
	}

	.card-display {
		display: flex;
		justify-content: center;
		padding: 0.15rem 0;
	}

	@media (min-width: 768px) {
		.card-display {
			padding: 0.75rem 0;
		}
	}

		.status-card {
			width: min(150px, 75vw);
			aspect-ratio: 2.5/3.5;
			padding: 0.5rem;
			border: 3px solid var(--pico-primary);
			border-radius: var(--pico-border-radius);
			text-align: center;
			background: var(--pico-card-background-color);
			box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
			animation: cardReveal 0.4s ease-out;
			position: relative;
			overflow: hidden;
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
		}

	@media (min-width: 768px) {
		.status-card {
			width: 200px;
			aspect-ratio: 2.5/3.5;
			padding: 1.5rem;
			box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
		}
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
		margin: 0 0 0.35rem 0;
		font-size: clamp(0.9rem, 4vw, 1.5rem);
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
		font-size: clamp(1.5rem, 8vw, 3rem);
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

.progress-bar-section.compact.horizontal {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	gap: 0.5rem;
	margin: 0.1rem 0 0.1rem 0;
}
.progress-bar-label {
	font-size: 0.8rem;
	color: var(--pico-muted-color);
	font-weight: 600;
	margin-bottom: 0;
	text-align: center;
	letter-spacing: 0.5px;
}
.progress-bar-4 {
	display: flex;
	gap: 0.18rem;
	margin-bottom: 0;
}
.progress-bar-segment {
	width: 18px;
	height: 6px;
	border-radius: 3px;
	background: var(--pico-muted-border-color);
	transition: background 0.3s;
	border: 1px solid var(--pico-primary);
}
.progress-bar-segment.filled {
	background: linear-gradient(90deg, var(--pico-primary) 60%, var(--pico-ins-color) 100%);
	border-color: var(--pico-ins-color);
}
.progress-bar-cards {
	font-size: 0.75rem;
	color: var(--pico-muted-color);
	margin-top: 0;
	margin-left: 0.25rem;
	font-weight: 500;
}
</style>
