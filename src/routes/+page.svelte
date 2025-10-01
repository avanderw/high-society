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
	let updateCounter = $state(0); // Force update counter
	
	// Derived state to force reactivity
	const currentPhase = $derived(gameState?.getCurrentPhase());
	const currentAuction = $derived(gameState?.getCurrentAuction());
	const currentPlayerIndex = $derived(updateCounter >= 0 ? gameState?.getCurrentPlayerIndex() : -1);
	const currentPlayerObj = $derived(updateCounter >= 0 ? gameState?.getCurrentPlayer() : undefined);
	const allPlayers = $derived(updateCounter >= 0 ? gameState?.getPlayers() ?? [] : []);

	function startGame(playerNames: string[]) {
		try {
			const game = new GameState('game-' + Date.now());
			game.initializeGame(playerNames);
			game.startNewRound();
			gameState = game;
			selectedMoneyCards = [];
			errorMessage = '';
			updateCounter = 0;
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

		console.log('=== PLACE BID ===');
		console.log('Current player before bid:', currentPlayer.name);
		console.log('Current player index:', gameState.getCurrentPlayerIndex());
		console.log('Selected cards:', selectedMoneyCards);
		console.log('Current highest bid:', auction.getCurrentHighestBid());

		try {
			const moneyCards = selectedMoneyCards
				.map(id => currentPlayer.getMoneyHand().find(c => c.id === id))
				.filter((c): c is MoneyCard => c !== undefined);

			if (moneyCards.length === 0) {
				errorMessage = 'Please select at least one money card';
				return;
			}

			console.log('Money cards to play:', moneyCards.map(c => c.value));
			console.log('Player current bid before:', currentPlayer.getCurrentBidAmount());

			const result = auction.processBid(currentPlayer, moneyCards);
			
			console.log('Player current bid after:', currentPlayer.getCurrentBidAmount());
			console.log('Auction highest bid after:', auction.getCurrentHighestBid());
			console.log('Bid result:', result);

			selectedMoneyCards = [];
			errorMessage = '';

			if (result === AuctionResult.COMPLETE) {
				completeAuction();
			} else {
				console.log('Moving to next player...');
				gameState.nextPlayer();
				console.log('New current player:', gameState.getCurrentPlayer().name);
				console.log('New current player index:', gameState.getCurrentPlayerIndex());
				// Force reactivity update
				updateCounter++;
			}
		} catch (error) {
			console.error('Bid error:', error);
			errorMessage = error instanceof Error ? error.message : 'Invalid bid';
			// Clear selection since bid failed
			selectedMoneyCards = [];
			// Force reactivity update
			updateCounter++;
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
				// Force reactivity update
				updateCounter++;
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Cannot pass';
			// Force reactivity update
			updateCounter++;
		}
	}

	function completeAuction() {
		if (!gameState) return;

		gameState.completeAuction();

		// Check if winner needs to discard luxury card
		const winner = gameState.getPlayers().find(p => p.getPendingLuxuryDiscard());
		if (winner && winner.getLuxuryCards().length > 0) {
			showLuxuryDiscard = true;
			// Force reactivity update
			updateCounter++;
		} else {
			// Start next round
			if (gameState.getCurrentPhase() !== GamePhase.SCORING) {
				gameState.startNewRound();
			}
			// Force reactivity update
			updateCounter++;
		}
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

		// Force reactivity update
		updateCounter++;
	}

	function newGame() {
		gameState = null;
		selectedMoneyCards = [];
		errorMessage = '';
		showLuxuryDiscard = false;
		updateCounter = 0;
	}

	$effect(() => {
		if (gameState && gameState.getCurrentPhase() === GamePhase.SCORING) {
			// Game has ended, scoring will be displayed
		}
	});

	// Clear selected cards when current player changes
	$effect(() => {
		if (currentPlayerObj) {
			// Clear any selected cards when player changes
			selectedMoneyCards = [];
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
	{:else if currentPhase === GamePhase.SCORING || currentPhase === GamePhase.FINISHED}
		<ScoreBoard 
			players={allPlayers} 
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
				{#if currentPlayerObj && currentPlayerIndex !== undefined}
					<AuctionPanel 
						auction={currentAuction ?? null}
						currentPlayer={currentPlayerObj}
						currentPlayerIndex={currentPlayerIndex}
						allPlayers={allPlayers}
						onBid={placeBid}
						onPass={pass}
						selectedTotal={selectedMoneyCards.reduce((sum, id) => {
							const card = currentPlayerObj?.getMoneyHand().find(c => c.id === id);
							return sum + (card?.value || 0);
						}, 0)}
					/>
				{/if}

				<StatusDisplay players={allPlayers} />
			</div>

			{#if currentPlayerObj}
				<PlayerHand 
					player={currentPlayerObj}
					selectedCards={selectedMoneyCards}
					onToggleCard={toggleMoneyCard}
				/>
			{/if}

			{#if showLuxuryDiscard}
				{#each allPlayers as player}
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
