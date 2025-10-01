<script lang="ts">
	import { GameState, GamePhase } from '$lib/domain/gameState';
	import { GameScoringService } from '$lib/domain/scoring';
	import { AuctionResult } from '$lib/domain/auction';
	import type { MoneyCard } from '$lib/domain/cards';
	
	import GameSetup from '$lib/components/GameSetup.svelte';
	import GameBoard from '$lib/components/GameBoard.svelte';
	import AuctionPanel from '$lib/components/AuctionPanel.svelte';
	import PlayerHand from '$lib/components/PlayerHand.svelte';
	import StatusDisplay from '$lib/components/StatusDisplay.svelte';
	import ScoreBoard from '$lib/components/ScoreBoard.svelte';
	import LuxuryDiscardModal from '$lib/components/LuxuryDiscardModal.svelte';

	let gameState = $state<GameState | null>(null);
	let selectedMoneyCards = $state<string[]>([]);
	let errorMessage = $state<string>('');
	let showLuxuryDiscard = $state(false);

	function startGame(playerNames: string[]) {
		try {
			const game = new GameState('game-' + Date.now());
			game.initializeGame(playerNames);
			game.startNewRound();
			gameState = game;
			selectedMoneyCards = [];
			errorMessage = '';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to start game';
		}
	}

	function toggleMoneyCard(cardId: string) {
		if (selectedMoneyCards.includes(cardId)) {
			selectedMoneyCards = selectedMoneyCards.filter(id => id !== cardId);
		} else {
			selectedMoneyCards = [...selectedMoneyCards, cardId];
		}
	}

	function placeBid() {
		if (!gameState) return;

		const auction = gameState.getCurrentAuction();
		const currentPlayer = gameState.getCurrentPlayer();
		
		if (!auction || !currentPlayer) return;

		try {
			const moneyCards = selectedMoneyCards
				.map(id => currentPlayer.getMoneyHand().find(c => c.id === id))
				.filter((c): c is MoneyCard => c !== undefined);

			const result = auction.processBid(currentPlayer, moneyCards);
			selectedMoneyCards = [];
			errorMessage = '';

			if (result === AuctionResult.COMPLETE) {
				completeAuction();
			} else {
				gameState.nextPlayer();
			}

			gameState = gameState;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Invalid bid';
			// Return cards if bid failed
			const currentPlayer = gameState.getCurrentPlayer();
			currentPlayer.returnPlayedMoney();
			gameState = gameState;
		}
	}

	function pass() {
		if (!gameState) return;

		const auction = gameState.getCurrentAuction();
		const currentPlayer = gameState.getCurrentPlayer();
		
		if (!auction || !currentPlayer) return;

		try {
			const result = auction.processPass(currentPlayer);
			selectedMoneyCards = [];
			errorMessage = '';

			if (result === AuctionResult.COMPLETE) {
				completeAuction();
			} else {
				// Find next active player
				let nextIndex = (gameState.getCurrentPlayerIndex() + 1) % gameState.getPlayers().length;
				while (!auction.getActivePlayers().has(gameState.getPlayers()[nextIndex].id)) {
					nextIndex = (nextIndex + 1) % gameState.getPlayers().length;
				}
				gameState.setCurrentPlayerIndex(nextIndex);
			}

			gameState = gameState;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Cannot pass';
		}
	}

	function completeAuction() {
		if (!gameState) return;

		gameState.completeAuction();

		// Check if winner needs to discard luxury card
		const winner = gameState.getPlayers().find(p => p.getPendingLuxuryDiscard());
		if (winner && winner.getLuxuryCards().length > 0) {
			showLuxuryDiscard = true;
		} else {
			// Start next round
			if (gameState.getCurrentPhase() !== GamePhase.SCORING) {
				gameState.startNewRound();
			}
		}

		gameState = gameState;
	}

	function handleLuxuryDiscard(cardId: string) {
		if (!gameState) return;

		const playerWithPending = gameState.getPlayers().find(p => p.getPendingLuxuryDiscard());
		if (playerWithPending) {
			gameState.handleLuxuryDiscard(playerWithPending.id, cardId);
		}

		showLuxuryDiscard = false;

		// Start next round
		if (gameState.getCurrentPhase() !== GamePhase.SCORING) {
			gameState.startNewRound();
		}

		gameState = gameState;
	}

	function newGame() {
		gameState = null;
		selectedMoneyCards = [];
		errorMessage = '';
		showLuxuryDiscard = false;
	}

	$effect(() => {
		if (gameState && gameState.getCurrentPhase() === GamePhase.SCORING) {
			// Game has ended, scoring will be displayed
		}
	});
</script>

<main class="container">
	<header>
		<h1>High Society</h1>
		<p>A game of luxury, prestige, and careful money management</p>
	</header>

	{#if !gameState}
		<GameSetup onStart={startGame} />
	{:else if gameState.getCurrentPhase() === GamePhase.SCORING || gameState.getCurrentPhase() === GamePhase.FINISHED}
		<ScoreBoard 
			players={gameState.getPlayers()} 
			scoringService={new GameScoringService()}
			onNewGame={newGame}
		/>
	{:else}
		<div class="game-container">
			{#if errorMessage}
				<article style="background-color: var(--pico-del-color); margin-bottom: 1rem;">
					<p><strong>Error:</strong> {errorMessage}</p>
				</article>
			{/if}

			<GameBoard gameState={gameState} />

			<div class="grid">
				<AuctionPanel 
					auction={gameState.getCurrentAuction()}
					currentPlayer={gameState.getCurrentPlayer()}
					currentPlayerIndex={gameState.getCurrentPlayerIndex()}
					allPlayers={gameState.getPlayers()}
					onBid={placeBid}
					onPass={pass}
					selectedTotal={selectedMoneyCards.reduce((sum, id) => {
						const card = gameState?.getCurrentPlayer().getMoneyHand().find(c => c.id === id);
						return sum + (card?.value || 0);
					}, 0)}
				/>

				<StatusDisplay players={gameState.getPlayers()} />
			</div>

			<PlayerHand 
				player={gameState.getCurrentPlayer()}
				selectedCards={selectedMoneyCards}
				onToggleCard={toggleMoneyCard}
			/>

			{#if showLuxuryDiscard}
				{#each gameState.getPlayers() as player}
					{#if player.getPendingLuxuryDiscard() && player.getLuxuryCards().length > 0}
						<LuxuryDiscardModal 
							player={player}
							onDiscard={handleLuxuryDiscard}
						/>
					{/if}
				{/each}
			{/if}
		</div>
	{/if}
</main>

<style>
	main {
		padding: 2rem 1rem;
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}

	header h1 {
		margin-bottom: 0.5rem;
		color: var(--pico-primary);
	}

	header p {
		color: var(--pico-muted-color);
	}

	.game-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
</style>
