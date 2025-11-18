/**
 * Integration test for multiplayer pass bug
 * 
 * This test simulates the actual multiplayer flow where:
 * 1. Client broadcasts action:pass event
 * 2. Host receives the event and should execute pass logic
 * 3. Host broadcasts state:sync back to clients
 * 4. All clients are in sync
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultiplayerOrchestrator } from '$lib/orchestrators/MultiplayerOrchestrator';
import { ReactiveGameStore } from '$lib/stores/reactiveGameStore.svelte';
import { MultiplayerService } from '$lib/multiplayer/service';
import { GameEventType, type GameEvent } from '$lib/multiplayer/events';

describe('Multiplayer Pass Bug Fix', () => {
	let hostStore: ReactiveGameStore;
	let clientStore: ReactiveGameStore;
	let hostService: MultiplayerService;
	let clientService: MultiplayerService;
	let hostOrchestrator: MultiplayerOrchestrator;
	let clientOrchestrator: MultiplayerOrchestrator;
	
	beforeEach(() => {
		// Create host
		hostStore = new ReactiveGameStore();
		hostService = new MultiplayerService('http://localhost:3001');
		hostOrchestrator = new MultiplayerOrchestrator(hostService, hostStore);
		
		// Create client
		clientStore = new ReactiveGameStore();
		clientService = new MultiplayerService('http://localhost:3001');
		clientOrchestrator = new MultiplayerOrchestrator(clientService, clientStore);
		
		// Mock service methods
		vi.spyOn(hostService, 'isHost').mockReturnValue(true);
		vi.spyOn(hostService, 'isConnected').mockReturnValue(true);
		vi.spyOn(clientService, 'isHost').mockReturnValue(false);
		vi.spyOn(clientService, 'isConnected').mockReturnValue(true);
		
		// Initialize both stores with same game state
		const playerNames = ['Host', 'Client', 'Bot'];
		hostStore.initialize(playerNames, 1777, 30);
		hostStore.setMultiplayerContext('player-0', new Map([
			['player-0', 0],
			['player-1', 1],
			['player-2', 2]
		]));
		
		clientStore.initialize(playerNames, 1777, 30);
		clientStore.setMultiplayerContext('player-1', new Map([
			['player-0', 0],
			['player-1', 1],
			['player-2', 2]
		]));
		
		// Setup event listeners
		hostOrchestrator.setupEventListeners();
		clientOrchestrator.setupEventListeners();
	});
	
	it('should execute pass on host when client broadcasts pass event', () => {
		// Host makes a bid first to advance turn to client
		const player0 = hostStore.gameState?.getPlayer('player-0');
		const moneyCards = player0?.getMoneyHand();
		expect(moneyCards!.length).toBeGreaterThan(0);
		
		hostStore.placeBid([moneyCards![0].id]);
		expect(hostStore.gameState?.getCurrentPlayerIndex()).toBe(1);
		
		// Verify client is active in auction
		const auctionBeforePass = hostStore.currentAuction;
		expect(auctionBeforePass).toBeDefined();
		const activePlayersBefore = Array.from(auctionBeforePass!.getActivePlayers());
		expect(activePlayersBefore).toContain('player-1');
		expect(activePlayersBefore).toHaveLength(3);
		
		// Simulate client broadcasting pass event
		const passEvent: GameEvent = {
			type: GameEventType.PASS_AUCTION,
			roomId: 'test-room',
			playerId: 'player-1',
			timestamp: Date.now(),
			data: {
				currentPlayerIndex: 1,
				timestamp: Date.now()
			}
		};
		
		// Mock broadcast to capture state sync
		const broadcastSpy = vi.spyOn(hostService, 'broadcastEvent');
		
		// Trigger pass event on host (simulating receiving from client)
		(hostService as any).eventHandlers = new Map();
		hostService.on(GameEventType.PASS_AUCTION, (event) => {
			// This is what the orchestrator does
			(hostOrchestrator as any).handlePassAuction(event);
		});
		
		// Manually call the event handlers registered by orchestrator
		const handlers = (hostService as any).eventHandlers.get(GameEventType.PASS_AUCTION);
		if (handlers) {
			handlers.forEach((handler: any) => handler(passEvent));
		}
		
		// Verify host executed the pass
		expect(hostStore.gameState?.getCurrentPlayerIndex()).toBe(2); // Advanced to next player
		
		// Verify client is no longer active
		const auctionAfterPass = hostStore.currentAuction;
		expect(auctionAfterPass).toBeDefined();
		const activePlayersAfter = Array.from(auctionAfterPass!.getActivePlayers());
		expect(activePlayersAfter).not.toContain('player-1');
		expect(activePlayersAfter).toHaveLength(2);
		
		// Verify host broadcasted state sync
		expect(broadcastSpy).toHaveBeenCalledWith(
			GameEventType.STATE_SYNC,
			expect.objectContaining({
				gameState: expect.any(Object),
				timestamp: expect.any(Number)
			})
		);
	});
	
	it('should not cause infinite loop of pass events', () => {
		// Setup: Host bids, turn advances to client
		const player0 = hostStore.gameState?.getPlayer('player-0');
		const moneyCards = player0?.getMoneyHand();
		hostStore.placeBid([moneyCards![0].id]);
		expect(hostStore.gameState?.getCurrentPlayerIndex()).toBe(1);
		
		// Track pass executions
		let passExecutionCount = 0;
		const originalPass = hostStore.pass.bind(hostStore);
		hostStore.pass = vi.fn(() => {
			passExecutionCount++;
			return originalPass();
		}) as any;
		
		// Simulate receiving multiple pass events (bug scenario)
		const baseTimestamp = Date.now();
		for (let i = 0; i < 5; i++) {
			const passEvent: GameEvent = {
				type: GameEventType.PASS_AUCTION,
				roomId: 'test-room',
				playerId: 'player-1',
				timestamp: baseTimestamp + i * 10,
				data: {
					currentPlayerIndex: 1,
					timestamp: baseTimestamp + i * 10
				}
			};
			
			// Process event through orchestrator
			(hostOrchestrator as any).handlePassAuction(passEvent);
		}
		
		// Pass should only execute once despite multiple events
		// (Event deduplication should prevent multiple executions)
		expect(passExecutionCount).toBe(1);
		
		// Turn should have advanced exactly once
		expect(hostStore.gameState?.getCurrentPlayerIndex()).toBe(2);
	});
	
	it('should handle pass correctly when only host execution matters', () => {
		// This test verifies the fix works in the real scenario
		
		// Host bids
		const player0 = hostStore.gameState?.getPlayer('player-0');
		const moneyCards = player0?.getMoneyHand();
		hostStore.placeBid([moneyCards![0].id]);
		
		const initialPlayerIndex = hostStore.gameState?.getCurrentPlayerIndex();
		expect(initialPlayerIndex).toBe(1);
		
		// Client's perspective: they would call broadcastPass()
		// which sends action:pass event to host
		const passEvent: GameEvent = {
			type: GameEventType.PASS_AUCTION,
			roomId: 'test-room',
			playerId: 'player-1',
			timestamp: Date.now(),
			data: {
				currentPlayerIndex: 1,
				timestamp: Date.now()
			}
		};
		
		// Host receives and processes the event
		(hostOrchestrator as any).handlePassAuction(passEvent);
		
		// CRITICAL: Turn should have advanced
		const newPlayerIndex = hostStore.gameState?.getCurrentPlayerIndex();
		expect(newPlayerIndex).toBe(2);
		
		// Client should be inactive
		const auction = hostStore.currentAuction;
		const activePlayers = Array.from(auction!.getActivePlayers());
		expect(activePlayers).not.toContain('player-1');
	});
	
	it('should verify pass event is deduplicated correctly', () => {
		// Test the shouldProcessEvent deduplication
		const player0 = hostStore.gameState?.getPlayer('player-0');
		const moneyCards = player0?.getMoneyHand();
		hostStore.placeBid([moneyCards![0].id]);
		
		const passEvent: GameEvent = {
			type: GameEventType.PASS_AUCTION,
			roomId: 'test-room',
			playerId: 'player-1',
			timestamp: 12345, // Fixed timestamp
			data: {
				currentPlayerIndex: 1,
				timestamp: 12345
			}
		};
		
		// First event should process
		(hostOrchestrator as any).handlePassAuction(passEvent);
		expect(hostStore.gameState?.getCurrentPlayerIndex()).toBe(2);
		
		// Exact same event (same timestamp) should be ignored
		const playerIndexBefore = hostStore.gameState?.getCurrentPlayerIndex();
		(hostOrchestrator as any).handlePassAuction(passEvent);
		const playerIndexAfter = hostStore.gameState?.getCurrentPlayerIndex();
		
		expect(playerIndexAfter).toBe(playerIndexBefore); // Should not change
	});
});
