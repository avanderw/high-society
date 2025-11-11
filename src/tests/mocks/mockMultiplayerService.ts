import type { GameEvent, GameEventType } from '$lib/multiplayer/events';

/**
 * Mock multiplayer service for testing
 * Simulates event broadcasting without a real server
 */
export class MockMultiplayerService {
	private eventHandlers: Map<string, Array<(event: GameEvent) => void>> = new Map();
	private connected = false;
	private currentRoomId = '';
	private currentPlayerId = '';
	
	// Track all broadcasted events for assertions
	public broadcastedEvents: GameEvent[] = [];

	async connect(): Promise<void> {
		this.connected = true;
	}

	disconnect(): void {
		this.connected = false;
		this.eventHandlers.clear();
	}

	isConnected(): boolean {
		return this.connected;
	}

	async createRoom(playerName: string): Promise<{ roomId: string; playerId: string }> {
		this.currentRoomId = `test-room-${Date.now()}`;
		this.currentPlayerId = `test-player-${Date.now()}`;
		return {
			roomId: this.currentRoomId,
			playerId: this.currentPlayerId
		};
	}

	async joinRoom(
		roomId: string,
		playerName: string
	): Promise<{ roomId: string; playerId: string; players: Array<{ playerId: string; playerName: string }> }> {
		this.currentRoomId = roomId;
		this.currentPlayerId = `test-player-${Date.now()}`;
		return {
			roomId,
			playerId: this.currentPlayerId,
			players: []
		};
	}

	leaveRoom(): void {
		this.currentRoomId = '';
	}

	getRoomId(): string {
		return this.currentRoomId;
	}

	getPlayerId(): string {
		return this.currentPlayerId;
	}

	on(eventType: string, handler: (event: GameEvent) => void): void {
		if (!this.eventHandlers.has(eventType)) {
			this.eventHandlers.set(eventType, []);
		}
		this.eventHandlers.get(eventType)!.push(handler);
	}

	off(eventType: string, handler: (event: GameEvent) => void): void {
		const handlers = this.eventHandlers.get(eventType);
		if (handlers) {
			const index = handlers.indexOf(handler);
			if (index > -1) {
				handlers.splice(index, 1);
			}
		}
	}

	broadcastEvent(eventType: GameEventType, data: any): void {
		const event: GameEvent = {
			type: eventType,
			roomId: this.currentRoomId,
			playerId: this.currentPlayerId,
			timestamp: Date.now(),
			data
		};
		
		this.broadcastedEvents.push(event);
		
		// Don't trigger handlers immediately - let tests control event delivery
	}

	/**
	 * Simulate receiving an event (for testing)
	 * This allows tests to control when events are delivered to handlers
	 */
	simulateEvent(event: GameEvent): void {
		const handlers = this.eventHandlers.get(event.type);
		if (handlers) {
			handlers.forEach(handler => handler(event));
		}
	}

	/**
	 * Clear all broadcasted events (for test cleanup)
	 */
	clearBroadcastedEvents(): void {
		this.broadcastedEvents = [];
	}
}

/**
 * Create multiple mock services to simulate different players
 */
export function createMockMultiplayerSetup(playerCount: number): {
	services: MockMultiplayerService[];
	simulateBroadcast: (fromService: MockMultiplayerService, eventType: GameEventType, data: any) => void;
} {
	const services = Array.from({ length: playerCount }, () => new MockMultiplayerService());
	
	/**
	 * Simulate a broadcast from one player to all others
	 */
	const simulateBroadcast = (fromService: MockMultiplayerService, eventType: GameEventType, data: any) => {
		const event: GameEvent = {
			type: eventType,
			roomId: fromService.getRoomId(),
			playerId: fromService.getPlayerId(),
			timestamp: Date.now(),
			data
		};
		
		// Deliver to all services (they'll skip their own events)
		services.forEach(service => {
			service.simulateEvent(event);
		});
	};
	
	return { services, simulateBroadcast };
}
