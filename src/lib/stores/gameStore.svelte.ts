/**
 * Unified Game Store - Svelte 5 Runes
 * Replaces manual state tracking with reactive store
 */

import { GameState, GamePhase } from '$lib/domain/gameState';
import type { Player } from '$lib/domain/player';
import type { StatusCard } from '$lib/domain/cards';

export interface AuctionResultData {
	winner: Player | null;
	card: StatusCard | null;
	winningBid: number;
	isDisgrace: boolean;
	losersInfo?: Array<{ player: Player; bidAmount: number }>;
}

interface GameStoreState {
	// Core game state
	gameState: GameState | null;
	
	// Multiplayer state
	roomId: string;
	myPlayerId: string;
	myPlayerName: string;
	hostPlayerId: string;
	isHost: boolean;
	inLobby: boolean;
	lobbyPlayers: Array<{ playerId: string; playerName: string }>;
	playerIdToGameIndex: Map<string, number>;
	turnTimerSeconds: number;
	
	// Restart state
	restartRequested: boolean;
	playersReady: Set<string>;
	
	// UI selections
	selectedMoneyCards: string[];
	
	// Modal state
	showLuxuryDiscard: boolean;
	showAuctionResult: boolean;
	auctionResultData: AuctionResultData | null;
	showStatistics: boolean;
	showSettings: boolean;
	showConfirmDialog: boolean;
	confirmDialogData: {
		title: string;
		message: string;
		onConfirm: () => void;
		type?: 'warning' | 'danger' | 'info';
	} | null;
	
	// Toast/error state
	errorMessage: string;
	toastMessage: string;
	toastType: 'error' | 'warning' | 'info' | 'success';
	showToast: boolean;
	
	// Rejoin state
	showRejoinPrompt: boolean;
	isRejoining: boolean;
	rejoinError: string;
}

class GameStore {
	// State using Svelte 5 runes
	private state = $state<GameStoreState>({
		gameState: null,
		roomId: '',
		myPlayerId: '',
		myPlayerName: '',
		hostPlayerId: '',
		isHost: false,
		inLobby: true,
		lobbyPlayers: [],
		playerIdToGameIndex: new Map(),
		turnTimerSeconds: 30,
		restartRequested: false,
		playersReady: new Set(),
		selectedMoneyCards: [],
		showLuxuryDiscard: false,
		showAuctionResult: false,
		auctionResultData: null,
		showStatistics: false,
		showSettings: false,
		showConfirmDialog: false,
		confirmDialogData: null,
		errorMessage: '',
		toastMessage: '',
		toastType: 'error',
		showToast: false,
		showRejoinPrompt: false,
		isRejoining: false,
		rejoinError: ''
	});
	
	// Derived state using Svelte 5 $derived
	readonly currentPhase = $derived(this.state.gameState?.getCurrentPhase());
	readonly currentAuction = $derived(this.state.gameState?.getCurrentAuction());
	readonly currentCard = $derived(this.state.gameState?.getPublicState().currentCard);
	readonly currentPlayerIndex = $derived(this.state.gameState?.getCurrentPlayerIndex() ?? -1);
	readonly currentPlayer = $derived(this.state.gameState?.getCurrentPlayer());
	readonly allPlayers = $derived(this.state.gameState?.getPlayers() ?? []);
	readonly gameEndTriggerCount = $derived(this.state.gameState?.getPublicState().gameEndTriggerCount ?? 0);
	readonly remainingStatusCards = $derived(this.state.gameState?.getPublicState().remainingStatusCards ?? 0);
	
	readonly localPlayer = $derived.by(() => {
		if (!this.state.myPlayerId || !this.state.gameState) return undefined;
		const myGameIndex = this.state.playerIdToGameIndex.get(this.state.myPlayerId);
		if (myGameIndex === undefined) return undefined;
		return this.state.gameState.getPlayers()[myGameIndex];
	});
	
	readonly isMyTurn = $derived.by(() => {
		if (!this.state.myPlayerId || this.currentPlayerIndex === undefined || this.currentPlayerIndex < 0) {
			return false;
		}
		const myGameIndex = this.state.playerIdToGameIndex.get(this.state.myPlayerId);
		return myGameIndex === this.currentPlayerIndex;
	});
	
	readonly connectedPlayerIds = $derived.by(() => {
		return new Set(this.state.lobbyPlayers.map(p => p.playerId));
	});
	
	// Getters for state access
	get gameState() { return this.state.gameState; }
	get roomId() { return this.state.roomId; }
	get myPlayerId() { return this.state.myPlayerId; }
	get myPlayerName() { return this.state.myPlayerName; }
	get hostPlayerId() { return this.state.hostPlayerId; }
	get isHost() { return this.state.isHost; }
	get inLobby() { return this.state.inLobby; }
	get lobbyPlayers() { return this.state.lobbyPlayers; }
	get playerIdToGameIndex() { return this.state.playerIdToGameIndex; }
	get turnTimerSeconds() { return this.state.turnTimerSeconds; }
	get restartRequested() { return this.state.restartRequested; }
	get playersReady() { return this.state.playersReady; }
	get selectedMoneyCards() { return this.state.selectedMoneyCards; }
	get showLuxuryDiscard() { return this.state.showLuxuryDiscard; }
	get showAuctionResult() { return this.state.showAuctionResult; }
	get auctionResultData() { return this.state.auctionResultData; }
	get showStatistics() { return this.state.showStatistics; }
	get showSettings() { return this.state.showSettings; }
	get showConfirmDialog() { return this.state.showConfirmDialog; }
	get confirmDialogData() { return this.state.confirmDialogData; }
	get errorMessage() { return this.state.errorMessage; }
	get toastMessage() { return this.state.toastMessage; }
	get toastType() { return this.state.toastType; }
	get showToast() { return this.state.showToast; }
	get showRejoinPrompt() { return this.state.showRejoinPrompt; }
	get isRejoining() { return this.state.isRejoining; }
	get rejoinError() { return this.state.rejoinError; }
	
	// Setters for state mutations
	setGameState(gameState: GameState | null) {
		this.state.gameState = gameState;
		this.saveToStorage();
	}
	
	setRoomId(roomId: string) { this.state.roomId = roomId; }
	setMyPlayerId(playerId: string) { this.state.myPlayerId = playerId; }
	setMyPlayerName(name: string) { this.state.myPlayerName = name; }
	setHostPlayerId(playerId: string) { this.state.hostPlayerId = playerId; }
	setIsHost(isHost: boolean) { this.state.isHost = isHost; }
	setInLobby(inLobby: boolean) { this.state.inLobby = inLobby; }
	setLobbyPlayers(players: Array<{ playerId: string; playerName: string }>) {
		this.state.lobbyPlayers = players;
	}
	setPlayerIdToGameIndex(mapping: Map<string, number>) {
		this.state.playerIdToGameIndex = mapping;
	}
	setTurnTimerSeconds(seconds: number) { this.state.turnTimerSeconds = seconds; }
	setRestartRequested(requested: boolean) { this.state.restartRequested = requested; }
	setPlayersReady(ready: Set<string>) { this.state.playersReady = ready; }
	
	setSelectedMoneyCards(cards: string[]) {
		this.state.selectedMoneyCards = cards;
	}
	
	toggleMoneyCard(cardId: string) {
		if (this.state.selectedMoneyCards.includes(cardId)) {
			this.state.selectedMoneyCards = this.state.selectedMoneyCards.filter(id => id !== cardId);
		} else {
			this.state.selectedMoneyCards = [...this.state.selectedMoneyCards, cardId];
		}
	}
	
	clearSelectedMoneyCards() {
		this.state.selectedMoneyCards = [];
	}
	
	// Modal controls
	setShowLuxuryDiscard(show: boolean) { this.state.showLuxuryDiscard = show; }
	setShowAuctionResult(show: boolean) { this.state.showAuctionResult = show; }
	setAuctionResultData(data: AuctionResultData | null) {
		this.state.auctionResultData = data;
	}
	setShowStatistics(show: boolean) { this.state.showStatistics = show; }
	setShowSettings(show: boolean) { this.state.showSettings = show; }
	setShowConfirmDialog(show: boolean) { this.state.showConfirmDialog = show; }
	setConfirmDialogData(data: GameStoreState['confirmDialogData']) {
		this.state.confirmDialogData = data;
	}
	
	// Error/toast controls
	setErrorMessage(message: string) { this.state.errorMessage = message; }
	
	showToastMessage(message: string, type: 'error' | 'warning' | 'info' | 'success' = 'error') {
		this.state.toastMessage = message;
		this.state.toastType = type;
		this.state.showToast = true;
		setTimeout(() => { this.state.showToast = false; }, 3000);
	}
	
	hideToast() { this.state.showToast = false; }
	
	// Rejoin controls
	setShowRejoinPrompt(show: boolean) { this.state.showRejoinPrompt = show; }
	setIsRejoining(rejoining: boolean) { this.state.isRejoining = rejoining; }
	setRejoinError(error: string) { this.state.rejoinError = error; }
	
	// Persistence
	private saveToStorage() {
		if (typeof localStorage === 'undefined' || !this.state.gameState) return;
		
		try {
			// Only save if we have an active game
			if (this.state.gameState.getCurrentPhase() !== GamePhase.SETUP) {
				// Import serialization dynamically to avoid circular deps
				import('$lib/multiplayer/serialization').then(({ serializeGameState }) => {
					const data = {
						roomId: this.state.roomId,
						myPlayerId: this.state.myPlayerId,
						myPlayerName: this.state.myPlayerName,
						hostPlayerId: this.state.hostPlayerId,
						isHost: this.state.isHost,
						playerMapping: Array.from(this.state.playerIdToGameIndex.entries()),
						gameState: serializeGameState(this.state.gameState!),
						timestamp: Date.now()
					};
					localStorage.setItem('highsociety_gamestate', JSON.stringify(data));
				});
			}
		} catch (error) {
			console.warn('Failed to save game state:', error);
		}
	}
	
	restoreFromStorage(): boolean {
		if (typeof localStorage === 'undefined') return false;
		
		try {
			const stored = localStorage.getItem('highsociety_gamestate');
			if (!stored) return false;
			
			const data = JSON.parse(stored);
			
			// Only restore if less than 1 hour old
			if (Date.now() - data.timestamp > 60 * 60 * 1000) {
				localStorage.removeItem('highsociety_gamestate');
				return false;
			}
			
			// Import deserialization dynamically
			import('$lib/multiplayer/serialization').then(({ deserializeGameState }) => {
				this.state.roomId = data.roomId;
				this.state.myPlayerId = data.myPlayerId;
				this.state.myPlayerName = data.myPlayerName;
				this.state.hostPlayerId = data.hostPlayerId;
				this.state.isHost = data.isHost;
				this.state.playerIdToGameIndex = new Map(data.playerMapping);
				this.state.gameState = deserializeGameState(data.gameState);
				this.state.inLobby = false;
			});
			
			return true;
		} catch (error) {
			console.warn('Failed to restore game state:', error);
			return false;
		}
	}
	
	clearStorage() {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem('highsociety_gamestate');
		}
	}
	
	// Reset all state
	reset() {
		this.state.gameState = null;
		this.state.roomId = '';
		this.state.myPlayerId = '';
		this.state.myPlayerName = '';
		this.state.hostPlayerId = '';
		this.state.isHost = false;
		this.state.inLobby = true;
		this.state.lobbyPlayers = [];
		this.state.playerIdToGameIndex = new Map();
		this.state.restartRequested = false;
		this.state.playersReady = new Set();
		this.state.selectedMoneyCards = [];
		this.state.showLuxuryDiscard = false;
		this.state.showAuctionResult = false;
		this.state.auctionResultData = null;
		this.state.errorMessage = '';
		this.state.showRejoinPrompt = false;
		this.state.rejoinError = '';
	}
}

// Export singleton instance
export const gameStore = new GameStore();
