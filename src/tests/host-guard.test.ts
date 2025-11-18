import { describe, it, expect, beforeEach } from 'vitest';
import { 
	shouldExecuteGameLogic, 
	executeAsHost, 
	assertHost, 
	isClient 
} from '$lib/multiplayer/hostGuard';
import { MultiplayerService } from '$lib/multiplayer/service';

describe('Host Guard', () => {
	let hostService: MultiplayerService;
	let clientService: MultiplayerService;

	beforeEach(() => {
		// Create service instances
		hostService = new MultiplayerService('http://localhost:3001');
		clientService = new MultiplayerService('http://localhost:3001');

		// Set up host
		(hostService as any).playerId = 'host_123';
		(hostService as any).hostPlayerId = 'host_123';
		(hostService as any).roomId = 'test-room';

		// Set up client
		(clientService as any).playerId = 'client_456';
		(clientService as any).hostPlayerId = 'host_123';
		(clientService as any).roomId = 'test-room';
	});

	describe('shouldExecuteGameLogic', () => {
		it('should return true for single-player (null service)', () => {
			const result = shouldExecuteGameLogic(null);
			
			expect(result.shouldExecute).toBe(true);
			expect(result.reason).toBe('single-player');
		});

		it('should return true for host in multiplayer', () => {
			const result = shouldExecuteGameLogic(hostService);
			
			expect(result.shouldExecute).toBe(true);
			expect(result.reason).toBe('host');
		});

		it('should return false for client in multiplayer', () => {
			const result = shouldExecuteGameLogic(clientService);
			
			expect(result.shouldExecute).toBe(false);
			expect(result.reason).toBe('client');
		});
	});

	describe('executeAsHost', () => {
		it('should execute game logic in single-player mode', () => {
			let gameLogicExecuted = false;
			let broadcastExecuted = false;

			executeAsHost(
				null, // Single-player
				() => { gameLogicExecuted = true; },
				() => { broadcastExecuted = true; }
			);

			expect(gameLogicExecuted).toBe(true);
			expect(broadcastExecuted).toBe(false);
		});

		it('should execute game logic when host', () => {
			let gameLogicExecuted = false;
			let broadcastExecuted = false;

			executeAsHost(
				hostService,
				() => { gameLogicExecuted = true; },
				() => { broadcastExecuted = true; }
			);

			expect(gameLogicExecuted).toBe(true);
			expect(broadcastExecuted).toBe(false);
		});

		it('should execute broadcast when client', () => {
			let gameLogicExecuted = false;
			let broadcastExecuted = false;

			executeAsHost(
				clientService,
				() => { gameLogicExecuted = true; },
				() => { broadcastExecuted = true; }
			);

			expect(gameLogicExecuted).toBe(false);
			expect(broadcastExecuted).toBe(true);
		});

		it('should return game logic result when host', () => {
			const result = executeAsHost(
				hostService,
				() => ({ success: true, value: 42 }),
				() => ({ broadcast: true })
			);

			expect(result).toEqual({ success: true, value: 42 });
		});

		it('should return broadcast result when client', () => {
			const result = executeAsHost(
				clientService,
				() => ({ success: true, value: 42 }),
				() => ({ broadcast: true })
			);

			expect(result).toEqual({ broadcast: true });
		});
	});

	describe('assertHost', () => {
		it('should not throw in single-player mode', () => {
			expect(() => {
				assertHost(null, 'testOperation');
			}).not.toThrow();
		});

		it('should not throw when host', () => {
			expect(() => {
				assertHost(hostService, 'testOperation');
			}).not.toThrow();
		});

		it('should throw when client', () => {
			expect(() => {
				assertHost(clientService, 'testOperation');
			}).toThrow(/testOperation.*can only be executed by the host/);
		});

		it('should include operation name in error message', () => {
			expect(() => {
				assertHost(clientService, 'startNewRound');
			}).toThrow(/startNewRound/);
		});

		it('should indicate client role in error message', () => {
			expect(() => {
				assertHost(clientService, 'testOperation');
			}).toThrow(/client/);
		});
	});

	describe('isClient', () => {
		it('should return false in single-player mode', () => {
			expect(isClient(null)).toBe(false);
		});

		it('should return false when host', () => {
			expect(isClient(hostService)).toBe(false);
		});

		it('should return true when client', () => {
			expect(isClient(clientService)).toBe(true);
		});
	});

	describe('Real-world usage patterns', () => {
		it('should protect pass() function correctly', () => {
			// Simulate pass function behavior
			function simulatePass(service: MultiplayerService | null) {
				const guard = shouldExecuteGameLogic(service);
				
				if (!guard.shouldExecute) {
					// Client: broadcast only
					return { broadcasted: true, executed: false };
				}
				
				// Host/single-player: execute game logic
				return { broadcasted: false, executed: true };
			}

			// Single-player executes
			expect(simulatePass(null)).toEqual({ broadcasted: false, executed: true });
			
			// Host executes
			expect(simulatePass(hostService)).toEqual({ broadcasted: false, executed: true });
			
			// Client broadcasts
			expect(simulatePass(clientService)).toEqual({ broadcasted: true, executed: false });
		});

		it('should protect placeBid() function correctly', () => {
			// Simulate placeBid function behavior
			function simulatePlaceBid(service: MultiplayerService | null) {
				const guard = shouldExecuteGameLogic(service);
				
				if (!guard.shouldExecute) {
					// Client: broadcast only
					return { action: 'broadcast', role: guard.reason };
				}
				
				// Host/single-player: execute game logic
				return { action: 'execute', role: guard.reason };
			}

			expect(simulatePlaceBid(null)).toEqual({ action: 'execute', role: 'single-player' });
			expect(simulatePlaceBid(hostService)).toEqual({ action: 'execute', role: 'host' });
			expect(simulatePlaceBid(clientService)).toEqual({ action: 'broadcast', role: 'client' });
		});

		it('should handle startNewRound with assertHost', () => {
			function simulateStartNewRound(service: MultiplayerService | null) {
				assertHost(service, 'startNewRound');
				return { roundStarted: true };
			}

			// Single-player can start round
			expect(() => simulateStartNewRound(null)).not.toThrow();
			
			// Host can start round
			expect(() => simulateStartNewRound(hostService)).not.toThrow();
			
			// Client cannot start round
			expect(() => simulateStartNewRound(clientService)).toThrow();
		});
	});
});
