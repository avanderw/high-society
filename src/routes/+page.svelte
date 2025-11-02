<script lang="ts">
	import { GameState, GamePhase } from '$lib/domain/gameState';
	import { GameScoringService } from '$lib/domain/scoring';
	import { AuctionResult } from '$lib/domain/auction';
	import type { MoneyCard } from '$lib/domain/cards';
	
	import GameSetup from '$lib/components/GameSetup.svelte';
	import MultiplayerSetup from '$lib/components/MultiplayerSetup.svelte';
	import GameBoard from '$lib/components/GameBoard.svelte';
	import AuctionPanel from '$lib/components/AuctionPanel.svelte';
	import PlayerHand from '$lib/components/PlayerHand.svelte';
	import StatusDisplay from '$lib/components/StatusDisplay.svelte';
	import ScoreBoard from '$lib/components/ScoreBoard.svelte';
	import LuxuryDiscardModal from '$lib/components/LuxuryDiscardModal.svelte';
	import UpdatePrompt from '$lib/components/UpdatePrompt.svelte';
	
	import { getMultiplayerService } from '$lib/multiplayer/service';
	import { GameEventType, type GameEvent } from '$lib/multiplayer/events';
	import { serializeGameState, deserializeGameState } from '$lib/multiplayer/serialization';

	// Game mode
	let gameMode = $state<'menu' | 'local' | 'multiplayer'>('menu');
	
	// Multiplayer state
	let isMultiplayer = $state(false);
	let roomId = $state('');
	let myPlayerId = $state('');
	let myPlayerName = $state('');
	let isHost = $state(false);
	let roomReady = $state(false);
	let lobbyPlayers = $state<Array<{ playerId: string; playerName: string }>>([]);
	let multiplayerService = getMultiplayerService();

	let gameState = $state<GameState | null>(null);
	let selectedMoneyCards = $state<string[]>([]);
	let errorMessage = $state<string>('');
	let showLuxuryDiscard = $state(false);
	let updateCounter = $state(0); // Force update counter
	
	// Derived state to force reactivity - all depend on updateCounter
	const currentPhase = $derived(updateCounter >= 0 ? gameState?.getCurrentPhase() : undefined);
	const currentAuction = $derived(updateCounter >= 0 ? gameState?.getCurrentAuction() : null);
	const currentPlayerIndex = $derived(updateCounter >= 0 ? gameState?.getCurrentPlayerIndex() : -1);
	const currentPlayerObj = $derived(updateCounter >= 0 ? gameState?.getCurrentPlayer() : undefined);
	const allPlayers = $derived(updateCounter >= 0 ? gameState?.getPlayers() ?? [] : []);

	function startGame(playerNames: string[]) {
		try {
			const game = new GameState('game-' + Date.now());
			game.initializeGame(playerNames);
			game.startNewRound();
			console.log('=== GAME STARTED ===');
			console.log('Starting player index:', game.getCurrentPlayerIndex());
			console.log('Starting player:', game.getCurrentPlayer().name);
			console.log('All players:', game.getPlayers().map(p => `${p.name} (${p.id})`));
			const auction = game.getCurrentAuction();
			if (auction) {
				console.log('Active players in auction:', Array.from(auction.getActivePlayers()));
			}
			gameState = game;
			selectedMoneyCards = [];
			errorMessage = '';
			updateCounter = 0;
			
			// If multiplayer and host, broadcast game start
			if (isMultiplayer && isHost) {
				const eventData = {
					players: playerNames.map((name, i) => ({ 
						id: game.getPlayers()[i].id, 
						name 
					})),
					initialState: serializeGameState(game)
				};
				console.log('=== BROADCASTING GAME_STARTED ===');
				console.log('Event data:', eventData);
				console.log('Room ID:', roomId);
				multiplayerService.broadcastEvent(GameEventType.GAME_STARTED, eventData);
				console.log('Broadcast complete');
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to start game';
		}
	}
	
	function handleMultiplayerRoomReady(
		roomIdParam: string, 
		playerIdParam: string, 
		playerNameParam: string,
		isHostParam: boolean,
		players: Array<{ playerId: string; playerName: string }>
	) {
		roomId = roomIdParam;
		myPlayerId = playerIdParam;
		myPlayerName = playerNameParam;
		isHost = isHostParam;
		isMultiplayer = true;
		roomReady = true;
		lobbyPlayers = players;
		gameMode = 'multiplayer';
		
		// Setup event listeners
		setupMultiplayerListeners();
		
		console.log('=== MULTIPLAYER ROOM READY ===');
		console.log('Room ID:', roomId);
		console.log('My Player ID:', myPlayerId);
		console.log('Is Host:', isHost);
		console.log('Connected Players:', players);
		
		// If host, automatically start the game with connected players
		if (isHostParam) {
			const playerNames = players.map(p => p.playerName);
			console.log('Host starting game with players:', playerNames);
			startGame(playerNames);
		}
	}
	
	function setupMultiplayerListeners() {
		console.log('=== SETTING UP MULTIPLAYER LISTENERS ===');
		console.log('Setting up listener for:', GameEventType.GAME_STARTED);
		console.log('Current isHost:', isHost);
		console.log('Current myPlayerId:', myPlayerId);
		console.log('Multiplayer service connected:', multiplayerService.isConnected());
		
		// Game started event (for non-hosts)
		multiplayerService.on(GameEventType.GAME_STARTED, (event: GameEvent) => {
			console.log('=== GAME_STARTED EVENT RECEIVED IN HANDLER ===');
			console.log('Event:', event);
			console.log('Is Host:', isHost);
			console.log('Event Data:', event.data);
			
			if (isHost) {
				console.log('Host received own GAME_STARTED broadcast, ignoring');
				return;
			}
			
			if (!event.data) {
				console.error('GAME_STARTED event missing data');
				errorMessage = 'Invalid game start event';
				return;
			}
			
			if (!event.data.initialState) {
				console.error('GAME_STARTED event missing initialState');
				errorMessage = 'Invalid game start event - missing state';
				return;
			}
			
			if (!event.data.players) {
				console.error('GAME_STARTED event missing players');
				errorMessage = 'Invalid game start event - missing players';
				return;
			}
			
			console.log('=== PROCESSING GAME START ===');
			try {
				const game = new GameState('game-' + Date.now());
				// Initialize with player names from event
				const playerNames = event.data.players.map((p: any) => p.name);
				console.log('Initializing game with players:', playerNames);
				game.initializeGame(playerNames);
				
				// Apply the serialized state from host
				console.log('Deserializing game state...');
				const deserializedState = deserializeGameState(event.data.initialState, game);
				gameState = deserializedState;
				console.log('Game state set successfully');
				updateCounter++;
			} catch (error) {
				console.error('Failed to deserialize game state:', error);
				errorMessage = 'Failed to sync game state: ' + (error instanceof Error ? error.message : 'Unknown error');
			}
		});
		
		console.log('GAME_STARTED listener registered');
		
		// Room events for lobby updates
		multiplayerService.on('room:joined', (event: GameEvent) => {
			console.log('=== ROOM:JOINED EVENT ===', event.data);
			if (event.data && event.data.players) {
				lobbyPlayers = event.data.players;
				console.log('Updated lobby players:', lobbyPlayers);
			}
		});
		
		multiplayerService.on('room:left', (event: GameEvent) => {
			console.log('=== ROOM:LEFT EVENT ===', event.data);
			if (event.data && event.data.playerId) {
				lobbyPlayers = lobbyPlayers.filter(p => p.playerId !== event.data.playerId);
				console.log('Updated lobby players:', lobbyPlayers);
			}
		});
		
		// Bid placed event
		multiplayerService.on(GameEventType.BID_PLACED, (event: GameEvent) => {
			console.log('=== RECEIVED BID ===', event.data);
			if (!gameState) return;
			
			// Skip if it's our own bid
			const currentPlayer = gameState.getCurrentPlayer();
			if (currentPlayer.id === myPlayerId) return;
			
			try {
				const player = gameState.getPlayers().find(p => p.id === event.data.playerId);
				const auction = gameState.getCurrentAuction();
				
				if (!player || !auction) return;
				
				// Find the money cards
				const moneyCards = player.getMoneyHand().filter(c => 
					event.data.moneyCardIds.includes(c.id)
				) as MoneyCard[];
				
				const result = auction.processBid(player, moneyCards);
				
				if (result === AuctionResult.COMPLETE) {
					completeAuction();
				} else {
					// Move to next player
					let nextIndex = (gameState.getCurrentPlayerIndex() + 1) % gameState.getPlayers().length;
					let attempts = 0;
					while (!auction.getActivePlayers().has(gameState.getPlayers()[nextIndex].id) && attempts < gameState.getPlayers().length) {
						nextIndex = (nextIndex + 1) % gameState.getPlayers().length;
						attempts++;
					}
					gameState.setCurrentPlayerIndex(nextIndex);
					updateCounter++;
				}
			} catch (error) {
				console.error('Failed to process remote bid:', error);
			}
		});
		
		// Pass event
		multiplayerService.on(GameEventType.PASS_AUCTION, (event: GameEvent) => {
			console.log('=== RECEIVED PASS ===', event.data);
			if (!gameState) return;
			
			// Skip if it's our own pass
			const currentPlayer = gameState.getCurrentPlayer();
			if (currentPlayer.id === myPlayerId) return;
			
			try {
				const player = gameState.getPlayers().find(p => p.id === event.data.playerId);
				const auction = gameState.getCurrentAuction();
				
				if (!player || !auction) return;
				
				const result = auction.processPass(player);
				
				if (result === AuctionResult.COMPLETE) {
					completeAuction();
				} else {
					// Move to next player
					let nextIndex = (gameState.getCurrentPlayerIndex() + 1) % gameState.getPlayers().length;
					while (!auction.getActivePlayers().has(gameState.getPlayers()[nextIndex].id)) {
						nextIndex = (nextIndex + 1) % gameState.getPlayers().length;
					}
					gameState.setCurrentPlayerIndex(nextIndex);
					updateCounter++;
				}
			} catch (error) {
				console.error('Failed to process remote pass:', error);
			}
		});
		
		// Luxury discard event
		multiplayerService.on(GameEventType.LUXURY_DISCARDED, (event: GameEvent) => {
			console.log('=== RECEIVED LUXURY DISCARD ===', event.data);
			if (!gameState) return;
			
			// Skip if it's our own discard
			if (event.data.playerId === myPlayerId) return;
			
			try {
				gameState.handleLuxuryDiscard(event.data.playerId, event.data.cardId);
				showLuxuryDiscard = false;
				
				if (gameState.getCurrentPhase() !== GamePhase.SCORING) {
					gameState.startNewRound();
				}
				
				updateCounter++;
			} catch (error) {
				console.error('Failed to process remote luxury discard:', error);
			}
		});
		
		// Round started event (for synchronization)
		multiplayerService.on(GameEventType.ROUND_STARTED, (event: GameEvent) => {
			console.log('=== RECEIVED ROUND START ===', event.data);
			// This is mainly for logging/debugging
			// The state should already be updated by the action that triggered it
		});
		
		// Auction complete event (for synchronization)
		multiplayerService.on(GameEventType.AUCTION_COMPLETE, (event: GameEvent) => {
			console.log('=== RECEIVED AUCTION COMPLETE ===', event.data);
			// This is mainly for logging/debugging
		});
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
		
		// In multiplayer, only allow current player to bid
		if (isMultiplayer && currentPlayer.id !== myPlayerId) {
			errorMessage = 'Not your turn!';
			return;
		}

		console.log('=== PLACE BID ===');
		console.log('Current player before bid:', currentPlayer.name, 'ID:', currentPlayer.id);
		console.log('Current player index:', gameState.getCurrentPlayerIndex());
		console.log('Selected cards:', selectedMoneyCards);
		console.log('Current highest bid:', auction.getCurrentHighestBid());
		console.log('Active players in auction:', Array.from(auction.getActivePlayers()));
		console.log('Is current player active?', auction.getActivePlayers().has(currentPlayer.id));

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
			
			// Broadcast bid to other players in multiplayer
			if (isMultiplayer) {
				multiplayerService.broadcastEvent(GameEventType.BID_PLACED, {
					playerId: currentPlayer.id,
					playerName: currentPlayer.name,
					moneyCardIds: moneyCards.map(c => c.id),
					totalBid: currentPlayer.getCurrentBidAmount()
				});
			}

			if (result === AuctionResult.COMPLETE) {
				completeAuction();
			} else {
				console.log('Moving to next player...');
				console.log('Active players before next:', Array.from(auction.getActivePlayers()));
				
				// Find next active player
				let nextIndex = (gameState.getCurrentPlayerIndex() + 1) % gameState.getPlayers().length;
				let attempts = 0;
				while (!auction.getActivePlayers().has(gameState.getPlayers()[nextIndex].id) && attempts < gameState.getPlayers().length) {
					nextIndex = (nextIndex + 1) % gameState.getPlayers().length;
					attempts++;
				}
				gameState.setCurrentPlayerIndex(nextIndex);
				
				console.log('New current player:', gameState.getCurrentPlayer().name);
				console.log('New current player index:', gameState.getCurrentPlayerIndex());
				console.log('Is new player active?', auction.getActivePlayers().has(gameState.getCurrentPlayer().id));
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
		
		// In multiplayer, only allow current player to pass
		if (isMultiplayer && currentPlayer.id !== myPlayerId) {
			errorMessage = 'Not your turn!';
			return;
		}

		try {
			const result = auction.processPass(currentPlayer);
			selectedMoneyCards = [];
			errorMessage = '';
			
			// Broadcast pass to other players in multiplayer
			if (isMultiplayer) {
				multiplayerService.broadcastEvent(GameEventType.PASS_AUCTION, {
					playerId: currentPlayer.id,
					playerName: currentPlayer.name
				});
			}

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
			// In multiplayer, only allow the player who needs to discard
			if (isMultiplayer && playerWithPending.id !== myPlayerId) {
				errorMessage = 'Not your turn to discard!';
				return;
			}
			
			gameState.handleLuxuryDiscard(playerWithPending.id, cardId);
			
			// Broadcast luxury discard in multiplayer
			if (isMultiplayer) {
				multiplayerService.broadcastEvent(GameEventType.LUXURY_DISCARDED, {
					playerId: playerWithPending.id,
					playerName: playerWithPending.name,
					cardId
				});
			}
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
		// Clean up multiplayer connection if active
		if (isMultiplayer) {
			multiplayerService.leaveRoom();
			multiplayerService.disconnect();
			
			// Reset multiplayer state
			isMultiplayer = false;
			roomId = '';
			myPlayerId = '';
			myPlayerName = '';
			isHost = false;
		}
		
		// Reset game state
		gameState = null;
		selectedMoneyCards = [];
		errorMessage = '';
		showLuxuryDiscard = false;
		updateCounter = 0;
		gameMode = 'menu';
	}
	
	function backToMenu() {
		gameMode = 'menu';
		errorMessage = '';
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

<UpdatePrompt />

<main class="container">
	<header>
		<h1>High Society</h1>
		<p>A game of luxury, prestige, and careful money management</p>
	</header>

	{#if gameMode === 'menu'}
		<!-- Main menu -->
		<article>
			<header>
				<h2>Select Game Mode</h2>
			</header>
			
			<div class="mode-selection">
				<button 
					onclick={() => gameMode = 'local'}
					class="mode-button"
				>
					<span class="icon">🏠</span>
					<h3>Local Game</h3>
					<p>Pass and play on one device</p>
				</button>
				
				<button 
					onclick={() => gameMode = 'multiplayer'}
					class="mode-button secondary"
				>
					<span class="icon">🌐</span>
					<h3>Online Multiplayer</h3>
					<p>Play with friends over the internet</p>
				</button>
			</div>
		</article>
	{:else if gameMode === 'local' && !gameState}
		<div class="with-back-button">
			<button onclick={backToMenu} class="contrast">← Back to Menu</button>
			<GameSetup onStart={startGame} />
		</div>
	{:else if gameMode === 'multiplayer' && !gameState && !roomReady}
		<div class="with-back-button">
			<button onclick={backToMenu} class="contrast">← Back to Menu</button>
			<MultiplayerSetup onRoomReady={handleMultiplayerRoomReady} />
		</div>
	{:else if gameMode === 'multiplayer' && !gameState && roomReady && isHost}
		<!-- Host ready to start game with connected players -->
		<div class="with-back-button">
			<button onclick={backToMenu} class="contrast">← Back to Menu</button>
			<GameSetup onStart={startGame} />
		</div>
	{:else if gameMode === 'multiplayer' && !gameState && roomReady && !isHost}
		<!-- Non-host waiting for game to start -->
		<article class="multiplayer-lobby">
			<header>
				<h2>Multiplayer Lobby</h2>
			</header>

			<div class="lobby-info">
				<div class="room-code-display">
					<h3>Room Code</h3>
					<code class="room-code-large">{roomId}</code>
				</div>

				<div class="connection-indicator">
					{#if multiplayerService.isConnected()}
						<span class="status-badge connected">🟢 Connected to Server</span>
					{:else}
						<span class="status-badge disconnected">🔴 Disconnected</span>
					{/if}
				</div>
			</div>

			<div class="player-list-lobby">
				<h3>Connected Players ({lobbyPlayers.length}/5)</h3>
				<ul>
					{#each lobbyPlayers as player}
						<li class="player-item">
							<span class="player-name">{player.playerName}</span>
							{#if player.playerId === myPlayerId}
								<span class="badge-you">You</span>
							{/if}
							{#if player.playerId === lobbyPlayers[0]?.playerId}
								<span class="badge-host">Host</span>
							{/if}
						</li>
					{/each}
				</ul>
			</div>

			<div class="waiting-message">
				<p>⏳ Waiting for the host to start the game...</p>
				<progress></progress>
			</div>

			<button onclick={backToMenu} class="secondary">
				Leave Lobby
			</button>
		</article>
	{:else if gameState && (currentPhase === GamePhase.SCORING || currentPhase === GamePhase.FINISHED)}
		<ScoreBoard 
			players={allPlayers} 
			scoringService={new GameScoringService()}
			onNewGame={newGame}
		/>
	{:else if gameState}
		<div class="game-container">
			{#if isMultiplayer}
				<div class="multiplayer-info">
					<span class="badge">🌐 Multiplayer</span>
					<span class="room-code">Room: {roomId}</span>
					{#if multiplayerService.isConnected()}
						<span class="connection-status connected">🟢 Connected</span>
					{:else}
						<span class="connection-status disconnected">🔴 Disconnected</span>
					{/if}
					{#if currentPlayerObj && currentPlayerObj.id === myPlayerId}
						<span class="your-turn">🎯 Your Turn!</span>
					{/if}
				</div>
			{/if}
			
			{#if errorMessage}
				<article style="background-color: var(--pico-del-color); margin-bottom: 1rem;">
					<p><strong>Error:</strong> {errorMessage}</p>
				</article>
			{/if}

			<GameBoard gameState={gameState} updateKey={updateCounter} />

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
						updateKey={updateCounter}
						isMultiplayer={isMultiplayer}
						isMyTurn={!isMultiplayer || currentPlayerObj.id === myPlayerId}
					/>
				{/if}

				<StatusDisplay players={allPlayers} updateKey={updateCounter} />
			</div>

			{#if currentPlayerObj}
				<PlayerHand 
					player={currentPlayerObj}
					selectedCards={selectedMoneyCards}
					onToggleCard={toggleMoneyCard}
					updateKey={updateCounter}
					isMyTurn={!isMultiplayer || currentPlayerObj.id === myPlayerId}
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

	.mode-selection {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
		margin-top: 1.5rem;
	}

	.mode-button {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem;
		text-align: center;
		border: 2px solid var(--pico-primary);
		transition: all 0.3s ease;
	}

	.mode-button:hover {
		transform: translateY(-4px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.mode-button .icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.mode-button h3 {
		margin-bottom: 0.5rem;
		color: var(--pico-primary);
	}

	.mode-button p {
		margin: 0;
		color: var(--pico-muted-color);
		font-size: 0.9rem;
	}

	.with-back-button {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.with-back-button > button {
		align-self: flex-start;
	}

	.multiplayer-info {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background-color: var(--pico-card-background-color);
		border-radius: var(--pico-border-radius);
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		background-color: var(--pico-primary);
		color: var(--pico-primary-inverse);
		border-radius: var(--pico-border-radius);
		font-size: 0.85rem;
		font-weight: bold;
	}

	.room-code {
		font-family: var(--pico-font-family-monospace);
		font-weight: bold;
		color: var(--pico-muted-color);
	}

	.connection-status {
		font-size: 0.85rem;
		font-weight: bold;
	}

	.connection-status.connected {
		color: var(--pico-ins-color);
	}

	.connection-status.disconnected {
		color: var(--pico-del-color);
	}

	.your-turn {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		background-color: var(--pico-ins-color);
		color: var(--pico-contrast);
		border-radius: var(--pico-border-radius);
		font-size: 0.85rem;
		font-weight: bold;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}

	/* Multiplayer Lobby Styles */
	.multiplayer-lobby {
		max-width: 600px;
		margin: 0 auto;
	}

	.lobby-info {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.room-code-display {
		text-align: center;
		padding: 1rem;
		background-color: var(--pico-card-background-color);
		border-radius: var(--pico-border-radius);
	}

	.room-code-display h3 {
		margin-bottom: 0.5rem;
		font-size: 0.9rem;
		color: var(--pico-muted-color);
	}

	.room-code-large {
		display: block;
		font-size: 1.5rem;
		font-weight: bold;
		font-family: var(--pico-font-family-monospace);
		letter-spacing: 0.1em;
		padding: 0.5rem;
		background-color: var(--pico-code-background-color);
		border-radius: var(--pico-border-radius);
	}

	.connection-indicator {
		text-align: center;
	}

	.status-badge {
		display: inline-block;
		padding: 0.5rem 1rem;
		border-radius: var(--pico-border-radius);
		font-size: 0.9rem;
		font-weight: bold;
	}

	.status-badge.connected {
		background-color: var(--pico-ins-color);
		color: var(--pico-contrast);
	}

	.status-badge.disconnected {
		background-color: var(--pico-del-color);
		color: var(--pico-contrast);
	}

	.player-list-lobby {
		margin-bottom: 1.5rem;
	}

	.player-list-lobby h3 {
		margin-bottom: 1rem;
		color: var(--pico-primary);
	}

	.player-list-lobby ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.player-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		margin-bottom: 0.5rem;
		background-color: var(--pico-card-background-color);
		border-radius: var(--pico-border-radius);
		transition: transform 0.2s ease;
	}

	.player-item:hover {
		transform: translateX(4px);
	}

	.player-name {
		flex: 1;
		font-weight: 500;
	}

	.badge-you {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background-color: var(--pico-primary);
		color: var(--pico-primary-inverse);
		border-radius: var(--pico-border-radius);
		font-size: 0.75rem;
		font-weight: bold;
	}

	.badge-host {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background-color: var(--pico-secondary);
		color: var(--pico-secondary-inverse);
		border-radius: var(--pico-border-radius);
		font-size: 0.75rem;
		font-weight: bold;
	}

	.waiting-message {
		text-align: center;
		margin: 2rem 0;
	}

	.waiting-message p {
		margin-bottom: 1rem;
		font-size: 1.1rem;
		color: var(--pico-muted-color);
	}
</style>
