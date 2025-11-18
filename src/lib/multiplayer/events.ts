// WebSocket Event Types for Multiplayer Communication

export enum GameEventType {
	// Room management
	ROOM_CREATED = 'room:created',
	ROOM_JOINED = 'room:joined',
	PLAYER_JOINED = 'player:joined',
	PLAYER_LEFT = 'player:left',
	GAME_STARTED = 'game:started',
	GAME_RESTART_REQUESTED = 'game:restart_requested',
	GAME_RESTART_READY = 'game:restart_ready',
	
	// Game state sync
	STATE_SYNC = 'state:sync',
	STATE_REQUEST = 'state:request',
	
	// Player actions
	BID_PLACED = 'action:bid',
	PASS_AUCTION = 'action:pass',
	LUXURY_DISCARDED = 'action:luxury_discard',
	TURN_TIMEOUT = 'action:turn_timeout',
	
	// Game progression
	AUCTION_COMPLETE = 'game:auction_complete',
	ROUND_STARTED = 'game:round_started',
	GAME_ENDED = 'game:ended',
	
	// Error handling
	ERROR = 'error',
	VALIDATION_ERROR = 'error:validation'
}

// Base event structure
export interface GameEvent {
	type: GameEventType;
	roomId: string;
	playerId: string;
	timestamp: number;
	data?: any;
}

// Room management events
export interface RoomCreatedEvent extends GameEvent {
	type: GameEventType.ROOM_CREATED;
	data: {
		roomId: string;
		hostPlayerId: string;
		hostPlayerName: string;
	};
}

export interface PlayerJoinedEvent extends GameEvent {
	type: GameEventType.PLAYER_JOINED;
	data: {
		playerId: string;
		playerName: string;
		playerCount: number;
	};
}

export interface PlayerLeftEvent extends GameEvent {
	type: GameEventType.PLAYER_LEFT;
	data: {
		playerId: string;
		playerName: string;
	};
}

export interface GameStartedEvent extends GameEvent {
	type: GameEventType.GAME_STARTED;
	data: {
		players: Array<{
			id: string;
			name: string;
		}>;
		initialState: any; // GamePublicState
	};
}

export interface GameRestartRequestedEvent extends GameEvent {
	type: GameEventType.GAME_RESTART_REQUESTED;
	data: {
		hostPlayerId: string;
		hostPlayerName: string;
	};
}

export interface GameRestartReadyEvent extends GameEvent {
	type: GameEventType.GAME_RESTART_READY;
	data: {
		playerId: string;
		playerName: string;
		readyCount: number;
		totalPlayers: number;
	};
}

// State synchronization
export interface StateSyncEvent extends GameEvent {
	type: GameEventType.STATE_SYNC;
	data: {
		gameState: any; // Full serialized game state
		fromPlayerId: string;
	};
}

export interface StateRequestEvent extends GameEvent {
	type: GameEventType.STATE_REQUEST;
	data: {
		requestingPlayerId: string;
	};
}

// Player action events
export interface BidPlacedEvent extends GameEvent {
	type: GameEventType.BID_PLACED;
	data: {
		playerId: string;
		playerName: string;
		moneyCardIds: string[];
		totalBid: number;
	};
}

export interface PassAuctionEvent extends GameEvent {
	type: GameEventType.PASS_AUCTION;
	data: {
		playerId: string;
		playerName: string;
	};
}

export interface LuxuryDiscardedEvent extends GameEvent {
	type: GameEventType.LUXURY_DISCARDED;
	data: {
		playerId: string;
		playerName: string;
		cardId: string;
	};
}

export interface TurnTimeoutEvent extends GameEvent {
	type: GameEventType.TURN_TIMEOUT;
	data: {
		playerId: string;
		playerName: string;
		currentPlayerIndex: number;
	};
}

// Game progression events
export interface AuctionCompleteEvent extends GameEvent {
	type: GameEventType.AUCTION_COMPLETE;
	data: {
		winnerId: string | null;
		winnerName: string | null;
		cardWon: any; // StatusCard
		bidAmount: number;
	};
}

export interface RoundStartedEvent extends GameEvent {
	type: GameEventType.ROUND_STARTED;
	data: {
		currentCard: any; // StatusCard
		phase: string; // GamePhase
		currentPlayerIndex: number;
	};
}

export interface GameEndedEvent extends GameEvent {
	type: GameEventType.GAME_ENDED;
	data: {
		rankings: Array<{
			playerId: string;
			playerName: string;
			rank: number;
			status: number;
			money: number;
		}>;
	};
}

// Error events
export interface ErrorEvent extends GameEvent {
	type: GameEventType.ERROR;
	data: {
		message: string;
		code?: string;
	};
}

export interface ValidationErrorEvent extends GameEvent {
	type: GameEventType.VALIDATION_ERROR;
	data: {
		field: string;
		message: string;
	};
}

// Type guards
export function isRoomEvent(event: GameEvent): event is RoomCreatedEvent | PlayerJoinedEvent | PlayerLeftEvent {
	return [
		GameEventType.ROOM_CREATED,
		GameEventType.PLAYER_JOINED,
		GameEventType.PLAYER_LEFT
	].includes(event.type);
}

export function isActionEvent(event: GameEvent): event is BidPlacedEvent | PassAuctionEvent | LuxuryDiscardedEvent | TurnTimeoutEvent {
	return [
		GameEventType.BID_PLACED,
		GameEventType.PASS_AUCTION,
		GameEventType.LUXURY_DISCARDED,
		GameEventType.TURN_TIMEOUT
	].includes(event.type);
}

export function isGameProgressionEvent(event: GameEvent): event is AuctionCompleteEvent | RoundStartedEvent | GameEndedEvent {
	return [
		GameEventType.AUCTION_COMPLETE,
		GameEventType.ROUND_STARTED,
		GameEventType.GAME_ENDED
	].includes(event.type);
}

// Event builder helpers
export function createGameEvent(
	type: GameEventType,
	roomId: string,
	playerId: string,
	data?: any
): GameEvent {
	return {
		type,
		roomId,
		playerId,
		timestamp: Date.now(),
		data
	};
}
