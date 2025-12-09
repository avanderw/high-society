/**
 * Multiplayer Orchestrator v2 - Matches actual implementation
 * Handles multiplayer event synchronization
 */

import type { GameState } from '$lib/domain/gameState';
import type { Player } from '$lib/domain/player';
import type { StatusCard } from '$lib/domain/cards';
import { GameEventType, type GameEvent } from '$lib/multiplayer/events';
import type { MultiplayerService } from '$lib/multiplayer/service';
import { serializeGameState, deserializeGameState, type SerializedGameState } from '$lib/multiplayer/serialization';
import type { ReactiveGameStore } from '$lib/stores/reactiveGameStore.svelte';
import { logger } from '$lib/utils/logger';

const ctx = 'MultiplayerOrchestrator';

export class MultiplayerOrchestrator {
	private processedEvents = new Set<string>();
	private onAuctionCompleteCallback?: (
		gameState: GameState,
		auctionResultData: {
			winnerId: string;
			winnerName: string;
			card: { id: string; name: string; value?: number };
			winningBid: number;
			isDisgrace: boolean;
			losersInfo?: Array<{ playerId: string; playerName: string; bidAmount: number }>;
		}
	) => void;
	
	constructor(
		private service: MultiplayerService,
		private store: ReactiveGameStore
	) {}
	
	/**
	 * Set callback for when auction completes (called on non-acting players)
	 */
	setOnAuctionComplete(callback: (
		gameState: GameState,
		auctionResultData: {
			winnerId: string;
			winnerName: string;
			card: { id: string; name: string; value?: number };
			winningBid: number;
			isDisgrace: boolean;
			losersInfo?: Array<{ playerId: string; playerName: string; bidAmount: number }>;
		}
	) => void) {
		this.onAuctionCompleteCallback = callback;
	}
	
	/**
	 * Setup all multiplayer event listeners
	 */
	setupEventListeners() {
		// Game lifecycle events
		this.service.on(GameEventType.STATE_SYNC, this.handleStateSync.bind(this));
		
		// Auction events
		this.service.on(GameEventType.BID_PLACED, this.handleBidPlaced.bind(this));
		this.service.on(GameEventType.PASS_AUCTION, this.handlePassAuction.bind(this));
		this.service.on(GameEventType.AUCTION_COMPLETE, this.handleAuctionComplete.bind(this));
		this.service.on(GameEventType.LUXURY_DISCARDED, this.handleLuxuryDiscarded.bind(this));
		
		// Other events
		this.service.on(GameEventType.TURN_TIMEOUT, this.handleTurnTimeout.bind(this));
	}
	
	// === Broadcast methods (called by local player) ===
	
	broadcastGameStart(playerNames: string[], lobbyIndexToGameIndex: number[], seed: number) {
		this.service.broadcastEvent(GameEventType.GAME_STARTED, {
			playerNames,
			lobbyIndexToGameIndex,
			seed
		});
	}
	
	broadcastBid(cardIds: string[]) {
		const gameState = this.store.gameState;
		if (!gameState) {
			logger.warn(ctx, 'broadcastBid() - Cannot broadcast bid - no gameState available');
			return;
		}
		
		this.service.broadcastEvent(GameEventType.BID_PLACED, {
			currentPlayerIndex: gameState.getCurrentPlayerIndex(),
			cardIds,
			timestamp: Date.now()
		});
	}

broadcastPass(passingPlayerIndex?: number) {
	const gameState = this.store.gameState;
	if (!gameState) {
		logger.warn(ctx, 'broadcastPass() - Cannot broadcast pass - no gameState available');
		return;
	}
	
	// Use provided index or fall back to current (for client broadcasts before execution)
	const playerIndex = passingPlayerIndex ?? gameState.getCurrentPlayerIndex();
	
	const passData = {
		currentPlayerIndex: playerIndex,
		timestamp: Date.now()
	};
	
	logger.debug(ctx, 'broadcastPass() - Broadcasting pass', passData);
	
	this.service.broadcastEvent(GameEventType.PASS_AUCTION, passData);
}

broadcastAuctionComplete(auctionResultData?: {
		winner: Player;
		card: StatusCard;
		winningBid: number;
		isDisgrace: boolean;
		losersInfo?: Array<{ player: Player; bidAmount: number }>;
	}) {
		const gameState = this.store.gameState;
		if (!gameState) {
			logger.warn(ctx, 'broadcastAuctionComplete() - Cannot broadcast auction complete - no gameState available');
			return;
		}
		
		const serialized = serializeGameState(gameState);
		this.service.broadcastEvent(GameEventType.AUCTION_COMPLETE, {
			gameState: serialized,
			auctionResultData: auctionResultData ? {
				winnerId: auctionResultData.winner.id,
				winnerName: auctionResultData.winner.name,
				card: {
					id: auctionResultData.card.id,
					name: auctionResultData.card.name,
					value: 'value' in auctionResultData.card ? auctionResultData.card.value : undefined
				},
				winningBid: auctionResultData.winningBid,
				isDisgrace: auctionResultData.isDisgrace,
				losersInfo: auctionResultData.losersInfo?.map(info => ({
					playerId: info.player.id,
					playerName: info.player.name,
					bidAmount: info.bidAmount
				}))
			} : undefined,
			timestamp: Date.now()
		});
	}
	
	broadcastLuxuryDiscard(cardId: string) {
		const gameState = this.store.gameState;
		const localPlayer = this.store.localPlayer;
		if (!gameState || !localPlayer) {
			logger.warn(ctx, 'broadcastLuxuryDiscard() - Cannot broadcast luxury discard - missing gameState or localPlayer');
			return;
		}
		
		this.service.broadcastEvent(GameEventType.LUXURY_DISCARDED, {
			playerId: localPlayer.id,
			cardId,
			timestamp: Date.now()
		});
	}
	
	broadcastStateSync() {
		const gameState = this.store.gameState;
		if (!gameState) {
			logger.warn(ctx, 'broadcastStateSync() - Cannot broadcast state sync - no gameState available');
			return;
		}
		
		const serialized = serializeGameState(gameState);
		this.service.broadcastEvent(GameEventType.STATE_SYNC, {
			gameState: serialized,
			timestamp: Date.now()
		});
	}
	
	// === Event handlers (received from other players) ===
	
	// NOTE: Game initialization is handled by the UI layer (+page.svelte) via store.initialize.
	// The orchestrator should not re-initialize the store on GAME_STARTED, as that would
	// rebuild the host's GameState/statusDeck and cause desync. We keep this method removed
	// and rely on the UI to wire GAME_STARTED appropriately for clients only.
	
	private handleStateSync(event: GameEvent) {
		if (!this.shouldProcessEvent(event)) return;
		
		// Host should never process state sync (it would replace real deck with dummy deck)
		if (this.service.isHost()) {
			logger.debug(ctx, 'handleStateSync() - Skipping state sync for host');
			return;
		}
		
		const { gameState: serialized } = event.data as { gameState: SerializedGameState };
		const deserialized = deserializeGameState(serialized);
		this.store.updateFromSerialized(deserialized);
	}
	
	private handleBidPlaced(event: GameEvent) {
		if (!this.shouldProcessEvent(event)) return;
		
		const { currentPlayerIndex, cardIds } = event.data as { 
			currentPlayerIndex: number; 
			cardIds: string[];
		};
		
		const gameState = this.store.gameState;
		if (!gameState) {
			logger.debug(ctx, 'handleBidPlaced() - No gameState, ignoring');
			return;
		}
		
		logger.debug(ctx, 'handleBidPlaced() - Received bid event', {
			currentPlayerIndex,
			cardIds,
			gameCurrentPlayerIndex: gameState.getCurrentPlayerIndex(),
			isHost: this.service.isHost()
		});
		
		// Check if this is our own bid being echoed back
		const myIndex = this.store.playerIdToGameIndex.get(this.store.myPlayerId);
		if (myIndex === currentPlayerIndex) {
			// This is our own bid being echoed back, skip
			logger.debug(ctx, 'handleBidPlaced() - Skipping own bid echo');
			return;
		}
		
		// If we're the host, execute the bid logic on behalf of the client
		if (this.service.isHost()) {
			// Verify it's actually the current player's turn
			if (gameState.getCurrentPlayerIndex() === currentPlayerIndex) {
				logger.debug(ctx, 'handleBidPlaced() - HOST executing bid for player', { currentPlayerIndex, cardIds });
				
				// Execute the bid with the exact cards the client selected
				const result = this.store.placeBid(cardIds);
				
				if (result.success) {
					// Broadcast the state sync to all clients
					this.broadcastStateSync();
					
					// If auction completed, handle starting new round
					if (result.auctionComplete && result.auctionResultData) {
						// Start new round if no luxury discard needed
						if (!result.needsLuxuryDiscard) {
							logger.debug(ctx, 'handleBidPlaced() - Starting new round');
							const newRoundResult = this.store.startNewRound();
							
							if (newRoundResult.success) {
								logger.debug(ctx, 'handleBidPlaced() - New round started successfully');
								// Broadcast auction complete with the new game state
								this.broadcastAuctionComplete(result.auctionResultData);
								this.broadcastStateSync();
							} else {
								logger.debug(ctx, 'handleBidPlaced() - Game ended');
								// Game over
								this.broadcastAuctionComplete(result.auctionResultData);
							}
						} else {
							// Luxury discard needed - just broadcast completion
							// New round will start after luxury discard
							logger.debug(ctx, 'handleBidPlaced() - Waiting for luxury discard');
							this.broadcastAuctionComplete(result.auctionResultData);
						}
					}
				} else {
					logger.warn(ctx, 'handleBidPlaced() - Bid failed', { error: result.error });
				}
			} else {
				logger.debug(ctx, 'handleBidPlaced() - Player index mismatch - ignoring bid', { 
					expected: gameState.getCurrentPlayerIndex(), 
					got: currentPlayerIndex 
				});
			}
		} else {
			// Clients will receive the STATE_SYNC from host
			logger.debug(ctx, 'handleBidPlaced() - Client received bid, waiting for STATE_SYNC');
			this.store.forceUpdate();
		}
	}
	
private handlePassAuction(event: GameEvent) {
	if (!this.shouldProcessEvent(event)) {
		logger.debug(ctx, 'handlePassAuction() - Event filtered by shouldProcessEvent');
		return;
	}
	
	const gameState = this.store.gameState;
	if (!gameState) {
		logger.warn(ctx, 'handlePassAuction() - Cannot process pass - no gameState available');
		return;
	}
	
	logger.debug(ctx, 'handlePassAuction() - Processing pass event', {
		isHost: this.service.isHost(),
		eventData: event.data,
		currentGamePlayerIndex: gameState.getCurrentPlayerIndex()
	});
	
	// If we're the host, execute the pass logic on behalf of the client
	if (this.service.isHost()) {
		const { currentPlayerIndex } = event.data as { currentPlayerIndex: number };
		
		// Verify it's actually the current player's turn
		if (gameState.getCurrentPlayerIndex() === currentPlayerIndex) {
			logger.debug(ctx, 'handlePassAuction() - HOST executing pass for player', { currentPlayerIndex });
			
			// Execute the pass
			const result = this.store.pass();				if (result.success) {
					// Broadcast the state sync to all clients
					this.broadcastStateSync();
					
					// If auction completed, handle starting new round
					if (result.auctionComplete && result.auctionResultData) {
						// Start new round if no luxury discard needed
						if (!result.needsLuxuryDiscard) {
							logger.debug(ctx, 'handlePassAuction() - Starting new round');
							const newRoundResult = this.store.startNewRound();
							
							if (newRoundResult.success) {
								logger.debug(ctx, 'handlePassAuction() - New round started successfully');
								// Broadcast auction complete with the new game state
								this.broadcastAuctionComplete(result.auctionResultData);
								this.broadcastStateSync();
							} else {
								logger.debug(ctx, 'handlePassAuction() - Game ended', { error: newRoundResult.error });
								// Game over
								this.broadcastAuctionComplete(result.auctionResultData);
							}
						} else {
							// Luxury discard needed - just broadcast completion
							// New round will start after luxury discard
							logger.debug(ctx, 'handlePassAuction() - Waiting for luxury discard');
							this.broadcastAuctionComplete(result.auctionResultData);
						}
					}
				}
			}
		}
		// Clients will receive the STATE_SYNC from host
	}
	
	private handleAuctionComplete(event: GameEvent) {
		if (!this.shouldProcessEvent(event)) return;
		
		const { gameState: serialized, auctionResultData } = event.data as { 
			gameState: SerializedGameState;
			auctionResultData?: {
				winnerId: string;
				winnerName: string;
				card: { id: string; name: string; value?: number };
				winningBid: number;
				isDisgrace: boolean;
				losersInfo?: Array<{ playerId: string; playerName: string; bidAmount: number }>;
			}
		};

		logger.debug(ctx, 'handleAuctionComplete() - Received event', { 
			hasAuctionResultData: !!auctionResultData, 
			hasCurrentAuction: !!serialized.currentAuction 
		});

		// Host: already executed auction logic and (if applicable) started the next round.
		// Do NOT deserialize or overwrite the authoritative GameState here, or we'll lose
		// the real statusDeck and may hit "No more status cards" on the next startNewRound.
		// However, we DO want to show the auction result modal.
		if (this.service.isHost()) {
			// Show the auction result modal for the host
			if (auctionResultData && this.onAuctionCompleteCallback && this.store.gameState) {
				this.onAuctionCompleteCallback(this.store.gameState, auctionResultData);
			}
			return;
		}

		// Clients: reconstruct state from serialized snapshot (with dummy deck) and update store.
		const deserialized = deserializeGameState(serialized);
		this.store.updateFromSerialized(deserialized);
		
		// Trigger callback with auction result data (for non-acting players)
		if (this.onAuctionCompleteCallback && auctionResultData) {
			this.onAuctionCompleteCallback(deserialized, auctionResultData);
		}
	}
	
	private handleLuxuryDiscarded(event: GameEvent) {
		if (!this.shouldProcessEvent(event)) {
			logger.debug(ctx, 'handleLuxuryDiscarded() - Event filtered by shouldProcessEvent');
			return;
		}
		
		const { cardId, playerId } = event.data as { cardId: string; playerId: string };
		
		// Host executes game logic, clients wait for STATE_SYNC
		if (this.service.isHost()) {
			logger.debug(ctx, 'handleLuxuryDiscarded() - HOST processing luxury discard', { playerId, cardId });
			
			// Execute the luxury discard
			const discardResult = this.store.handleLuxuryDiscard(cardId);
			
			if (discardResult.success) {
				logger.debug(ctx, 'handleLuxuryDiscarded() - Discard successful, starting new round');
				
				// Start new round after luxury discard
				const newRoundResult = this.store.startNewRound();
				
				if (newRoundResult.success) {
					logger.debug(ctx, 'handleLuxuryDiscarded() - New round started, broadcasting state');
					this.broadcastStateSync();
				} else {
					logger.debug(ctx, 'handleLuxuryDiscarded() - Game ended after discard');
					// Game over - still broadcast final state
					this.broadcastStateSync();
				}
			} else {
				logger.error(ctx, 'handleLuxuryDiscarded() - Discard failed', { error: discardResult.error });
			}
		} else {
			// Clients wait for STATE_SYNC from host
			logger.debug(ctx, 'handleLuxuryDiscarded() - Client received discard event, waiting for STATE_SYNC');
			this.store.forceUpdate();
		}
	}
	
	private handleTurnTimeout(event: GameEvent) {
		if (!this.shouldProcessEvent(event)) {
			logger.debug(ctx, 'handleTurnTimeout() - Event filtered by shouldProcessEvent');
			return;
		}
		
		// Turn timeout auto-passes the current player
		// Sync will come via subsequent events
		this.store.forceUpdate();
	}
	
	// === Helper methods ===
	
	private shouldProcessEvent(event: GameEvent): boolean {
		const eventId = `${event.type}_${event.timestamp}`;
		if (this.processedEvents.has(eventId)) {
			return false;
		}
		
		this.processedEvents.add(eventId);
		
		// Clean up old events (keep last 100)
		if (this.processedEvents.size > 100) {
			const arr = Array.from(this.processedEvents);
			this.processedEvents = new Set(arr.slice(-100));
		}
		
		return true;
	}
}
