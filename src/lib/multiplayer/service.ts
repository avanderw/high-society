// WebSocket Client Service for Multiplayer Communication
import { io, type Socket } from 'socket.io-client';
import type { GameEvent } from './events';
import { GameEventType, createGameEvent } from './events';

export type EventCallback = (event: GameEvent) => void;

export class MultiplayerService {
	private socket: Socket | null = null;
	private roomId: string | null = null;
	private playerId: string | null = null;
	private playerName: string | null = null;
	private eventHandlers: Map<GameEventType | 'any', Set<EventCallback>> = new Map();
	private connected: boolean = false;

	constructor(private serverUrl: string) {}

	/**
	 * Connect to the WebSocket server
	 */
	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.socket = io(this.serverUrl, {
					transports: ['websocket'],
					reconnection: true,
					reconnectionDelay: 1000,
					reconnectionAttempts: 5
				});

				this.socket.on('connect', () => {
					console.log('[Multiplayer] Connected to server');
					this.connected = true;
					resolve();
				});

				this.socket.on('disconnect', () => {
					console.log('[Multiplayer] Disconnected from server');
					this.connected = false;
				});

			this.socket.on('connect_error', (error: Error) => {
				console.error('[Multiplayer] Connection error:', error);
				reject(error);
			});				// Listen for all game events
				this.socket.onAny((eventType: string, data: any) => {
					if (eventType.startsWith('game:') || eventType.startsWith('action:') || eventType.startsWith('room:') || eventType.startsWith('state:') || eventType.startsWith('error:')) {
						const event: GameEvent = {
							type: eventType as GameEventType,
							roomId: data.roomId || this.roomId || '',
							playerId: data.data?.playerId || data.playerId || '',
							timestamp: data.timestamp || Date.now(),
							data: data.data || data  // Use nested data if it exists, otherwise use the data itself
						};
						
						this.handleEvent(event);
					}
				});

			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Disconnect from the server
	 */
	disconnect(): void {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
			this.connected = false;
			this.roomId = null;
			this.playerId = null;
		}
	}

	/**
	 * Check if connected
	 */
	isConnected(): boolean {
		return this.connected && this.socket !== null;
	}

	/**
	 * Create a new game room
	 */
	createRoom(playerName: string): Promise<{ roomId: string; playerId: string }> {
		return new Promise((resolve, reject) => {
			if (!this.socket) {
				reject(new Error('Not connected to server'));
				return;
			}

			const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

			this.playerId = playerId;
			this.playerName = playerName;
			this.roomId = roomId;

			this.socket.emit('create_room', { roomId, playerId, playerName }, (response: any) => {
				if (response.success) {
					console.log('[Multiplayer] Room created:', roomId);
					resolve({ roomId, playerId });
				} else {
					reject(new Error(response.error || 'Failed to create room'));
				}
			});
		});
	}

	/**
	 * Join an existing game room
	 */
	joinRoom(roomId: string, playerName: string): Promise<{ roomId: string; playerId: string; players: Array<{ playerId: string; playerName: string }> }> {
		return new Promise((resolve, reject) => {
			if (!this.socket) {
				reject(new Error('Not connected to server'));
				return;
			}

			const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

			this.playerId = playerId;
			this.playerName = playerName;
			this.roomId = roomId;

			this.socket.emit('join_room', { roomId, playerId, playerName }, (response: any) => {
				if (response.success) {
					console.log('[Multiplayer] Joined room:', roomId);
					resolve({ roomId, playerId, players: response.players || [] });
				} else {
					reject(new Error(response.error || 'Failed to join room'));
				}
			});
		});
	}

	/**
	 * Leave the current room
	 */
	leaveRoom(): void {
		if (this.socket && this.roomId && this.playerId) {
			this.socket.emit('leave_room', { roomId: this.roomId, playerId: this.playerId });
			this.roomId = null;
		}
	}

	/**
	 * Broadcast an event to all players in the room
	 */
	broadcastEvent(eventType: GameEventType, data?: any): void {
		if (!this.socket || !this.roomId || !this.playerId) {
			console.warn('[Multiplayer] Cannot broadcast: not in a room');
			return;
		}

		const event = createGameEvent(eventType, this.roomId, this.playerId, data);
		this.socket.emit('game_event', event);
		console.log('[Multiplayer] Broadcast event:', eventType, data);
	}

	/**
	 * Register an event handler
	 */
	on(eventType: GameEventType | 'any' | 'room:joined' | 'room:left', callback: EventCallback): void {
		if (!this.eventHandlers.has(eventType as any)) {
			this.eventHandlers.set(eventType as any, new Set());
		}
		this.eventHandlers.get(eventType as any)!.add(callback);
	}

	/**
	 * Unregister an event handler
	 */
	off(eventType: GameEventType | 'any' | 'room:joined' | 'room:left', callback: EventCallback): void {
		const handlers = this.eventHandlers.get(eventType as any);
		if (handlers) {
			handlers.delete(callback);
		}
	}

	/**
	 * Handle incoming events
	 */
	private handleEvent(event: GameEvent): void {
		console.log('[Multiplayer] Received event:', event.type, event.data);

		// Call specific event handlers
		const handlers = this.eventHandlers.get(event.type);
		if (handlers) {
			handlers.forEach(callback => callback(event));
		}

		// Call 'any' event handlers
		const anyHandlers = this.eventHandlers.get('any');
		if (anyHandlers) {
			anyHandlers.forEach(callback => callback(event));
		}
	}

	/**
	 * Get current player ID
	 */
	getPlayerId(): string | null {
		return this.playerId;
	}

	/**
	 * Get current player name
	 */
	getPlayerName(): string | null {
		return this.playerName;
	}

	/**
	 * Get current room ID
	 */
	getRoomId(): string | null {
		return this.roomId;
	}

	/**
	 * Check if this player is the host (first player in room)
	 */
	isHost(): boolean {
		// This can be enhanced by tracking host status from server
		return this.playerId !== null && this.roomId !== null;
	}
}

// Singleton instance
let multiplayerService: MultiplayerService | null = null;

export function getMultiplayerService(serverUrl?: string): MultiplayerService {
	if (!multiplayerService) {
		const url = serverUrl || import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3000';
		console.log('[Multiplayer] Initializing service with URL:', url);
		console.log('[Multiplayer] Environment variable:', import.meta.env.VITE_SOCKET_SERVER_URL);
		multiplayerService = new MultiplayerService(url);
	}
	return multiplayerService;
}
