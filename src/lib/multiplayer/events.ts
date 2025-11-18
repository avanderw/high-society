// WebSocket Event Types for Multiplayer Communication
// Simplified generic event system using discriminated unions

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

// Generic event structure using discriminated union pattern
export interface GameEvent<T = any> {
	type: GameEventType;
	roomId: string;
	playerId: string;
	timestamp: number;
	data?: T;
}

// Generic event structure using discriminated union pattern
export interface GameEvent<T = any> {
	type: GameEventType;
	roomId: string;
	playerId: string;
	timestamp: number;
	data?: T;
}

// Type-safe event payloads (optional for better IDE support)
export type GameEventData = {
	[GameEventType.ROOM_CREATED]: { roomId: string; hostPlayerId: string; hostPlayerName: string };
	[GameEventType.PLAYER_JOINED]: { playerId: string; playerName: string; playerCount: number };
	[GameEventType.PLAYER_LEFT]: { playerId: string; playerName: string };
	[GameEventType.GAME_STARTED]: { players: Array<{ id: string; name: string }>; initialState: any; playerMapping?: any };
	[GameEventType.GAME_RESTART_REQUESTED]: { hostPlayerId: string; hostPlayerName: string };
	[GameEventType.GAME_RESTART_READY]: { playerId: string; playerName: string; readyCount: number; totalPlayers: number };
	[GameEventType.STATE_SYNC]: { gameState: any; fromPlayerId: string };
	[GameEventType.STATE_REQUEST]: { requestingPlayerId: string; requesterName?: string; requesterId?: string };
	[GameEventType.BID_PLACED]: { playerId: string; playerName: string; moneyCardIds: string[]; totalBid: number; multiplayerPlayerId?: string };
	[GameEventType.PASS_AUCTION]: { playerId: string; playerName: string; multiplayerPlayerId?: string };
	[GameEventType.LUXURY_DISCARDED]: { playerId: string; playerName: string; cardId: string; multiplayerPlayerId?: string };
	[GameEventType.TURN_TIMEOUT]: { playerId: string; playerName: string; currentPlayerIndex: number };
	[GameEventType.AUCTION_COMPLETE]: { winnerId?: string | null; winnerName?: string | null; cardWon?: any; bidAmount?: number; gameState?: any; needsLuxuryDiscard?: boolean; auctionResult?: any };
	[GameEventType.ROUND_STARTED]: { currentCard: any; phase: string; currentPlayerIndex: number };
	[GameEventType.GAME_ENDED]: { rankings: Array<{ playerId: string; playerName: string; rank: number; status: number; money: number }> };
	[GameEventType.ERROR]: { message: string; code?: string };
	[GameEventType.VALIDATION_ERROR]: { field: string; message: string };
};

// Type-safe event creator
export function createGameEvent<T extends GameEventType>(
	type: T,
	roomId: string,
	playerId: string,
	data?: T extends keyof GameEventData ? GameEventData[T] : any
): GameEvent {
	return {
		type,
		roomId,
		playerId,
		timestamp: Date.now(),
		data
	};
}

// Simple type guards for event categories
export function isRoomEvent(event: GameEvent): boolean {
	return [
		GameEventType.ROOM_CREATED,
		GameEventType.PLAYER_JOINED,
		GameEventType.PLAYER_LEFT
	].includes(event.type);
}

export function isActionEvent(event: GameEvent): boolean {
	return [
		GameEventType.BID_PLACED,
		GameEventType.PASS_AUCTION,
		GameEventType.LUXURY_DISCARDED,
		GameEventType.TURN_TIMEOUT
	].includes(event.type);
}

export function isGameProgressionEvent(event: GameEvent): boolean {
	return [
		GameEventType.AUCTION_COMPLETE,
		GameEventType.ROUND_STARTED,
		GameEventType.GAME_ENDED
	].includes(event.type);
}
