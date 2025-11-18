/**
 * Reactive Game Store - Svelte 5 wrapper around GameState
 * Provides reactive access to game state using $state runes
 */

import { GameState, GamePhase } from '$lib/domain/gameState';
import type { Player } from '$lib/domain/player';
import { GameOrchestrator, type ActionResult } from '$lib/orchestrators/GameOrchestrator';

export class ReactiveGameStore {
	// Core state - use $state rune for reactivity
	gameState = $state<GameState | null>(null);
	orchestrator = $state<GameOrchestrator | null>(null);
	
	// UI state
	selectedMoneyCards = $state<string[]>([]);
	errorMessage = $state('');
	
	// Multiplayer context
	myPlayerId = $state('');
	playerIdToGameIndex = $state<Map<string, number>>(new Map());
	
	// Force update counter for manual reactivity triggers
	updateCounter = $state(0);
	
	// Derived values - automatically reactive
	readonly currentPhase = $derived.by(() => {
		const _ = this.updateCounter;
		return this.gameState?.getCurrentPhase();
	});
	readonly currentAuction = $derived.by(() => {
		const _ = this.updateCounter;
		return this.gameState?.getCurrentAuction();
	});
	readonly currentCard = $derived.by(() => {
		const _ = this.updateCounter;
		return this.gameState?.getPublicState().currentCard;
	});
	readonly currentPlayerIndex = $derived.by(() => {
		const _ = this.updateCounter;
		return this.gameState?.getCurrentPlayerIndex() ?? -1;
	});
	readonly currentPlayer = $derived.by(() => {
		const _ = this.updateCounter;
		return this.gameState?.getCurrentPlayer();
	});
	readonly players = $derived.by(() => {
		const _ = this.updateCounter;
		return this.gameState?.getPlayers() ?? [];
	});
	readonly gameEndTriggerCount = $derived.by(() => {
		const _ = this.updateCounter;
		return this.gameState?.getPublicState().gameEndTriggerCount ?? 0;
	});
	readonly remainingStatusCards = $derived.by(() => {
		const _ = this.updateCounter;
		return this.gameState?.getPublicState().remainingStatusCards ?? 0;
	});
	
	readonly localPlayer = $derived.by(() => {
		// Force update dependency
		const _ = this.updateCounter;
		
		if (!this.myPlayerId || !this.gameState) return undefined;
		const myGameIndex = this.playerIdToGameIndex.get(this.myPlayerId);
		if (myGameIndex === undefined) return undefined;
		return this.gameState.getPlayers()[myGameIndex];
	});
	
	readonly isMyTurn = $derived.by(() => {
		// Force update dependency
		const _ = this.updateCounter;
		
		if (!this.myPlayerId || this.currentPlayerIndex === undefined || this.currentPlayerIndex < 0) {
			return false;
		}
		const myGameIndex = this.playerIdToGameIndex.get(this.myPlayerId);
		return myGameIndex === this.currentPlayerIndex;
	});
	
	// Initialize a new game
	initialize(playerNames: string[], seed?: number, turnTimerSeconds?: number) {
		this.gameState = new GameState(`game-${Date.now()}`, seed, turnTimerSeconds);
		this.gameState.initializeGame(playerNames);
		this.gameState.startNewRound();
		this.orchestrator = new GameOrchestrator(this.gameState);
		this.selectedMoneyCards = [];
		this.errorMessage = '';
		this.forceUpdate();
	}
	
	// Set multiplayer context
	setMultiplayerContext(myPlayerId: string, playerMapping: Map<string, number>) {
		this.myPlayerId = myPlayerId;
		this.playerIdToGameIndex = playerMapping;
		this.forceUpdate();
	}
	
	// Game actions - delegate to orchestrator
	placeBid(moneyCardIds: string[]): ActionResult {
		if (!this.orchestrator) {
			return { success: false, error: 'Game not initialized' };
		}
		
		const result = this.orchestrator.placeBid(moneyCardIds, this.currentPlayerIndex);
		if (result.success) {
			this.selectedMoneyCards = [];
			this.errorMessage = '';
		} else {
			this.errorMessage = result.error ?? '';
		}
		this.forceUpdate();
		return result;
	}
	
	pass(): ActionResult {
		if (!this.orchestrator) {
			return { success: false, error: 'Game not initialized' };
		}
		
		const result = this.orchestrator.pass(this.currentPlayerIndex);
		if (result.success) {
			this.selectedMoneyCards = [];
			this.errorMessage = '';
		} else {
			this.errorMessage = result.error ?? '';
		}
		this.forceUpdate();
		return result;
	}
	
	handleLuxuryDiscard(cardId: string): ActionResult {
		if (!this.orchestrator || !this.localPlayer) {
			return { success: false, error: 'Game not initialized' };
		}
		
		const result = this.orchestrator.handleLuxuryDiscard(cardId, this.localPlayer.id);
		this.forceUpdate();
		return result;
	}
	
	startNewRound(): ActionResult {
		if (!this.orchestrator) {
			return { success: false, error: 'Game not initialized' };
		}
		
		const result = this.orchestrator.startNewRound();
		this.forceUpdate();
		return result;
	}
	
	// Manual update trigger for when domain objects are mutated
	forceUpdate() {
		this.updateCounter++;
	}
	
	// Update from serialized state (for multiplayer sync)
	updateFromSerialized(gameState: GameState) {
		this.gameState = gameState;
		if (this.gameState) {
			this.orchestrator = new GameOrchestrator(this.gameState);
		}
		this.forceUpdate();
	}
	
	// Reset
	reset() {
		this.gameState = null;
		this.orchestrator = null;
		this.selectedMoneyCards = [];
		this.errorMessage = '';
		this.forceUpdate();
	}
}

// Singleton instance
export const reactiveGameStore = new ReactiveGameStore();
