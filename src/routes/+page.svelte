npm <script lang="ts">
	import { GameState, GamePhase } from '$lib/domain/gameState';
	import { GameScoringService } from '$lib/domain/scoring';
	import { AuctionResult } from '$lib/domain/auction';
	import type { MoneyCard } from '$lib/domain/cards';
	
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
	
	// Multiplayer state (always multiplayer now)
	let roomId = $state('');
	let myPlayerId = $state('');
	let myPlayerName = $state('');
	let isHost = $state(false);
	let inLobby = $state(true); // true = in lobby/setup, false = in game
	let lobbyPlayers = $state<Array<{ playerId: string; playerName: string }>>([]);
	let multiplayerService = getMultiplayerService();
	let listenersRegistered = false; // Flag to prevent duplicate listener registration
	
	// Map multiplayer player IDs to game player indices
	let playerIdToGameIndex = $state<Map<string, number>>(new Map());

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
	
	// Get the local player based on multiplayer ID mapping
	const localPlayer = $derived.by(() => {
		if (!myPlayerId || !gameState) return undefined;
		const myGameIndex = playerIdToGameIndex.get(myPlayerId);
		if (myGameIndex === undefined) return undefined;
		return gameState.getPlayers()[myGameIndex];
	});
	
	// Check if it's my turn based on multiplayer player ID mapping
	const isMyTurn = $derived.by(() => {
		if (!myPlayerId || currentPlayerIndex === undefined || currentPlayerIndex < 0) return false;
		const myGameIndex = playerIdToGameIndex.get(myPlayerId);
		const result = myGameIndex === currentPlayerIndex;
		console.log(`Turn check: myPlayerId=${myPlayerId}, myGameIndex=${myGameIndex}, currentPlayerIndex=${currentPlayerIndex}, isMyTurn=${result}`);
		return result;
	});

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
			
			// Create mapping from multiplayer player IDs to game player indices
			playerIdToGameIndex = new Map();
			lobbyPlayers.forEach((lobbyPlayer, index) => {
				playerIdToGameIndex.set(lobbyPlayer.playerId, index);
				console.log(`Mapping ${lobbyPlayer.playerId} -> player index ${index} (${playerNames[index]})`);
			});
			
			// If host, broadcast game start to all players
			if (isHost) {
				// Send player mapping so clients can determine their game index
				const playerMapping = lobbyPlayers.map((lobbyPlayer, index) => ({
					multiplayerId: lobbyPlayer.playerId,
					gamePlayerIndex: index,
					playerName: playerNames[index]
				}));
				
				const eventData = {
					players: playerNames.map((name, i) => ({ 
						id: game.getPlayers()[i].id, 
						name 
					})),
					initialState: serializeGameState(game),
					playerMapping: playerMapping
				};
				console.log('=== BROADCASTING GAME_STARTED ===');
				console.log('Event data:', eventData);
				console.log('Player mapping:', playerMapping);
				console.log('Room ID:', roomId);
				multiplayerService.broadcastEvent(GameEventType.GAME_STARTED, eventData);
				console.log('Broadcast complete');
			}
			
			// Exit lobby mode
			inLobby = false;
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
		lobbyPlayers = players;
		inLobby = true;
		
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
		// Prevent duplicate listener registration
		if (listenersRegistered) {
			console.log('Listeners already registered, skipping setup');
			return;
		}
		
		console.log('=== SETTING UP MULTIPLAYER LISTENERS ===');
		console.log('Setting up listener for:', GameEventType.GAME_STARTED);
		console.log('Current isHost:', isHost);
		console.log('Current myPlayerId:', myPlayerId);
		console.log('Multiplayer service connected:', multiplayerService.isConnected());
		
		listenersRegistered = true;
		
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
				
				// Build player ID mapping from received data
				if (event.data.playerMapping) {
					playerIdToGameIndex = new Map();
					event.data.playerMapping.forEach((mapping: any) => {
						playerIdToGameIndex.set(mapping.multiplayerId, mapping.gamePlayerIndex);
						console.log(`Mapping ${mapping.multiplayerId} -> player index ${mapping.gamePlayerIndex} (${mapping.playerName})`);
					});
				}
				
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
			
			// Skip if it's our own bid - check multiplayer player ID
			if (event.data.multiplayerPlayerId === myPlayerId) {
				console.log('Skipping own bid event');
				return;
			}
			
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
			
			// Skip if it's our own pass - check multiplayer player ID
			if (event.data.multiplayerPlayerId === myPlayerId) {
				console.log('Skipping own pass event');
				return;
			}
			
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
		
		// Only allow current player to bid - use isMyTurn derived value
		if (!isMyTurn) {
			errorMessage = 'Not your turn!';
			console.log('Bid rejected: not your turn. isMyTurn =', isMyTurn);
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
			
			// Broadcast bid to other players
			multiplayerService.broadcastEvent(GameEventType.BID_PLACED, {
				playerId: currentPlayer.id,
				multiplayerPlayerId: myPlayerId, // Include multiplayer ID to identify sender
				playerName: currentPlayer.name,
				moneyCardIds: moneyCards.map(c => c.id),
				totalBid: currentPlayer.getCurrentBidAmount()
			});

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
		
		// Only allow current player to pass - use isMyTurn derived value
		if (!isMyTurn) {
			errorMessage = 'Not your turn!';
			console.log('Pass rejected: not your turn. isMyTurn =', isMyTurn);
			return;
		}

		try {
			const result = auction.processPass(currentPlayer);
			selectedMoneyCards = [];
			errorMessage = '';
			
			// Broadcast pass to other players
			multiplayerService.broadcastEvent(GameEventType.PASS_AUCTION, {
				playerId: currentPlayer.id,
				multiplayerPlayerId: myPlayerId, // Include multiplayer ID to identify sender
				playerName: currentPlayer.name
			});

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
			// Only allow the player who needs to discard
			if (playerWithPending.id !== myPlayerId) {
				errorMessage = 'Not your turn to discard!';
				return;
			}
			
			gameState.handleLuxuryDiscard(playerWithPending.id, cardId);
			
			// Broadcast luxury discard
			multiplayerService.broadcastEvent(GameEventType.LUXURY_DISCARDED, {
				playerId: playerWithPending.id,
				playerName: playerWithPending.name,
				cardId
			});
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
		// Clean up multiplayer connection
		multiplayerService.leaveRoom();
		multiplayerService.disconnect();
		
		// Reset all state
		gameState = null;
		selectedMoneyCards = [];
		errorMessage = '';
		showLuxuryDiscard = false;
		updateCounter = 0;
		roomId = '';
		myPlayerId = '';
		myPlayerName = '';
		isHost = false;
		inLobby = true;
		lobbyPlayers = [];
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
		<p>Online Multiplayer Card Game</p>
	</header>

	{#if !gameState && !roomId}
		<!-- Multiplayer Setup - Creating or joining room -->
		<MultiplayerSetup onRoomReady={handleMultiplayerRoomReady} />
	{:else if !gameState && roomId}
		<!-- Multiplayer Lobby - Waiting for game to start -->
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

			{#if isHost}
				<div class="host-controls">
					<p>You are the host. Start the game when everyone is ready.</p>
					<button 
						onclick={() => startGame(lobbyPlayers.map(p => p.playerName))}
						disabled={lobbyPlayers.length < 2 || lobbyPlayers.length > 5}
						class="primary"
					>
						Start Game ({lobbyPlayers.length} players)
					</button>
					{#if lobbyPlayers.length < 2}
						<small class="help-text">Need at least 2 players to start</small>
					{/if}
				</div>
			{:else}
				<div class="waiting-message">
					<p>⏳ Waiting for the host to start the game...</p>
					<progress></progress>
				</div>
			{/if}

			<button onclick={newGame} class="secondary">
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
			<div class="multiplayer-info">
				<span class="badge">🌐 Room: {roomId}</span>
				{#if multiplayerService.isConnected()}
					<span class="connection-status connected">🟢 Connected</span>
				{:else}
					<span class="connection-status disconnected">🔴 Disconnected</span>
				{/if}
				{#if currentPlayerObj && currentPlayerObj.id === myPlayerId}
					<span class="your-turn">🎯 Your Turn!</span>
				{/if}
			</div>
			
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
						localPlayer={localPlayer}
					currentPlayerIndex={currentPlayerIndex}
					allPlayers={allPlayers}
					onBid={placeBid}
					onPass={pass}
					selectedTotal={selectedMoneyCards.reduce((sum, id) => {
						const card = localPlayer?.getMoneyHand().find(c => c.id === id);
						return sum + (card?.value || 0);
					}, 0)}
					updateKey={updateCounter}
					isMultiplayer={true}
					isMyTurn={isMyTurn}
				/>
				{/if}

				<StatusDisplay players={allPlayers} updateKey={updateCounter} />
			</div>

			{#if localPlayer}
				<PlayerHand 
					player={localPlayer}
					selectedCards={selectedMoneyCards}
					onToggleCard={toggleMoneyCard}
					updateKey={updateCounter}
					isMyTurn={isMyTurn}
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

	.host-controls {
		text-align: center;
		margin: 2rem 0;
		padding: 1.5rem;
		background-color: var(--pico-card-background-color);
		border-radius: var(--pico-border-radius);
		border: 2px solid var(--pico-primary);
	}

	.host-controls p {
		margin-bottom: 1rem;
		font-weight: 500;
		color: var(--pico-primary);
	}

	.host-controls button {
		margin: 0 auto;
	}

	.help-text {
		display: block;
		margin-top: 0.5rem;
		font-size: 0.9rem;
		color: var(--pico-muted-color);
	}
</style>
