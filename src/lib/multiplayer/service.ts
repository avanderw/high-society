// WebSocket Client Service for Multiplayer Communication
import { io, type Socket } from 'socket.io-client';
import type { GameEvent } from './events';
import { GameEventType, createGameEvent } from './events';
import { generateRoomCode } from './wordlist';

export type EventCallback = (event: GameEvent) => void;

export class MultiplayerService {
	private socket: Socket | null = null;
	private roomId: string | null = null;
	private playerId: string | null = null;
	private playerName: string | null = null;
	private eventHandlers: Map<GameEventType | 'any', Set<EventCallback>> = new Map();
	private connected: boolean = false;
	
	// Store previous session for rejoin
	private previousSession: { roomId: string; playerId: string; playerName: string; hostPlayerId?: string } | null = null;

	constructor(private serverUrl: string) {
		// Try to restore previous session from localStorage
		this.restorePreviousSession();
	}

	/**
	 * Save session to localStorage for rejoin capability
	 */
	private saveSession(hostPlayerId?: string): void {
		if (this.roomId && this.playerId && this.playerName) {
			const session = {
				roomId: this.roomId,
				playerId: this.playerId,
				playerName: this.playerName,
				hostPlayerId: hostPlayerId || this.previousSession?.hostPlayerId,
				timestamp: Date.now()
			};
			localStorage.setItem('highsociety_session', JSON.stringify(session));
			this.previousSession = { 
				roomId: this.roomId, 
				playerId: this.playerId, 
				playerName: this.playerName,
				hostPlayerId: session.hostPlayerId
			};
		}
	}

	/**
	 * Restore previous session from localStorage
	 */
	private restorePreviousSession(): void {
		try {
			const stored = localStorage.getItem('highsociety_session');
			if (stored) {
				const session = JSON.parse(stored);
				// Only restore if session is less than 1 hour old
				if (Date.now() - session.timestamp < 60 * 60 * 1000) {
					this.previousSession = {
						roomId: session.roomId,
						playerId: session.playerId,
						playerName: session.playerName,
						hostPlayerId: session.hostPlayerId
					};
				} else {
					localStorage.removeItem('highsociety_session');
				}
			}
		} catch (error) {
			console.error('[Multiplayer] Failed to restore session:', error);
		}
	}

	/**
	 * Clear stored session
	 */
	private clearSession(): void {
		localStorage.removeItem('highsociety_session');
		this.previousSession = null;
	}

	/**
	 * Check if there's a previous session available for rejoin
	 */
	hasPreviousSession(): boolean {
		return this.previousSession !== null;
	}

	/**
	 * Get previous session info
	 */
	getPreviousSession(): { roomId: string; playerId: string; playerName: string; hostPlayerId?: string } | null {
		return this.previousSession;
	}

	/**
	 * Update the host player ID in the current session
	 */
	updateHostPlayerId(hostPlayerId: string): void {
		this.saveSession(hostPlayerId);
	}

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
			// Don't clear session - allow rejoin after disconnect
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
		const roomId = generateRoomCode();

		this.playerId = playerId;
		this.playerName = playerName;
		this.roomId = roomId;			this.socket.emit('create_room', { roomId, playerId, playerName }, (response: any) => {
				if (response.success) {
					console.log('[Multiplayer] Room created:', roomId);
					this.saveSession();
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
					this.saveSession();
					resolve({ roomId, playerId, players: response.players || [] });
				} else {
					reject(new Error(response.error || 'Failed to join room'));
				}
			});
		});
	}

	/**
	 * Rejoin a previous room with the same player ID
	 */
	rejoinRoom(): Promise<{ roomId: string; playerId: string; players: Array<{ playerId: string; playerName: string }> }> {
		return new Promise((resolve, reject) => {
			if (!this.socket) {
				reject(new Error('Not connected to server'));
				return;
			}

			if (!this.previousSession) {
				reject(new Error('No previous session to rejoin'));
				return;
			}

			const { roomId, playerId, playerName } = this.previousSession;

			this.playerId = playerId;
			this.playerName = playerName;
			this.roomId = roomId;

			console.log('[Multiplayer] Attempting to rejoin room:', roomId, 'as player:', playerId);

			this.socket.emit('rejoin_room', { roomId, playerId, playerName }, (response: any) => {
				if (response.success) {
					console.log('[Multiplayer] Rejoined room:', roomId);
					this.saveSession();
					resolve({ roomId, playerId, players: response.players || [] });
				} else {
					console.error('[Multiplayer] Rejoin failed:', response.error);
					// Clear invalid session
					this.clearSession();
					reject(new Error(response.error || 'Failed to rejoin room'));
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
			// Don't clear session here - allow rejoin after accidental leave
		}
	}

	/**
	 * Permanently leave and clear session
	 */
	leaveRoomPermanently(): void {
		this.leaveRoom();
		this.clearSession();
	}

	/**
	 * Request a game restart (host only)
	 */
	requestGameRestart(): void {
		if (!this.socket || !this.roomId || !this.playerId) {
			console.warn('[Multiplayer] Cannot request restart: not in a room');
			return;
		}

		const event = createGameEvent(
			GameEventType.GAME_RESTART_REQUESTED,
			this.roomId,
			this.playerId,
			{
				hostPlayerId: this.playerId,
				hostPlayerName: this.playerName
			}
		);
		this.socket.emit('game_event', event);
		console.log('[Multiplayer] Game restart requested');
	}

	/**
	 * Signal ready for restart (client response)
	 */
	signalRestartReady(): void {
		if (!this.socket || !this.roomId || !this.playerId) {
			console.warn('[Multiplayer] Cannot signal ready: not in a room');
			return;
		}

		const event = createGameEvent(
			GameEventType.GAME_RESTART_READY,
			this.roomId,
			this.playerId,
			{
				playerId: this.playerId,
				playerName: this.playerName
			}
		);
		this.socket.emit('game_event', event);
		console.log('[Multiplayer] Signaled ready for restart');
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

/**
 * Determine the relay server URL based on the current hostname
 */
function getRelayServerUrl(): string {
	// Check for explicit environment variable first
	if (import.meta.env.VITE_SOCKET_SERVER_URL) {
		return import.meta.env.VITE_SOCKET_SERVER_URL;
	}

	// Check if running in browser
	if (typeof window === 'undefined') {
		return 'http://localhost:3000';
	}

	const hostname = window.location.hostname;
	
	// If on production domain, use production relay server
	if (hostname === 'avanderw.co.za' || hostname.endsWith('.avanderw.co.za')) {
		return 'https://high-society.avanderw.co.za';
	}
	
	// Default to localhost for local development
	return 'http://localhost:3000';
}

export function getMultiplayerService(serverUrl?: string): MultiplayerService {
	if (!multiplayerService) {
		const url = serverUrl || getRelayServerUrl();
		console.log('[Multiplayer] Initializing service with URL:', url);
		console.log('[Multiplayer] Hostname:', typeof window !== 'undefined' ? window.location.hostname : 'SSR');
		console.log('[Multiplayer] Environment variable:', import.meta.env.VITE_SOCKET_SERVER_URL);
		multiplayerService = new MultiplayerService(url);
	}
	return multiplayerService;
}
