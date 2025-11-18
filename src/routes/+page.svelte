<script lang="ts">
	import { GameState, GamePhase } from '$lib/domain/gameState';
	import { GameScoringService } from '$lib/domain/scoring';
	import { AuctionResult } from '$lib/domain/auction';
	import type { MoneyCard } from '$lib/domain/cards';
	import type { Player } from '$lib/domain/player';
	
	import MultiplayerSetup from '$lib/components/MultiplayerSetup.svelte';
	import AuctionPanel from '$lib/components/AuctionPanel.svelte';
	import PlayerHand from '$lib/components/PlayerHand.svelte';
	import StatusDisplay from '$lib/components/StatusDisplay.svelte';
	import ScoreBoard from '$lib/components/ScoreBoard.svelte';
	import LuxuryDiscardModal from '$lib/components/LuxuryDiscardModal.svelte';
	import AuctionResultModal from '$lib/components/AuctionResultModal.svelte';
	import UpdatePrompt from '$lib/components/UpdatePrompt.svelte';
	
	import { Target, Clock, Wifi, WifiOff } from 'lucide-svelte';
	import { page } from '$app/stores';
	
	import { getMultiplayerService } from '$lib/multiplayer/service';
	import { GameEventType, type GameEvent } from '$lib/multiplayer/events';
	import { serializeGameState, deserializeGameState, serializeStatusCard, deserializeStatusCard } from '$lib/multiplayer/serialization';
	
	// Multiplayer state (always multiplayer now)
	let roomId = $state('');
	let myPlayerId = $state('');
	let myPlayerName = $state('');
	let hostPlayerId = $state(''); // Track who is the host (creator of the room)
	let isHost = $state(false);
	let inLobby = $state(true); // true = in lobby/setup, false = in game
	let lobbyPlayers = $state<Array<{ playerId: string; playerName: string }>>([]);
	let multiplayerService = getMultiplayerService();
	let listenersRegistered = false; // Flag to prevent duplicate listener registration
	let processedEvents = $state<Set<string>>(new Set()); // Track processed events to prevent duplicates
	
	// Restart state management
	let restartRequested = $state(false); // True when host requests restart
	let playersReady = $state<Set<string>>(new Set()); // Track which players are ready to restart
	
	// Disconnection and rejoin state
	let showRejoinPrompt = $state(false);
	let isRejoining = $state(false);
	let rejoinError = $state('');
	
	// Map multiplayer player IDs to game player indices
	let playerIdToGameIndex = $state<Map<string, number>>(new Map());

	// Track connected players (derived from lobbyPlayers)
	const connectedPlayerIds = $derived.by(() => {
		return new Set(lobbyPlayers.map(p => p.playerId));
	});

	let gameState = $state<GameState | null>(null);
	let selectedMoneyCards = $state<string[]>([]);
	let errorMessage = $state<string>('');
	let showLuxuryDiscard = $state(false);
	let showAuctionResult = $state(false);
	let auctionResultData = $state<{ 
		winner: any; 
		card: any; 
		winningBid: number;
		isDisgrace?: boolean;
		losersInfo?: Array<{ player: Player; bidAmount: number }>;
	} | null>(null);
	let updateCounter = $state(0); // Force update counter
	
	// Store bid snapshot before disgrace auction completes (money gets discarded)
	let disgraceBidSnapshot: Array<{ playerId: string; bidAmount: number }> | null = null;
	
	// Screen Wake Lock state
	let wakeLock: WakeLockSentinel | null = null;

	// Derived state to force reactivity - all depend on updateCounter
	const currentPhase = $derived(updateCounter >= 0 ? gameState?.getCurrentPhase() : undefined);
	const currentAuction = $derived(updateCounter >= 0 ? gameState?.getCurrentAuction() : null);
	const currentCard = $derived(updateCounter >= 0 ? gameState?.getPublicState().currentCard : null);
	const currentPlayerIndex = $derived(updateCounter >= 0 ? gameState?.getCurrentPlayerIndex() : -1);
	const currentPlayerObj = $derived(updateCounter >= 0 ? gameState?.getCurrentPlayer() : undefined);
	const allPlayers = $derived(updateCounter >= 0 ? gameState?.getPlayers() ?? [] : []);
	const gameEndTriggerCount = $derived(updateCounter >= 0 ? gameState?.getPublicState().gameEndTriggerCount ?? 0 : 0);
	const remainingStatusCards = $derived(updateCounter >= 0 ? gameState?.getPublicState().remainingStatusCards ?? 0 : 0);
	
	// Get the local player based on multiplayer ID mapping
	const localPlayer = $derived.by(() => {
		if (!myPlayerId || !gameState) return undefined;
		const myGameIndex = playerIdToGameIndex.get(myPlayerId);
		if (myGameIndex === undefined) return undefined;
		return gameState.getPlayers()[myGameIndex];
	});
	
	// Check if it's my turn based on multiplayer player ID mapping
	const isMyTurn = $derived.by(() => {
		// Explicitly depend on updateCounter to ensure reactivity
		const _ = updateCounter;
		if (!myPlayerId || currentPlayerIndex === undefined || currentPlayerIndex < 0) {
			console.log(`Turn check: EARLY EXIT - myPlayerId=${myPlayerId}, currentPlayerIndex=${currentPlayerIndex}`);
			return false;
		}
		const myGameIndex = playerIdToGameIndex.get(myPlayerId);
		const result = myGameIndex === currentPlayerIndex;
		console.log(`Turn check [counter=${updateCounter}]: myPlayerId=${myPlayerId}, myGameIndex=${myGameIndex}, currentPlayerIndex=${currentPlayerIndex}, currentPlayer=${gameState?.getCurrentPlayer()?.name}, isMyTurn=${result}`);
		return result;
	});

	// Helper to prevent duplicate event processing
	function shouldProcessEvent(eventType: string, eventTimestamp: number): boolean {
		const eventId = `${eventType}_${eventTimestamp}`;
		if (processedEvents.has(eventId)) {
			console.log(`Duplicate event detected: ${eventId} - skipping`);
			return false;
		}
		processedEvents.add(eventId);
		
		// Clean up old events (keep last 100)
		if (processedEvents.size > 100) {
			const arr = Array.from(processedEvents);
			processedEvents = new Set(arr.slice(-100));
		}
		
		return true;
	}

	// Save game state to sessionStorage for recovery after refresh
	function saveGameStateToStorage() {
		if (gameState && roomId) {
			try {
				const serialized = serializeGameState(gameState);
				const stateData = {
					serializedState: serialized,
					playerMapping: Array.from(playerIdToGameIndex.entries()),
					timestamp: Date.now()
				};
				sessionStorage.setItem(`highsociety_gamestate_${roomId}`, JSON.stringify(stateData));
				console.log('Game state saved to sessionStorage');
			} catch (error) {
				console.error('Failed to save game state:', error);
			}
		}
	}

	// Restore game state from sessionStorage after refresh
	function restoreGameStateFromStorage(): boolean {
		if (roomId) {
			try {
				const stored = sessionStorage.getItem(`highsociety_gamestate_${roomId}`);
				if (stored) {
					const stateData = JSON.parse(stored);
					// Only restore if less than 1 hour old
					if (Date.now() - stateData.timestamp < 60 * 60 * 1000) {
						const game = new GameState('game-' + Date.now());
						const playerNames = lobbyPlayers.map(p => p.playerName);
						game.initializeGame(playerNames);
						gameState = deserializeGameState(stateData.serializedState, game);
						
						// Restore player mapping
						playerIdToGameIndex = new Map(stateData.playerMapping);
						
						console.log('Game state restored from sessionStorage');
						return true;
					}
				}
			} catch (error) {
				console.error('Failed to restore game state:', error);
			}
		}
		return false;
	}

	function startGame(playerNames: string[], lobbyIndexToGameIndex?: number[]) {
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
			lobbyPlayers.forEach((lobbyPlayer, lobbyIndex) => {
				// If we have a shuffle mapping, use it; otherwise use direct mapping
				const gameIndex = lobbyIndexToGameIndex ? lobbyIndexToGameIndex[lobbyIndex] : lobbyIndex;
				playerIdToGameIndex.set(lobbyPlayer.playerId, gameIndex);
				console.log(`Mapping ${lobbyPlayer.playerId} -> player index ${gameIndex} (${playerNames[gameIndex]})`);
			});
			
			// Exit lobby mode
			inLobby = false;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to start game';
		}
	}

	// HOST ONLY: Initialize game and broadcast to clients
	function startGameAsHost(playerNames: string[]) {
		console.log('=== HOST: STARTING GAME ===');
		
		// Randomize player order to make play fair (not based on connection order)
		const shuffledIndices = Array.from({ length: playerNames.length }, (_, i) => i);
		for (let i = shuffledIndices.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
		}
		
		// Create shuffled player names array
		const shuffledPlayerNames = shuffledIndices.map(i => playerNames[i]);
		console.log('Original player order:', playerNames);
		console.log('Shuffled player order:', shuffledPlayerNames);
		console.log('Shuffle mapping:', shuffledIndices);
		
		// Create inverse mapping: for each lobby index, what is their game index?
		const lobbyIndexToGameIndex = new Array(shuffledIndices.length);
		shuffledIndices.forEach((lobbyIndex, gameIndex) => {
			lobbyIndexToGameIndex[lobbyIndex] = gameIndex;
		});
		
		// Initialize the game locally with shuffled names
		startGame(shuffledPlayerNames, lobbyIndexToGameIndex);
		
		if (!gameState) {
			console.error('Failed to initialize game state');
			return;
		}
		
		// Broadcast to all clients with the shuffle mapping
		// Each lobby player's multiplayer ID maps to their shuffled game position
		const playerMapping = lobbyPlayers.map((lobbyPlayer, lobbyIndex) => ({
			multiplayerId: lobbyPlayer.playerId,
			gamePlayerIndex: lobbyIndexToGameIndex[lobbyIndex],
			playerName: shuffledPlayerNames[lobbyIndexToGameIndex[lobbyIndex]]
		}));
		
		// Get players from non-null gameState
		const gamePlayers = gameState.getPlayers();
		
		const eventData = {
			players: shuffledPlayerNames.map((name, i) => ({ 
				id: gamePlayers[i].id, 
				name 
			})),
			initialState: serializeGameState(gameState),
			playerMapping: playerMapping
		};
		
		console.log('HOST: Broadcasting GAME_STARTED to clients');
		console.log('Player mapping:', playerMapping);
		multiplayerService.broadcastEvent(GameEventType.GAME_STARTED, eventData);
	}

	// CLIENT ONLY: Receive game state from host
	function startGameAsClient(event: GameEvent) {
		console.log('=== CLIENT: RECEIVING GAME STATE FROM HOST ===');
		console.log('Event data:', event.data);
		console.log('Before startGameAsClient - gameState exists:', !!gameState);
		console.log('Before startGameAsClient - inLobby:', inLobby);
		
		if (!event.data || !event.data.initialState || !event.data.players) {
			console.error('Invalid GAME_STARTED event data');
			errorMessage = 'Failed to receive game state from host';
			return;
		}
		
		try {
			const game = new GameState('game-' + Date.now());
			
			// Initialize with player names from event
			const playerNames = event.data.players.map((p: any) => p.name);
			console.log('CLIENT: Initializing game with players:', playerNames);
			game.initializeGame(playerNames);
			
			// Apply the serialized state from host
			console.log('CLIENT: Deserializing game state from host');
			const deserializedState = deserializeGameState(event.data.initialState, game);
			console.log('CLIENT: Deserialized state phase:', deserializedState.getCurrentPhase());
			
			gameState = deserializedState;
			console.log('CLIENT: Set gameState, now gameState exists:', !!gameState);
			
			// Build player ID mapping from received data
			if (event.data.playerMapping) {
				playerIdToGameIndex = new Map();
				event.data.playerMapping.forEach((mapping: any) => {
					playerIdToGameIndex.set(mapping.multiplayerId, mapping.gamePlayerIndex);
					console.log(`CLIENT: Mapping ${mapping.multiplayerId} -> player index ${mapping.gamePlayerIndex} (${mapping.playerName})`);
				});
			}
			
			selectedMoneyCards = [];
			errorMessage = '';
			updateCounter = 0;
			inLobby = false;
			
			console.log('CLIENT: Game state synchronized successfully');
			console.log('CLIENT: After sync - gameState exists:', !!gameState);
			console.log('CLIENT: After sync - inLobby:', inLobby);
			console.log('CLIENT: After sync - updateCounter:', updateCounter);
		} catch (error) {
			console.error('CLIENT: Failed to initialize game:', error);
			console.error('CLIENT: Error stack:', error);
			errorMessage = 'Failed to sync game state: ' + (error instanceof Error ? error.message : 'Unknown error');
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
		
		// Store the host player ID (first player is always the host/creator)
		if (players.length > 0) {
			hostPlayerId = players[0].playerId;
			console.log('Host player ID set to:', hostPlayerId);
			// Save to session storage so it persists across rejoins
			multiplayerService.updateHostPlayerId(hostPlayerId);
		}
		
		// Setup event listeners (idempotent - won't duplicate)
		setupMultiplayerListeners();
		
		console.log('=== MULTIPLAYER ROOM READY ===');
		console.log('Room ID:', roomId);
		console.log('My Player ID:', myPlayerId);
		console.log('Is Host:', isHost);
		console.log('Connected Players:', players);
		
		// ONLY THE HOST starts the game immediately
		// Clients will start when they receive GAME_STARTED event
		if (isHostParam) {
			const playerNames = players.map(p => p.playerName);
			console.log('HOST: Starting game with players:', playerNames);
			startGameAsHost(playerNames);
		} else {
			console.log('CLIENT: Waiting for GAME_STARTED event from host');
		}
	}
	
	function setupMultiplayerListeners() {
		// Prevent duplicate listener registration
		if (listenersRegistered) {
			console.log('Listeners already registered, skipping setup');
			return;
		}
		
		console.log('=== SETTING UP MULTIPLAYER LISTENERS ===');
		console.log('My Role - Is Host:', isHost);
		console.log('My Player ID:', myPlayerId);
		console.log('Multiplayer service connected:', multiplayerService.isConnected());
		
		listenersRegistered = true;
		
		// ============================================================
		// EVENT HANDLER ARCHITECTURE
		// ============================================================
		// HOST: Manages authoritative game state, broadcasts to clients
		// CLIENTS: Receive and sync state from host, broadcast their actions
		// 
		// Event Flow:
		// 1. Player performs action (bid, pass, discard)
		// 2. Action updates local state
		// 3. Action is broadcast to all other players
		// 4. Other players receive event and update their local state
		// 5. If action completes auction, HOST broadcasts final state
		// ============================================================
		
		// ============================================================
		// GAME_STARTED EVENT - Client receives initial game state from host
		// ============================================================
		multiplayerService.on(GameEventType.GAME_STARTED, (event: GameEvent) => {
			console.log('=== GAME_STARTED EVENT RECEIVED ===');
			console.log('My Role - Is Host:', isHost);
			console.log('My Player ID:', myPlayerId);
			console.log('Event timestamp:', event.timestamp);
			console.log('Current inLobby state:', inLobby);
			
			// Prevent duplicate processing
			if (!shouldProcessEvent('GAME_STARTED', event.timestamp)) {
				console.log('Skipping duplicate GAME_STARTED event');
				return;
			}
			
			// HOST: Ignore own broadcast
			if (isHost) {
				console.log('HOST: Ignoring own GAME_STARTED broadcast');
				return;
			}
			
			// CLIENT: Initialize game from host's state
			console.log('CLIENT: Processing GAME_STARTED event - will call startGameAsClient');
			startGameAsClient(event);
			console.log('CLIENT: After startGameAsClient, inLobby =', inLobby);
		});
		
		console.log('GAME_STARTED listener registered');
		
		// ============================================================
		// STATE_SYNC EVENT - Handle state sync requests from rejoining players
		// ============================================================
		multiplayerService.on(GameEventType.STATE_SYNC, (event: GameEvent) => {
			console.log('=== STATE_SYNC REQUEST RECEIVED ===');
			console.log('Requester:', event.data?.requesterName);
			console.log('Requester ID:', event.data?.requesterId);
			console.log('My Role - Is Host:', isHost);
			console.log('Do I have gameState?', !!gameState);
			console.log('Current phase:', gameState?.getCurrentPhase());
			
			// Skip if it's our own request
			if (event.data?.requesterId === myPlayerId) {
				console.log('Ignoring my own STATE_SYNC request');
				return;
			}
			
			// Any player with game state can respond (prefer host, but allow any player as backup)
			// This ensures state can be recovered even if host disconnects/refreshes
			if (gameState && gameState.getCurrentPhase() !== GamePhase.SETUP) {
				// Capture gameState in closure before setTimeout
				const currentGameState = gameState;
				
				// Add a small delay for non-hosts to let the host respond first
				const responseDelay = isHost ? 0 : 500;
				
				setTimeout(() => {
					console.log(isHost ? 'HOST: Sending current game state to rejoining player' : 'CLIENT: Sending current game state as backup');
					
					const gamePlayers = currentGameState.getPlayers();
					const playerMapping = lobbyPlayers.map((lobbyPlayer, index) => ({
						multiplayerId: lobbyPlayer.playerId,
						gamePlayerIndex: index,
						playerName: gamePlayers[index]?.name || lobbyPlayer.playerName
					}));
					
					const eventData = {
						players: gamePlayers.map((p, i) => ({ 
							id: p.id, 
							name: p.name 
						})),
						initialState: serializeGameState(currentGameState),
						playerMapping: playerMapping
					};
					
					// Send GAME_STARTED event to sync the rejoining player
					console.log('Broadcasting GAME_STARTED with player mapping:', playerMapping);
					multiplayerService.broadcastEvent(GameEventType.GAME_STARTED, eventData);
					console.log('GAME_STARTED broadcast complete');
				}, responseDelay);
			} else {
				console.log('No active game to sync (phase is SETUP or no gameState)');
			}
		});
		
		console.log('STATE_SYNC listener registered');
		
		// ============================================================
		// GAME_RESTART_REQUESTED EVENT - Host requests restart, clients show join button
		// ============================================================
		multiplayerService.on(GameEventType.GAME_RESTART_REQUESTED, (event: GameEvent) => {
			console.log('=== GAME_RESTART_REQUESTED EVENT RECEIVED ===');
			console.log('My Role - Is Host:', isHost);
			
			// Prevent duplicate processing
			if (!shouldProcessEvent('GAME_RESTART_REQUESTED', event.timestamp)) {
				return;
			}
			
			// HOST: Ignore own broadcast
			if (isHost) {
				console.log('HOST: Ignoring own GAME_RESTART_REQUESTED broadcast');
				return;
			}
			
			// CLIENT: Show restart prompt
			console.log('CLIENT: Restart requested by host');
			restartRequested = true;
			playersReady = new Set();
		});
		
		// ============================================================
		// GAME_RESTART_READY EVENT - Track which players are ready
		// ============================================================
		multiplayerService.on(GameEventType.GAME_RESTART_READY, (event: GameEvent) => {
			console.log('=== GAME_RESTART_READY EVENT RECEIVED ===');
			console.log('Player ready:', event.data?.playerName);
			
			// Prevent duplicate processing
			if (!shouldProcessEvent(`GAME_RESTART_READY_${event.data?.playerId}`, event.timestamp)) {
				return;
			}
			
			// Add player to ready set - reassign to trigger Svelte reactivity
			if (event.data?.playerId) {
				const newReady = new Set(playersReady);
				newReady.add(event.data.playerId);
				playersReady = newReady;
				console.log(`Players ready: ${playersReady.size}/${lobbyPlayers.length}`);
				
				// Check if all players are ready and start if so
				checkAndStartRestart();
			}
		});
		
		console.log('GAME_RESTART listeners registered');
		
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
		
		// ============================================================
		// BID_PLACED EVENT - All players (except sender) update their local state
		// ============================================================
		multiplayerService.on(GameEventType.BID_PLACED, (event: GameEvent) => {
			console.log('=== BID_PLACED EVENT RECEIVED ===');
			console.log('From player:', event.data?.playerName);
			console.log('My Player ID:', myPlayerId);
			
			if (!gameState) {
				console.warn('Received BID_PLACED but no game state');
				return;
			}
			
			// Skip if it's our own bid
			if (event.data.multiplayerPlayerId === myPlayerId) {
				console.log('Skipping own bid event');
				return;
			}
			
			console.log('Processing bid from other player');
			try {
				const player = gameState.getPlayers().find(p => p.id === event.data.playerId);
				const auction = gameState.getCurrentAuction();
				
				if (!player || !auction) {
					console.error('Invalid player or auction state');
					return;
				}
				
				// Find the money cards
				const moneyCards = player.getMoneyHand().filter(c => 
					event.data.moneyCardIds.includes(c.id)
				) as MoneyCard[];
				
				const result = auction.processBid(player, moneyCards);
				console.log('Bid processed, result:', result);

				if (result === AuctionResult.COMPLETE) {
					if (isHost) {
						console.log('Host completing auction');
						completeAuction();
					} else {
						console.log('Auction complete - waiting for host to broadcast final state');
						updateCounter++;
					}
				} else {
					// Move to next player
					let nextIndex = (gameState.getCurrentPlayerIndex() + 1) % gameState.getPlayers().length;
					let attempts = 0;
					while (!auction.getActivePlayers().has(gameState.getPlayers()[nextIndex].id) && attempts < gameState.getPlayers().length) {
						nextIndex = (nextIndex + 1) % gameState.getPlayers().length;
						attempts++;
					}
					gameState.setCurrentPlayerIndex(nextIndex);
					console.log('Next player index:', nextIndex);
					updateCounter++;
				}
			} catch (error) {
				console.error('Failed to process remote bid:', error);
			}
		});

		// ============================================================
		// PASS_AUCTION EVENT - All players (except sender) update their local state
		// ============================================================
		multiplayerService.on(GameEventType.PASS_AUCTION, (event: GameEvent) => {
			console.log('=== PASS_AUCTION EVENT RECEIVED ===');
			console.log('From player:', event.data?.playerName);
			console.log('My Player ID:', myPlayerId);
			
			if (!gameState) {
				console.warn('Received PASS_AUCTION but no game state');
				return;
			}
			
			// Skip if it's our own pass
			if (event.data.multiplayerPlayerId === myPlayerId) {
				console.log('Skipping own pass event');
				return;
			}
			
			console.log('Processing pass from other player');
			try {
				const player = gameState.getPlayers().find(p => p.id === event.data.playerId);
				const auction = gameState.getCurrentAuction();
				
				if (!player || !auction) {
					console.error('Invalid player or auction state');
					return;
				}
				
				// For disgrace auctions, capture all bids BEFORE processPass (which discards money)
				const isDisgrace = currentPhase === GamePhase.DISGRACE_AUCTION;
				if (isDisgrace) {
					disgraceBidSnapshot = gameState.getPlayers().map(p => ({
						playerId: p.id,
						bidAmount: p.getCurrentBidAmount()
					}));
				}
				
				const result = auction.processPass(player);
				console.log('Pass processed, result:', result);

				if (result === AuctionResult.COMPLETE) {
					if (isHost) {
						console.log('Host completing auction');
						completeAuction();
					} else {
						console.log('Auction complete - waiting for host to broadcast final state');
						updateCounter++;
					}
				} else {
					// Move to next player
					let nextIndex = (gameState.getCurrentPlayerIndex() + 1) % gameState.getPlayers().length;
					while (!auction.getActivePlayers().has(gameState.getPlayers()[nextIndex].id)) {
						nextIndex = (nextIndex + 1) % gameState.getPlayers().length;
					}
					gameState.setCurrentPlayerIndex(nextIndex);
					console.log('Next player index:', nextIndex);
					updateCounter++;
				}
			} catch (error) {
				console.error('Failed to process remote pass:', error);
			}
		});

		// ============================================================
		// LUXURY_DISCARDED EVENT - All players (except sender) update their local state
		// ============================================================
		multiplayerService.on(GameEventType.LUXURY_DISCARDED, (event: GameEvent) => {
			console.log('=== LUXURY_DISCARDED EVENT RECEIVED ===');
			console.log('From player:', event.data?.playerName);
			console.log('My Player ID:', myPlayerId);
			
			if (!gameState) {
				console.warn('Received LUXURY_DISCARDED but no game state');
				return;
			}
			
			// Skip if it's our own discard
			if (event.data.multiplayerPlayerId === myPlayerId) {
				console.log('Skipping own luxury discard event');
				return;
			}
			
			console.log('Processing luxury discard from other player');
			try {
				gameState.handleLuxuryDiscard(event.data.playerId, event.data.cardId);
				showLuxuryDiscard = false;
				console.log('Luxury discard processed - waiting for host to broadcast new round');
				updateCounter++;
			} catch (error) {
				console.error('Failed to process remote luxury discard:', error);
			}
		});
		
		// ============================================================
		// AUCTION_COMPLETE EVENT - HOST broadcasts final state, CLIENTS sync
		// ============================================================
		multiplayerService.on(GameEventType.AUCTION_COMPLETE, (event: GameEvent) => {
			console.log('=== AUCTION_COMPLETE EVENT RECEIVED ===');
			console.log('My Role - Is Host:', isHost);
			
			if (!gameState) {
				console.warn('Received AUCTION_COMPLETE but no game state');
				return;
			}
			
			// HOST: Ignore own broadcast
			if (isHost) {
				console.log('HOST: Ignoring own AUCTION_COMPLETE broadcast');
				return;
			}
			
			// CLIENT: Sync game state from host
			console.log('CLIENT: Synchronizing game state from host');
			try {
				// Log the current state before deserialization
				const oldPlayers = gameState.getPlayers();
				console.log('Before deserialization:', oldPlayers.map(p => 
					`${p.name}: bid=${p.getCurrentBidAmount()}, played=${p.getPlayedMoney().length}`
				));
				
				const newState = deserializeGameState(event.data.gameState, gameState);
				gameState = newState;
				
				// Log the new state after deserialization
				const newPlayers = gameState.getPlayers();
				console.log('After deserialization:', newPlayers.map(p => 
					`${p.name}: bid=${p.getCurrentBidAmount()}, played=${p.getPlayedMoney().length}`
				));
				
				// Verify player objects are different
				console.log('Player objects changed:', oldPlayers[0] !== newPlayers[0]);
				
				// Show auction result modal if auction result data is provided
				if (event.data.auctionResult && event.data.auctionResult.card && gameState) {
					const { winnerId, card: serializedCard, winningBid, isDisgrace, losersInfo: serializedLosers } = event.data.auctionResult;
					const winner = winnerId ? gameState.getPlayers().find(p => p.id === winnerId) ?? null : null;
					const card = deserializeStatusCard(serializedCard);
					
					// Reconstruct losersInfo with actual player objects
					const losersInfo = serializedLosers?.map((info: any) => ({
						player: gameState!.getPlayers().find(p => p.id === info.playerId)!,
						bidAmount: info.bidAmount
					})) ?? [];
					
					auctionResultData = { winner, card, winningBid, isDisgrace, losersInfo };
					showAuctionResult = true;
					console.log('CLIENT: Showing auction result modal for card:', card.name);
				}
				
				// Handle luxury discard if needed - only for the client controlling the winner
				if (event.data.needsLuxuryDiscard) {
					const winner = gameState.getPlayers().find(p => p.id === event.data.winnerId);
					if (winner && winner.getLuxuryCards().length > 0) {
						// Only show modal for the client controlling this player
						const myGameIndex = playerIdToGameIndex.get(myPlayerId);
						const winnerGameIndex = gameState.getPlayers().findIndex(p => p.id === winner.id);
						if (myGameIndex === winnerGameIndex) {
							showLuxuryDiscard = true;
							console.log('CLIENT: Showing luxury discard modal for my player');
						} else {
							console.log('CLIENT: Winner needs to discard, but not my player');
						}
					}
				}
				
				updateCounter++;
				console.log('Game state synchronized after auction completion');
			} catch (error) {
				console.error('Failed to sync game state after auction:', error);
			}
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
			// For disgrace auctions, capture all bids BEFORE processPass (which discards money)
			const isDisgrace = currentPhase === GamePhase.DISGRACE_AUCTION;
			if (isDisgrace) {
				disgraceBidSnapshot = gameState.getPlayers().map(p => ({
					playerId: p.id,
					bidAmount: p.getCurrentBidAmount()
				}));
			}
			
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

		console.log('=== COMPLETING AUCTION ===');
		console.log('Is host:', isHost);
		
		// Capture auction result before completing
		const auction = gameState.getCurrentAuction();
		const winner = auction?.getWinner() ?? null;
		const card = auction?.getCard();
		const winningBid = winner?.getCurrentBidAmount() ?? 0;
		const isDisgrace = currentPhase === GamePhase.DISGRACE_AUCTION;
		
		// For disgrace auctions, use the snapshot taken before money was discarded
		let losersInfo: Array<{ player: Player; bidAmount: number }> = [];
		if (isDisgrace && winner && disgraceBidSnapshot && gameState) {
			losersInfo = disgraceBidSnapshot
				.filter(snap => snap.playerId !== winner.id)
				.map(snap => ({
					player: gameState!.getPlayers().find(p => p.id === snap.playerId)!,
					bidAmount: snap.bidAmount
				}))
				// Sort by bid amount descending (highest bids first)
				.sort((a, b) => b.bidAmount - a.bidAmount);
			
			// Clear the snapshot after using it
			disgraceBidSnapshot = null;
		}
		
		// Safety check: non-hosts should not complete auctions in multiplayer
		// They should wait for the host to broadcast the new state
		if (!isHost) {
			console.log('Non-host skipping auction completion, waiting for host broadcast');
			// Show result for non-hosts too
			if (card) {
				auctionResultData = { winner, card, winningBid, isDisgrace, losersInfo };
				showAuctionResult = true;
			}
			updateCounter++;
			return;
		}
		
		// Show auction result modal
		if (card) {
			auctionResultData = { winner, card, winningBid, isDisgrace, losersInfo };
			showAuctionResult = true;
		}
		
		gameState.completeAuction();

		// Check if winner needs to discard luxury card
		const winnerWithPending = gameState.getPlayers().find(p => p.getPendingLuxuryDiscard());
		if (winnerWithPending && winnerWithPending.getLuxuryCards().length > 0) {
			showLuxuryDiscard = true;
			// Force reactivity update
			updateCounter++;
			
			// Host broadcasts luxury discard needed state
			if (isHost) {
				multiplayerService.broadcastEvent(GameEventType.AUCTION_COMPLETE, {
					gameState: serializeGameState(gameState),
					needsLuxuryDiscard: true,
					winnerId: winnerWithPending.id,
					auctionResult: {
						winnerId: winner?.id ?? null,
						winnerName: winner?.name ?? null,
						card: card ? serializeStatusCard(card) : null,
						winningBid,
						isDisgrace,
						losersInfo: losersInfo.map(info => ({
							playerId: info.player.id,
							playerName: info.player.name,
							bidAmount: info.bidAmount
						}))
					}
				});
			}
		} else {
			// Only host starts next round - remote clients wait for broadcast
			if (isHost) {
				// Start next round
				if (gameState.getCurrentPhase() !== GamePhase.SCORING) {
					gameState.startNewRound();
				}
				
				// Broadcast the new round state
				multiplayerService.broadcastEvent(GameEventType.AUCTION_COMPLETE, {
					gameState: serializeGameState(gameState),
					needsLuxuryDiscard: false,
					auctionResult: {
						winnerId: winner?.id ?? null,
						winnerName: winner?.name ?? null,
						card: card ? serializeStatusCard(card) : null,
						winningBid,
						isDisgrace,
						losersInfo: losersInfo.map(info => ({
							playerId: info.player.id,
							playerName: info.player.name,
							bidAmount: info.bidAmount
						}))
					}
				});
				
				// Force reactivity update for host
				updateCounter++;
			}
		}
	}

	function handleLuxuryDiscard(cardId: string) {
		if (!gameState) return;

		const playerWithPending = gameState.getPlayers().find(p => p.getPendingLuxuryDiscard());
		if (playerWithPending) {
			// Only allow the player who needs to discard (using isMyTurn logic)
			const myGameIndex = playerIdToGameIndex.get(myPlayerId);
			const playerGameIndex = gameState.getPlayers().findIndex(p => p.id === playerWithPending.id);
			if (myGameIndex !== playerGameIndex) {
				errorMessage = 'Not your turn to discard!';
				return;
			}
			
			gameState.handleLuxuryDiscard(playerWithPending.id, cardId);
			
			// Broadcast luxury discard
			multiplayerService.broadcastEvent(GameEventType.LUXURY_DISCARDED, {
				playerId: playerWithPending.id,
				multiplayerPlayerId: myPlayerId,
				playerName: playerWithPending.name,
				cardId
			});
		}

		showLuxuryDiscard = false;

		// Start next round
		if (gameState.getCurrentPhase() !== GamePhase.SCORING) {
			gameState.startNewRound();
		}

		// Force reactivity update - also broadcast new state if host
		updateCounter++;
		
		// If host, broadcast the new round state via AUCTION_COMPLETE
		if (isHost && gameState.getCurrentPhase() !== GamePhase.SCORING) {
			multiplayerService.broadcastEvent(GameEventType.AUCTION_COMPLETE, {
				gameState: serializeGameState(gameState),
				needsLuxuryDiscard: false
			});
		}
	}

	function newGame() {
		// Leave room but don't clear session - allow rejoin
		multiplayerService.leaveRoom();
		multiplayerService.disconnect();
		
		// Reset all state
		gameState = null;
		selectedMoneyCards = [];
		errorMessage = '';
		showLuxuryDiscard = false;
		showAuctionResult = false;
		auctionResultData = null;
		updateCounter = 0;
		roomId = '';
		myPlayerId = '';
		myPlayerName = '';
		hostPlayerId = '';
		isHost = false;
		inLobby = true;
		lobbyPlayers = [];
		restartRequested = false;
		playersReady = new Set();
		showRejoinPrompt = false;
		rejoinError = '';
		
		// Show rejoin option immediately
		if (multiplayerService.hasPreviousSession()) {
			showRejoinPrompt = true;
		}
	}

	function startNewGamePermanently() {
		// Permanently clear session and start fresh
		multiplayerService.leaveRoomPermanently();
		multiplayerService.disconnect();
		
		// Reset all state
		gameState = null;
		selectedMoneyCards = [];
		errorMessage = '';
		showLuxuryDiscard = false;
		showAuctionResult = false;
		auctionResultData = null;
		updateCounter = 0;
		roomId = '';
		myPlayerId = '';
		myPlayerName = '';
		hostPlayerId = '';
		isHost = false;
		inLobby = true;
		lobbyPlayers = [];
		restartRequested = false;
		playersReady = new Set();
		showRejoinPrompt = false;
		rejoinError = '';
	}

	async function attemptRejoin() {
		isRejoining = true;
		rejoinError = '';
		
		try {
			await multiplayerService.connect();
			const result = await multiplayerService.rejoinRoom();
			
			// Update state with rejoined room info
			roomId = result.roomId;
			myPlayerId = result.playerId;
			myPlayerName = multiplayerService.getPreviousSession()?.playerName || '';
			lobbyPlayers = result.players;
			showRejoinPrompt = false;
			isRejoining = false;
			
			console.log('Successfully rejoined room:', roomId);
			console.log('Current lobby players:', lobbyPlayers);
			
			// Re-setup multiplayer listeners if needed
			if (!listenersRegistered) {
				setupMultiplayerListeners();
			}
			
			// Restore host player ID from session storage
			const session = multiplayerService.getPreviousSession();
			if (session?.hostPlayerId) {
				hostPlayerId = session.hostPlayerId;
				console.log('Host player ID restored from session:', hostPlayerId);
			} else if (!hostPlayerId && lobbyPlayers.length > 0) {
				// Fallback: assume the first player in the lobby is the host
				hostPlayerId = lobbyPlayers[0].playerId;
				console.log('Host player ID determined from lobby (fallback):', hostPlayerId);
				multiplayerService.updateHostPlayerId(hostPlayerId);
			}
			
			// Check if we're the host
			isHost = hostPlayerId === myPlayerId;
			console.log('Am I the host?', isHost, '(my ID:', myPlayerId, ', host ID:', hostPlayerId, ')');
			
			// Try to restore game state from sessionStorage first
			const restoredFromStorage = restoreGameStateFromStorage();
			
			// If we have game state (either from memory or storage), we were in an active game
			if (gameState && gameState.getCurrentPhase() !== GamePhase.SETUP) {
				inLobby = false;
				console.log('Rejoined active game, staying in game view');
				
				// If we're the host and restored from storage, broadcast to sync other players
				if (isHost && restoredFromStorage) {
					console.log('HOST: Broadcasting restored game state to other players');
					const gamePlayers = gameState.getPlayers();
					const playerMapping = lobbyPlayers.map((lobbyPlayer, index) => ({
						multiplayerId: lobbyPlayer.playerId,
						gamePlayerIndex: index,
						playerName: gamePlayers[index]?.name || lobbyPlayer.playerName
					}));
					
					const eventData = {
						players: gamePlayers.map((p, i) => ({ 
							id: p.id, 
							name: p.name 
						})),
						initialState: serializeGameState(gameState),
						playerMapping: playerMapping
					};
					
					multiplayerService.broadcastEvent(GameEventType.GAME_STARTED, eventData);
				}
				
				// Force UI update
				updateCounter++;
		} else {
			// We don't have game state locally, but the room might have an active game
			// Request game state from other players via STATE_SYNC event
			console.log('No local game state, requesting sync from other players');
			console.log('Am I host?', isHost);
			multiplayerService.broadcastEvent(GameEventType.STATE_SYNC, {
				requesterId: myPlayerId,
				requesterName: myPlayerName
			});
			
			// Stay in lobby temporarily - will be switched to game view when GAME_STARTED arrives
			// But if no game is active, we'll remain in lobby
			inLobby = true;
			console.log('Waiting in lobby for STATE_SYNC response...');
		}			// The connection status will automatically update
		} catch (error) {
			rejoinError = error instanceof Error ? error.message : 'Failed to rejoin room';
			isRejoining = false;
			console.error('Rejoin failed:', error);
		}
	}

	function cancelRejoin() {
		showRejoinPrompt = false;
		rejoinError = '';
		startNewGamePermanently();
	}

	function closeAuctionResult() {
		showAuctionResult = false;
		auctionResultData = null;
	}

	function handlePlayAgain() {
		console.log('=== HOST: REQUESTING PLAY AGAIN ===');
		
		// Reset restart state
		restartRequested = true;
		const newReady = new Set<string>();
		newReady.add(myPlayerId); // Host is automatically ready
		playersReady = newReady;
		
		// Request restart from all clients
		multiplayerService.requestGameRestart();
		
		console.log('Play again requested, waiting for clients to join...');
	}

	function handleRestartReady() {
		console.log('=== CLIENT: JOINING RESTART ===');
		
		// Signal we're ready to restart
		multiplayerService.signalRestartReady();
		const newReady = new Set(playersReady);
		newReady.add(myPlayerId);
		playersReady = newReady;
		
		console.log('Signaled ready for restart');
	}

	function checkAndStartRestart() {
		// Only host can start the game
		if (!isHost) return;
		
		// Check if all players are ready
		const allPlayersReady = lobbyPlayers.every(player => playersReady.has(player.playerId));
		
		if (allPlayersReady) {
			console.log('=== ALL PLAYERS READY - RESTARTING GAME ===');
			
			// Reset restart state
			restartRequested = false;
			playersReady = new Set();
			
			// Start new game with same players
			const playerNames = lobbyPlayers.map(p => p.playerName);
			startGameAsHost(playerNames);
		}
	}

	// Request wake lock when game is active
	async function requestWakeLock() {
		try {
			if ('wakeLock' in navigator) {
				wakeLock = await navigator.wakeLock.request('screen');
				console.log('Screen wake lock activated');
				
				wakeLock.addEventListener('release', () => {
					console.log('Screen wake lock released');
				});
			}
		} catch (err) {
			console.error('Failed to activate screen wake lock:', err);
		}
	}

	// Release wake lock
	async function releaseWakeLock() {
		if (wakeLock) {
			try {
				await wakeLock.release();
				wakeLock = null;
			} catch (err) {
				console.error('Failed to release wake lock:', err);
			}
		}
	}

	// Manage wake lock based on game state
	$effect(() => {
		if (gameState && currentPhase && 
		    currentPhase !== GamePhase.SCORING && 
		    currentPhase !== GamePhase.FINISHED && 
		    !inLobby) {
			// Game is active - request wake lock
			requestWakeLock();
		} else {
			// Game ended or in lobby - release wake lock
			releaseWakeLock();
		}
		
		// Cleanup on unmount
		return () => {
			releaseWakeLock();
		};
	});

	// Re-request wake lock when page becomes visible again (handles tab switching)
	$effect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible' && 
			    gameState && 
			    currentPhase !== GamePhase.SCORING && 
			    currentPhase !== GamePhase.FINISHED && 
			    !inLobby) {
				requestWakeLock();
			}
		};

		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', handleVisibilityChange);
			
			return () => {
				document.removeEventListener('visibilitychange', handleVisibilityChange);
			};
		}
	});

	$effect(() => {
		if (gameState && gameState.getCurrentPhase() === GamePhase.SCORING) {
			// Game has ended, scoring will be displayed
		}
	});

	// Auto-save game state to sessionStorage whenever it changes
	$effect(() => {
		if (gameState && roomId && gameState.getCurrentPhase() !== GamePhase.SETUP) {
			saveGameStateToStorage();
		}
	});

	// Monitor connection status and show rejoin prompt if disconnected
	$effect(() => {
		const isConnected = multiplayerService.isConnected();
		const hasPreviousSession = multiplayerService.hasPreviousSession();
		
		// Show rejoin prompt if:
		// 1. We're disconnected
		// 2. We have a previous session
		// 3. We're not already showing the prompt
		// 4. We're not in lobby mode (meaning we were in a game)
		if (!isConnected && hasPreviousSession && !showRejoinPrompt && !inLobby) {
			console.log('Connection lost - showing rejoin prompt');
			showRejoinPrompt = true;
		}
	});

	// Clear selected cards when current player changes
	$effect(() => {
		if (currentPlayerObj) {
			// Clear any selected cards when player changes
			selectedMoneyCards = [];
		}
	});

	// Warn before leaving an active game
	$effect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			// Only warn if we have an active game (not in lobby, not finished)
			if (gameState && 
			    !inLobby && 
			    currentPhase !== GamePhase.SCORING && 
			    currentPhase !== GamePhase.FINISHED) {
				e.preventDefault();
				// Modern browsers ignore custom messages, but we still need to set returnValue
				e.returnValue = '';
				return '';
			}
		};

		if (typeof window !== 'undefined') {
			window.addEventListener('beforeunload', handleBeforeUnload);
			
			return () => {
				window.removeEventListener('beforeunload', handleBeforeUnload);
			};
		}
	});
</script>

<UpdatePrompt />

<main class="container">
	<header class="main-header">
		<div class="header-content">
			{#if gameState && currentPhase !== GamePhase.SCORING && currentPhase !== GamePhase.FINISHED}
				<div class="header-end-game">
					<button onclick={newGame} class="end-game-button outline secondary" aria-label="Leave game">
						← Leave Game
					</button>
				</div>
			{/if}
			<div class="header-left">
				<h1>High Society</h1>
				{#if !gameState}
					<p class="tagline">Online Multiplayer Card Game</p>
				{/if}
			</div>
			{#if gameState && roomId}
				<div class="header-right">
					<div class="status-group">
						<span class="room-info">Room: <strong>{roomId}</strong></span>
						<span class="connection-icon {multiplayerService.isConnected() ? 'connected' : 'disconnected'}"
						      title={multiplayerService.isConnected() ? 'Connected to Server' : 'Disconnected from Server'}>
							{#if multiplayerService.isConnected()}
								<Wifi size={16} />
							{:else}
								<WifiOff size={16} />
							{/if}
						</span>
					</div>
				</div>
			{/if}
		</div>
	</header>

	{#if !gameState && !roomId}
		<!-- Multiplayer Setup - Creating or joining room -->
		<article class="game-intro">
			<header>
				<h2>Welcome to High Society</h2>
			</header>
			<section>
				<p>
					<strong>High Society</strong> is an auction card game designed by Reiner Knizia where you play as wealthy socialites 
					competing to acquire the most luxurious items and prestigious status symbols.
				</p>
				<p>
					<strong>The catch?</strong> You must avoid going broke! At the end of the game, the player with the least money 
					is cast out of high society and cannot win — no matter how many luxury items they've acquired.
				</p>
				<p>
					<strong>Gameplay:</strong> Each round, a status card is revealed. Players bid using their money cards to win luxury items 
					and prestige multipliers, while avoiding disgrace cards. The game ends when the 4th special trigger card appears.
				</p>
				<div class="rules-link">
					<small>
						Learn the full rules in the 
						<a href="https://github.com/avanderw/high-society/blob/main/20251001T142857_high-society-rules_0b8224f9.md" target="_blank" rel="noopener noreferrer">
							game documentation
						</a>
					</small>
				</div>
			</section>
		</article>
		
		<MultiplayerSetup onRoomReady={handleMultiplayerRoomReady} initialRoomCode={$page.url.searchParams.get('room') || ''} />
	{:else if !gameState && roomId}
		<!-- Multiplayer Lobby - Waiting for game to start or rejoin active game -->
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
						<span class="status-badge connected">?? Connected to Server</span>
					{:else}
						<span class="status-badge disconnected">?? Disconnected</span>
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
							{#if !connectedPlayerIds.has(player.playerId)}
								<span class="badge-disconnected">Offline</span>
							{/if}
						</li>
					{/each}
				</ul>
			</div>

			{#if isHost}
				<div class="host-controls">
					<p>You are the host. Start the game when everyone is ready.</p>
					<button 
						onclick={() => startGameAsHost(lobbyPlayers.map(p => p.playerName))}
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
					<p>? Waiting for the game to start or sync...</p>
					<progress></progress>
					<small class="help-text">If the game is already active, you'll join automatically</small>
				</div>
			{/if}

			<button onclick={newGame} class="secondary">
				Leave Lobby
			</button>
		</article>
	{:else if gameState && (currentPhase === GamePhase.SCORING || currentPhase === GamePhase.FINISHED)}
		{#if restartRequested}
			<!-- Restart lobby screen -->
			<article class="restart-lobby">
				<header>
					<h2>?? Play Again?</h2>
				</header>

				<div class="restart-info">
					<p>The host wants to play another round with the same players!</p>
					
					<div class="player-ready-list">
						<h3>Players Ready ({playersReady.size}/{lobbyPlayers.length})</h3>
						<ul>
							{#each lobbyPlayers as player}
								<li class="player-item">
									<span class="player-name">{player.playerName}</span>
									{#if playersReady.has(player.playerId)}
										<span class="badge-ready">? Ready</span>
									{:else}
										<span class="badge-waiting">? Waiting</span>
									{/if}
									{#if player.playerId === myPlayerId}
										<span class="badge-you">You</span>
									{/if}
								</li>
							{/each}
						</ul>
					</div>

					{#if !playersReady.has(myPlayerId)}
						<button onclick={handleRestartReady} class="primary">
							? I'm Ready to Play Again
						</button>
					{:else if isHost}
						<div class="waiting-message">
							<p>? Waiting for all players to be ready...</p>
							<progress></progress>
						</div>
					{:else}
						<div class="waiting-message">
							<p>? You're ready! Waiting for others...</p>
							<progress></progress>
						</div>
					{/if}

					<button onclick={newGame} class="secondary">
						Leave Room
					</button>
				</div>
			</article>
		{:else}
			<ScoreBoard 
				players={allPlayers} 
				scoringService={new GameScoringService()}
				onNewGame={newGame}
				isHost={isHost}
				onPlayAgain={handlePlayAgain}
				isMultiplayer={true}
			/>
		{/if}
	{:else if gameState}
		<div class="game-container">
			{#if errorMessage}
				<article style="background-color: var(--pico-del-color); margin-bottom: 1rem;">
					<p><strong>Error:</strong> {errorMessage}</p>
				</article>
			{/if}

			<!-- Primary auction controls - side by side layout -->
			<div class="auction-controls-grid">
				{#if currentCard}
					<article class="auction-card-panel">
						<header>
							<hgroup>
								<h3>Current Auction</h3>
								<p>
									{#if currentPhase === GamePhase.DISGRACE_AUCTION}
										<span class="warning-text" style="margin-top: 1rem">⚠️ Disgrace! Bid to avoid this card</span>
									{:else}
										Bid to win this luxury item
									{/if}
								</p>
							</hgroup>
							{#if currentPlayerObj}
								{#key `${currentPlayerIndex}-${isMyTurn}`}
									{#if isMyTurn}
										<div class="turn-status your-turn">
											<Target size={16} class="turn-icon" />
											<span class="turn-text">Your Turn</span>
										</div>
									{:else}
										<div class="turn-status waiting">
											<Clock size={16} class="turn-icon" />
											<span class="turn-text">{currentPlayerObj.name}'s Turn</span>
										</div>
									{/if}
								{/key}
							{/if}
						</header>

						<section class="card-display-compact">
							<div class="status-card-large {currentPhase === GamePhase.DISGRACE_AUCTION ? 'disgrace' : 'luxury'}">
								<h2>{currentCard.name}</h2>
								<div class="card-value">
									{currentCard.getDisplayValue()}
								</div>
							</div>
						</section>

						<footer class="game-info-compact">
							<small>
								Triggers: {gameEndTriggerCount} / 4
								• Cards Left: {remainingStatusCards}
							</small>
						</footer>
					</article>
				{/if}

				{#if localPlayer}
					<PlayerHand 
						player={localPlayer}
						selectedCards={selectedMoneyCards}
						onToggleCard={toggleMoneyCard}
						updateKey={updateCounter}
						isMyTurn={isMyTurn}
						auction={currentAuction ?? null}
						onBid={placeBid}
						onPass={pass}
						isMultiplayer={true}
						remainingStatusCards={remainingStatusCards}
					/>
				{/if}
			</div>

			<!-- Secondary information - player status below -->
			{#if currentPlayerObj && currentPlayerIndex !== undefined}
				<AuctionPanel 
					auction={currentAuction ?? null}
					currentPlayer={currentPlayerObj}
					currentPlayerIndex={currentPlayerIndex}
					allPlayers={allPlayers}
					updateKey={updateCounter}
					connectedPlayerIds={connectedPlayerIds}
					playerIdToGameIndex={playerIdToGameIndex}
				/>
			{/if}

			{#if showLuxuryDiscard}
				{#each allPlayers as player}
					{#if player.getPendingLuxuryDiscard() && player.getLuxuryCards().length > 0}
						{@const myGameIndex = playerIdToGameIndex.get(myPlayerId)}
						{@const playerGameIndex = allPlayers.findIndex(p => p.id === player.id)}
						{#if myGameIndex === playerGameIndex}
							<LuxuryDiscardModal 
								player={player}
								onDiscard={handleLuxuryDiscard}
							/>
						{/if}
					{/if}
				{/each}
			{/if}

			{#if showAuctionResult && auctionResultData}
				<AuctionResultModal 
					winner={auctionResultData.winner}
					card={auctionResultData.card}
					winningBid={auctionResultData.winningBid}
					isDisgrace={auctionResultData.isDisgrace}
					losersInfo={auctionResultData.losersInfo}
					onClose={closeAuctionResult}
				/>
			{/if}
		</div>
	{/if}

	<!-- Rejoin Prompt Modal -->
	{#if showRejoinPrompt}
		<dialog open class="rejoin-modal">
			<article>
				<header>
					<h3>Rejoin Previous Game?</h3>
				</header>
				<section>
					<p>You left a game in progress.</p>
					{#if rejoinError}
						<div role="alert" class="rejoin-error">
							<strong>Error:</strong> {rejoinError}
						</div>
					{/if}
					{#if multiplayerService.getPreviousSession()}
						<div class="session-info">
							<p><strong>Room:</strong> {multiplayerService.getPreviousSession()?.roomId}</p>
							<p><strong>Player:</strong> {multiplayerService.getPreviousSession()?.playerName}</p>
						</div>
					{/if}
					<p>Would you like to rejoin your previous game or start a new one?</p>
				</section>
				<footer>
					<div class="button-group">
						<button 
							onclick={attemptRejoin}
							disabled={isRejoining}
							class="primary"
						>
							{isRejoining ? 'Rejoining...' : '🔄 Rejoin Game'}
						</button>
						<button 
							onclick={cancelRejoin}
							disabled={isRejoining}
							class="secondary"
						>
							🆕 Start New Game
						</button>
					</div>
				</footer>
			</article>
		</dialog>
	{/if}
</main>

<style>
	main {
		padding: 0.5rem;
	}

	@media (min-width: 768px) {
		main {
			padding: 2rem 1rem;
		}
	}

	.main-header {
		position: sticky;
		top: 0;
		z-index: 100;
		background-color: var(--pico-background-color);
		margin-bottom: 0.75rem;
		padding: 0.25rem 0 0.5rem 0;
		border-bottom: 1px solid var(--pico-muted-border-color);
	}

	@media (min-width: 768px) {
		.main-header {
			position: relative;
			margin-bottom: 1.5rem;
			padding-bottom: 0.5rem;
		}
	}

	.header-content {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.5rem;
	}

	@media (min-width: 768px) {
		.header-content {
			gap: 1rem;
		}
	}

	.header-end-game {
		display: flex;
		align-items: center;
	}

	.header-left {
		flex: 1;
		min-width: 0;
		text-align: left;
	}

	.header-left h1 {
		margin-bottom: 0;
		font-size: clamp(1rem, 4vw, 2rem);
		color: var(--pico-primary);
	}

	.tagline {
		margin: 0.25rem 0 0 0;
		font-size: clamp(0.65rem, 1.8vw, 0.875rem);
		color: var(--pico-muted-color);
	}

	@media (min-width: 768px) {
		.header-left h1 {
			margin-bottom: 0.5rem;
			font-size: 2rem;
		}
		
		.tagline {
			font-size: 1rem;
		}
	}

	.header-right {
		display: flex;
		justify-content: flex-end;
	}

	.turn-status {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--pico-border-radius);
		font-size: clamp(0.75rem, 2vw, 0.875rem);
		font-weight: 600;
		white-space: nowrap;
		transition: all 0.3s ease;
		margin-top: 0.5rem;
		width: fit-content;
	}

	@media (min-width: 768px) {
		.turn-status {
			gap: 0.5rem;
			padding: 0.375rem 0.75rem;
			font-size: 0.875rem;
		}
	}

	.turn-status.your-turn {
		background-color: var(--pico-ins-color);
		color: var(--pico-contrast);
		animation: pulse-glow 2s infinite;
	}

	.turn-status.waiting {
		background-color: rgba(128, 128, 128, 0.15);
		color: var(--pico-muted-color);
	}

	.turn-status :global(.turn-icon) {
		flex-shrink: 0;
	}

	.turn-status.your-turn :global(.turn-icon) {
		animation: bounce-icon 1s infinite;
	}

	.turn-status.waiting :global(.turn-icon) {
		animation: rotate-icon 2s linear infinite;
	}

	.turn-text {
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 15ch;
	}

	@media (min-width: 768px) {
		.turn-text {
			max-width: 20ch;
		}
	}

	.status-group {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	@media (min-width: 768px) {
		.status-group {
			gap: 0.5rem;
		}
	}

	.room-info {
		display: inline-flex;
		align-items: center;
		font-size: clamp(0.7rem, 1.8vw, 0.8rem);
		color: var(--pico-muted-color);
		white-space: nowrap;
	}

	.room-info strong {
		color: var(--pico-primary);
		font-family: var(--pico-font-family-monospace);
		margin-left: 0.25rem;
	}

	@media (min-width: 768px) {
		.room-info {
			font-size: 0.875rem;
		}
	}

	.connection-icon {
		display: inline-flex;
		align-items: center;
	}

	.connection-icon.connected {
		color: var(--pico-ins-color);
		animation: pulse-subtle 3s infinite;
	}

	.connection-icon.disconnected {
		color: var(--pico-del-color);
		animation: pulse-urgent 1s infinite;
	}

	@keyframes pulse-glow {
		0%, 100% {
			opacity: 1;
			box-shadow: 0 0 0 rgba(0, 255, 0, 0);
		}
		50% {
			opacity: 0.95;
			box-shadow: 0 0 8px rgba(0, 255, 0, 0.3);
		}
	}

	@keyframes bounce-icon {
		0%, 100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-3px);
		}
	}

	@keyframes rotate-icon {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes pulse-subtle {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	@keyframes pulse-urgent {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	.end-game-button {
		font-size: clamp(0.65rem, 1.8vw, 0.75rem);
		padding: 0.25rem 0.5rem;
		margin: 0;
		background-color: transparent;
		border-color: var(--pico-muted-border-color);
		color: var(--pico-muted-color);
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.end-game-button:hover {
		border-color: var(--pico-del-color);
		color: var(--pico-del-color);
		background-color: rgba(255, 0, 0, 0.05);
	}

	@media (min-width: 768px) {
		.end-game-button {
			font-size: 0.875rem;
			padding: 0.5rem 1rem;
		}
	}

	header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	@media (min-width: 768px) {
		header {
			margin-bottom: 2rem;
		}
	}

	.game-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	@media (min-width: 768px) {
		.game-container {
			gap: 1.5rem;
		}
	}

	.auction-controls-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	@media (min-width: 768px) {
		.auction-controls-grid {
			grid-template-columns: auto 1fr;
			gap: 1.5rem;
			align-items: start;
		}
	}

	.auction-card-panel {
		min-width: 0;
	}

	@media (min-width: 768px) {
		.auction-card-panel {
			min-width: 250px;
			max-width: 300px;
		}
	}

	.warning-text {
		display: inline-block;
		color: var(--pico-del-color);
		background-color: rgba(255, 0, 0, 0.1);
		padding: 0.25rem 0.5rem;
		border-radius: var(--pico-border-radius);
		font-size: clamp(0.75rem, 1.8vw, 0.875rem);
		font-weight: 600;
		border: 1px solid var(--pico-del-color);
	}

	@media (min-width: 768px) {
		.warning-text {
			padding: 0.375rem 0.75rem;
		}
	}

	.card-display-compact {
		display: flex;
		justify-content: center;
		padding: 1rem 0;
	}

	.status-card-large {
		width: min(180px, 80vw);
		padding: 1rem;
		border: 3px solid var(--pico-primary);
		border-radius: var(--pico-border-radius);
		text-align: center;
		background: var(--pico-card-background-color);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}

	@media (min-width: 768px) {
		.status-card-large {
			width: 200px;
			padding: 1.5rem;
		}
	}

	.status-card-large.disgrace {
		border-color: var(--pico-del-color);
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(255, 0, 0, 0.1) 100%);
	}

	.status-card-large h2 {
		margin: 0 0 0.75rem 0;
		font-size: clamp(1.1rem, 4vw, 1.4rem);
	}

	.card-value {
		font-size: clamp(1.75rem, 8vw, 2.5rem);
		font-weight: bold;
		color: var(--pico-primary);
	}

	.status-card-large.disgrace .card-value {
		color: var(--pico-del-color);
	}

	.game-info-compact {
		margin-top: 0;
		padding-top: 0.75rem;
		border-top: 1px solid var(--pico-muted-border-color);
	}

	.game-info-compact small {
		display: block;
		text-align: center;
		font-size: clamp(0.7rem, 1.8vw, 0.8rem);
	}

	/* Removed old .multiplayer-info - now using header-right */

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
		font-size: clamp(1.25rem, 4vw, 1.5rem);
		font-weight: bold;
		font-family: var(--pico-font-family-monospace);
		letter-spacing: 0.1em;
		padding: 0.75rem;
		background-color: var(--pico-code-background-color);
		border-radius: var(--pico-border-radius);
		user-select: all;
		word-break: break-all;
		cursor: pointer;
	}

	@media (min-width: 768px) {
		.room-code-large {
			padding: 1rem;
		}
	}

	.room-code-large:active {
		background-color: var(--pico-primary);
		color: var(--pico-primary-inverse);
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

	.badge-disconnected {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background-color: var(--pico-muted-color);
		color: var(--pico-contrast);
		border-radius: var(--pico-border-radius);
		font-size: 0.75rem;
		font-weight: bold;
		opacity: 0.7;
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

	/* Restart Lobby Styles */
	.restart-lobby {
		max-width: 600px;
		margin: 0 auto;
	}

	.restart-info {
		text-align: center;
	}

	.restart-info > p {
		margin-bottom: 2rem;
		font-size: 1.1rem;
		color: var(--pico-primary);
	}

	.player-ready-list {
		margin: 2rem 0;
		text-align: left;
	}

	.player-ready-list h3 {
		margin-bottom: 1rem;
		color: var(--pico-primary);
		text-align: center;
	}

	.badge-ready {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background-color: var(--pico-ins-color);
		color: var(--pico-contrast);
		border-radius: var(--pico-border-radius);
		font-size: 0.75rem;
		font-weight: bold;
	}

	.badge-waiting {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background-color: var(--pico-muted-color);
		color: var(--pico-contrast);
		border-radius: var(--pico-border-radius);
		font-size: 0.75rem;
		font-weight: bold;
	}

	/* Rejoin Modal */
	.rejoin-modal {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		margin: 0;
		padding: 1rem;
	}

	.rejoin-modal article {
		max-width: 500px;
		width: 100%;
		margin: 0;
		animation: slideDown 0.3s ease-out;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.rejoin-modal section {
		text-align: center;
	}

	.rejoin-modal section p {
		margin: 1rem 0;
	}

	.session-info {
		background-color: var(--pico-card-sectioning-background-color);
		padding: 1rem;
		border-radius: var(--pico-border-radius);
		margin: 1rem 0;
	}

	.session-info p {
		margin: 0.5rem 0;
		font-size: 0.9rem;
	}

	.rejoin-error {
		background-color: var(--pico-del-color);
		color: var(--pico-contrast);
		padding: 0.75rem;
		border-radius: var(--pico-border-radius);
		margin: 1rem 0;
	}

	.rejoin-modal .button-group {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.rejoin-modal .button-group button {
		flex: 1;
		margin: 0;
	}

	/* Game Intro Styles */
	.game-intro {
		max-width: 700px;
		margin: 0 auto 2rem auto;
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(var(--pico-primary-rgb, 128, 128, 255), 0.05) 100%);
		border: 2px solid var(--pico-primary);
	}

	.game-intro p {
		margin-bottom: 1rem;
		line-height: 1.6;
	}

	.game-intro strong {
		color: var(--pico-primary);
	}

	.rules-link {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--pico-muted-border-color);
		text-align: center;
	}

	.rules-link a {
		color: var(--pico-primary);
		text-decoration: underline;
		font-weight: 500;
	}

	.rules-link a:hover {
		color: var(--pico-primary-hover);
	}
</style>
