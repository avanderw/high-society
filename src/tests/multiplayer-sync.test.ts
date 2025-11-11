import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '$lib/domain/gameState';
import { AuctionResult } from '$lib/domain/auction';
import type { MoneyCard } from '$lib/domain/cards';
import { GameEventType } from '$lib/multiplayer/events';

/**
 * Test multiplayer event synchronization
 * Simulates the exact bug: Host sees auction complete, clients don't
 */
describe('Multiplayer Event Synchronization', () => {
	it('should keep all players in sync when B passes to complete auction', () => {
		// Setup 3 separate game states (simulating 3 clients)
		const hostGame = new GameState('host-game');
		const clientBGame = new GameState('client-b-game');
		const clientCGame = new GameState('client-c-game');

		// Initialize all with same players
		[hostGame, clientBGame, clientCGame].forEach(game => {
			game.initializeGame(['A', 'B', 'C']);
			game.startNewRound();
		});

		// Execute the sequence on all games
		const executeOnAllGames = (playerIndex: number, action: 'bid' | 'pass', bidAmount?: number) => {
			const games = [hostGame, clientBGame, clientCGame];
			const results: AuctionResult[] = [];

			games.forEach(game => {
				const player = game.getPlayers()[playerIndex];
				const auction = game.getCurrentAuction()!;

				if (action === 'bid' && bidAmount) {
					const moneyCard = player.getMoneyHand().find((c: MoneyCard) => c.value === bidAmount)!;
					results.push(auction.processBid(player, [moneyCard]));
				} else {
					results.push(auction.processPass(player));
				}
			});

			// All games should return the same result
			const firstResult = results[0];
			results.forEach(result => {
				expect(result).toBe(firstResult);
			});

			return firstResult;
		};

		// A bids 1000
		let result = executeOnAllGames(0, 'bid', 1000);
		expect(result).toBe(AuctionResult.CONTINUE);

		// B bids 2000  
		result = executeOnAllGames(1, 'bid', 2000);
		expect(result).toBe(AuctionResult.CONTINUE);

		// C passes
		result = executeOnAllGames(2, 'pass');
		expect(result).toBe(AuctionResult.CONTINUE);

		// A bids 2000 more
		result = executeOnAllGames(0, 'bid', 2000);
		expect(result).toBe(AuctionResult.CONTINUE);

		// B passes - THIS IS THE CRITICAL MOMENT
		console.log('\n=== CRITICAL: B PASSES ===');
		console.log('Host active players before:', Array.from(hostGame.getCurrentAuction()!.getActivePlayers()));
		console.log('Client B active players before:', Array.from(clientBGame.getCurrentAuction()!.getActivePlayers()));
		console.log('Client C active players before:', Array.from(clientCGame.getCurrentAuction()!.getActivePlayers()));

		result = executeOnAllGames(1, 'pass');
		
		console.log('Result on all games:', result);
		console.log('Host active players after:', Array.from(hostGame.getCurrentAuction()!.getActivePlayers()));
		console.log('Client B active players after:', Array.from(clientBGame.getCurrentAuction()!.getActivePlayers()));
		console.log('Client C active players after:', Array.from(clientCGame.getCurrentAuction()!.getActivePlayers()));

		// CRITICAL: All games should show COMPLETE
		expect(result).toBe(AuctionResult.COMPLETE);

		// All games should have the same winner
		const hostWinner = hostGame.getCurrentAuction()!.getWinner();
		const clientBWinner = clientBGame.getCurrentAuction()!.getWinner();
		const clientCWinner = clientCGame.getCurrentAuction()!.getWinner();

		expect(hostWinner?.name).toBe('A');
		expect(clientBWinner?.name).toBe('A');
		expect(clientCWinner?.name).toBe('A');

		// All should have 1 active player
		expect(hostGame.getCurrentAuction()!.getActivePlayers().size).toBe(1);
		expect(clientBGame.getCurrentAuction()!.getActivePlayers().size).toBe(1);
		expect(clientCGame.getCurrentAuction()!.getActivePlayers().size).toBe(1);
	});

	it('should demonstrate the bug: Client B skips own pass event', () => {
		// This test demonstrates what happens in the real multiplayer scenario
		
		// Host's game state
		const hostGame = new GameState('host');
		hostGame.initializeGame(['A', 'B', 'C']);
		hostGame.startNewRound();

		// Client B's game state  
		const clientBGame = new GameState('client-b');
		clientBGame.initializeGame(['A', 'B', 'C']);
		clientBGame.startNewRound();

		// Execute sequence
		const playerA_host = hostGame.getPlayers()[0];
		const playerB_host = hostGame.getPlayers()[1];
		const playerC_host = hostGame.getPlayers()[2];

		const playerA_clientB = clientBGame.getPlayers()[0];
		const playerB_clientB = clientBGame.getPlayers()[1];
		const playerC_clientB = clientBGame.getPlayers()[2];

		const hostAuction = hostGame.getCurrentAuction()!;
		const clientBAuction = clientBGame.getCurrentAuction()!;

		// A bids 1000 (both process)
		hostAuction.processBid(playerA_host, [playerA_host.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!]);
		clientBAuction.processBid(playerA_clientB, [playerA_clientB.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!]);

		// B bids 2000 (both process)
		hostAuction.processBid(playerB_host, [playerB_host.getMoneyHand().find((c: MoneyCard) => c.value === 2000)!]);
		clientBAuction.processBid(playerB_clientB, [playerB_clientB.getMoneyHand().find((c: MoneyCard) => c.value === 2000)!]);

		// C passes (both process)
		hostAuction.processPass(playerC_host);
		clientBAuction.processPass(playerC_clientB);

		// A bids 2000 more (both process)
		hostAuction.processBid(playerA_host, [playerA_host.getMoneyHand().find((c: MoneyCard) => c.value === 2000)!]);
		clientBAuction.processBid(playerA_clientB, [playerA_clientB.getMoneyHand().find((c: MoneyCard) => c.value === 2000)!]);

		// B passes - CRITICAL MOMENT
		// In real multiplayer:
		// 1. Client B calls pass() locally
		const resultClientB = clientBAuction.processPass(playerB_clientB);
		console.log('Client B processed own pass:', resultClientB);
		
		// 2. Client B broadcasts PASS event
		// 3. Host receives PASS event from B
		const resultHost = hostAuction.processPass(playerB_host);
		console.log('Host processed B pass:', resultHost);
		
		// 4. Client B receives OWN PASS event broadcast - SKIPS IT (correct!)
		// So Client B doesn't process it again
		
		// BOTH should show complete
		expect(resultClientB).toBe(AuctionResult.COMPLETE);
		expect(resultHost).toBe(AuctionResult.COMPLETE);

		// Both should have same winner
		expect(hostAuction.getWinner()?.name).toBe('A');
		expect(clientBAuction.getWinner()?.name).toBe('A');
	});

	it('should clear bid state between rounds - Player.discardPlayedMoney() test', () => {
		// This test focuses specifically on the bid clearing issue you described
		// Setup a simple game with one auction
		const game = new GameState('test-game');
		game.initializeGame(['A', 'B', 'C']);
		game.startNewRound();

		const [playerA, playerB, playerC] = game.getPlayers();
		const auction1 = game.getCurrentAuction()!;

		console.log('\n=== ROUND 1 ===');

		// A bids 1000
		auction1.processBid(playerA, [playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!]);
		console.log(`A bid: ${playerA.getCurrentBidAmount()}`);
		expect(playerA.getCurrentBidAmount()).toBe(1000);

		// B bids 4000
		auction1.processBid(playerB, [playerB.getMoneyHand().find((c: MoneyCard) => c.value === 4000)!]);
		console.log(`B bid: ${playerB.getCurrentBidAmount()}`);
		expect(playerB.getCurrentBidAmount()).toBe(4000);

		// C passes
		auction1.processPass(playerC);
		console.log(`C bid: ${playerC.getCurrentBidAmount()}`);
		expect(playerC.getCurrentBidAmount()).toBe(0);

		// A bids 8000 more (total 9000)
		auction1.processBid(playerA, [playerA.getMoneyHand().find((c: MoneyCard) => c.value === 8000)!]);
		console.log(`A bid: ${playerA.getCurrentBidAmount()}`);
		expect(playerA.getCurrentBidAmount()).toBe(9000);

		// B bids 8000 more (total 12000)
		auction1.processBid(playerB, [playerB.getMoneyHand().find((c: MoneyCard) => c.value === 8000)!]);
		console.log(`B bid: ${playerB.getCurrentBidAmount()}`);
		expect(playerB.getCurrentBidAmount()).toBe(12000);

		// A passes - auction should complete
		const result = auction1.processPass(playerA);
		expect(result).toBe(AuctionResult.COMPLETE);
		expect(auction1.getWinner()?.name).toBe('B');
		console.log(`Winner: ${auction1.getWinner()?.name} with bid ${auction1.getWinner()?.getCurrentBidAmount()}`);

		// Complete auction - this should discard B's money
		console.log('\n=== COMPLETING ROUND 1 ===');
		console.log(`Before completeAuction - B's bid: ${playerB.getCurrentBidAmount()}`);
		game.completeAuction();
		console.log(`After completeAuction - B's bid: ${playerB.getCurrentBidAmount()}`);
		
		// CRITICAL: B's bid should be cleared to 0
		expect(playerB.getCurrentBidAmount()).toBe(0);
		
		// Also verify A's bid was cleared (they passed, so money returned)
		expect(playerA.getCurrentBidAmount()).toBe(0);

		// Start round 2
		console.log('\n=== ROUND 2 ===');
		game.startNewRound();
		const auction2 = game.getCurrentAuction()!;

		// Verify all players start with 0 bid
		console.log(`A bid at start of round 2: ${playerA.getCurrentBidAmount()}`);
		console.log(`B bid at start of round 2: ${playerB.getCurrentBidAmount()}`);
		console.log(`C bid at start of round 2: ${playerC.getCurrentBidAmount()}`);
		
		expect(playerA.getCurrentBidAmount()).toBe(0);
		expect(playerB.getCurrentBidAmount()).toBe(0);
		expect(playerC.getCurrentBidAmount()).toBe(0);

		// B (the winner from round 1) starts round 2 and bids 10000
		auction2.processBid(playerB, [playerB.getMoneyHand().find((c: MoneyCard) => c.value === 10000)!]);
		console.log(`B bids 10000 in round 2, total bid: ${playerB.getCurrentBidAmount()}`);

		// CRITICAL: B's bid should be 10000, NOT 14000 (12000 from round 1 + 10000)
		expect(playerB.getCurrentBidAmount()).toBe(10000);
		expect(auction2.getCurrentHighestBid()).toBe(10000);
	});

	it('should clear bid state in multiplayer scenario with serialization', async () => {
		// This simulates the ACTUAL multiplayer flow:
		// 1. Host completes auction
		// 2. Host serializes state
		// 3. Clients deserialize state
		
		const { serializeGameState, deserializeGameState } = await import('$lib/multiplayer/serialization');
		
		// Setup host game
		const hostGame = new GameState('test-game');
		hostGame.initializeGame(['A', 'B', 'C']);
		hostGame.startNewRound();

		const [playerA, playerB, playerC] = hostGame.getPlayers();
		const auction1 = hostGame.getCurrentAuction()!;

		console.log('\n=== HOST: ROUND 1 ===');

		// A bids 1000
		auction1.processBid(playerA, [playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!]);
		expect(playerA.getCurrentBidAmount()).toBe(1000);

		// B bids 4000
		auction1.processBid(playerB, [playerB.getMoneyHand().find((c: MoneyCard) => c.value === 4000)!]);
		expect(playerB.getCurrentBidAmount()).toBe(4000);

		// C passes
		auction1.processPass(playerC);

		// A bids 8000 more (total 9000)
		auction1.processBid(playerA, [playerA.getMoneyHand().find((c: MoneyCard) => c.value === 8000)!]);
		expect(playerA.getCurrentBidAmount()).toBe(9000);

		// B bids 8000 more (total 12000)
		auction1.processBid(playerB, [playerB.getMoneyHand().find((c: MoneyCard) => c.value === 8000)!]);
		console.log(`B's bid after bidding 8000 more: ${playerB.getCurrentBidAmount()}`);
		expect(playerB.getCurrentBidAmount()).toBe(12000);

		// A passes - auction completes
		const result = auction1.processPass(playerA);
		expect(result).toBe(AuctionResult.COMPLETE);

		console.log('\n=== HOST: COMPLETING AUCTION ===');
		console.log(`B's bid before completeAuction: ${playerB.getCurrentBidAmount()}`);
		
		// Host completes auction
		hostGame.completeAuction();
		
		console.log(`B's bid after completeAuction: ${playerB.getCurrentBidAmount()}`);
		expect(playerB.getCurrentBidAmount()).toBe(0);

		// Host starts next round
		hostGame.startNewRound();
		
		console.log('\n=== HOST: SERIALIZING STATE FOR BROADCAST ===');
		// Host serializes state to broadcast to clients
		const serializedState = serializeGameState(hostGame);
		console.log('Serialized player B playedMoney:', JSON.stringify(serializedState.players[1].playedMoney));
		
		// Verify serialized state shows B with 0 bid
		expect(serializedState.players[1].playedMoney).toEqual([]);
		
		console.log('\n=== CLIENT: DESERIALIZING STATE ===');
		// Client creates empty game state
		const clientGame = new GameState('test-game');
		clientGame.initializeGame(['A', 'B', 'C']);
		
		// Client receives and deserializes host's state
		const deserializedGame = deserializeGameState(serializedState, clientGame);
		
		const clientPlayerB = deserializedGame.getPlayers()[1];
		console.log(`Client B's bid after deserialization: ${clientPlayerB.getCurrentBidAmount()}`);
		console.log(`Client B's playedMoney: ${JSON.stringify(clientPlayerB.getPlayedMoney())}`);
		
		// CRITICAL: Client should see B with 0 bid
		expect(clientPlayerB.getCurrentBidAmount()).toBe(0);
		
		// Now B bids in round 2
		console.log('\n=== ROUND 2: B BIDS ===');
		const auction2 = deserializedGame.getCurrentAuction()!;
		auction2.processBid(clientPlayerB, [clientPlayerB.getMoneyHand().find((c: MoneyCard) => c.value === 10000)!]);
		
		console.log(`Client B's bid after bidding 10000: ${clientPlayerB.getCurrentBidAmount()}`);
		
		// CRITICAL: Should be 10000, not 14000
		expect(clientPlayerB.getCurrentBidAmount()).toBe(10000);
		expect(auction2.getCurrentHighestBid()).toBe(10000);
	});

	it('BUG SCENARIO: Client doesnt receive AUCTION_COMPLETE and bids with stale state', async () => {
		// This test demonstrates what happens if a client doesn't properly
		// sync state after auction completion
		
		const { serializeGameState, deserializeGameState } = await import('$lib/multiplayer/serialization');
		
		// Setup client game - round 1
		const clientGame = new GameState('test-game');
		clientGame.initializeGame(['A', 'B', 'C']);
		clientGame.startNewRound();

		const [playerA, playerB, playerC] = clientGame.getPlayers();
		const auction1 = clientGame.getCurrentAuction()!;

		console.log('\n=== CLIENT: ROUND 1 (all events processed correctly) ===');

		// Process all round 1 events
		auction1.processBid(playerA, [playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!]);
		auction1.processBid(playerB, [playerB.getMoneyHand().find((c: MoneyCard) => c.value === 4000)!]);
		auction1.processPass(playerC);
		auction1.processBid(playerA, [playerA.getMoneyHand().find((c: MoneyCard) => c.value === 8000)!]);
		auction1.processBid(playerB, [playerB.getMoneyHand().find((c: MoneyCard) => c.value === 8000)!]);
		
		console.log(`Client B's bid after round 1: ${playerB.getCurrentBidAmount()}`);
		expect(playerB.getCurrentBidAmount()).toBe(12000);

		// A passes - auction completes
		auction1.processPass(playerA);

		// BUG SCENARIO: Client SHOULD call completeAuction and startNewRound
		// via the AUCTION_COMPLETE event from host, but let's say they DON'T
		// because the event is lost/delayed/not processed
		
		console.log('\n=== CLIENT: SKIPPING AUCTION_COMPLETE EVENT (BUG!) ===');
		console.log(`Client B's bid (should be cleared but isn't): ${playerB.getCurrentBidAmount()}`);
		
		// Client still has stale state - B's played money is still there
		expect(playerB.getCurrentBidAmount()).toBe(12000); // STALE!
		
		// Now the host moves to round 2 and broadcasts START_ROUND or similar
		// Client tries to manually start round 2 without proper cleanup
		console.log('\n=== CLIENT: Starting round 2 WITHOUT proper state sync ===');
		
		// If client just calls startNewRound() without calling completeAuction first...
		// Actually, let's simulate what happens if they get the host's serialized state
		// but it's from AFTER startNewRound was called
		
		const hostGame = new GameState('test-game');
		hostGame.initializeGame(['A', 'B', 'C']);
		hostGame.startNewRound();
		
		// Simulate host completing round 1
		const [hostA, hostB, hostC] = hostGame.getPlayers();
		const hostAuction1 = hostGame.getCurrentAuction()!;
		hostAuction1.processBid(hostA, [hostA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!]);
		hostAuction1.processBid(hostB, [hostB.getMoneyHand().find((c: MoneyCard) => c.value === 4000)!]);
		hostAuction1.processPass(hostC);
		hostAuction1.processBid(hostA, [hostA.getMoneyHand().find((c: MoneyCard) => c.value === 8000)!]);
		hostAuction1.processBid(hostB, [hostB.getMoneyHand().find((c: MoneyCard) => c.value === 8000)!]);
		hostAuction1.processPass(hostA);
		hostGame.completeAuction();
		hostGame.startNewRound();
		
		// Host broadcasts round 2 state
		const round2State = serializeGameState(hostGame);
		
		// THIS IS THE KEY: If client deserializes into their EXISTING gameState
		// that still has Player objects with playedMoney...
		console.log('\n=== CLIENT: Deserializing round 2 state into STALE game ===');
		console.log(`Before deserialization - Client B bid: ${clientGame.getPlayers()[1].getCurrentBidAmount()}`);
		
		// This should update the game state
		const updatedGame = deserializeGameState(round2State, clientGame);
		
		console.log(`After deserialization - Client B bid: ${updatedGame.getPlayers()[1].getCurrentBidAmount()}`);
		
		// If deserialization works correctly, B should have 0 bid now
		expect(updatedGame.getPlayers()[1].getCurrentBidAmount()).toBe(0);
		
		// Now B tries to bid in round 2
		const auction2 = updatedGame.getCurrentAuction()!;
		const updatedPlayerB = updatedGame.getPlayers()[1];
		auction2.processBid(updatedPlayerB, [updatedPlayerB.getMoneyHand().find((c: MoneyCard) => c.value === 10000)!]);
		
		console.log(`Client B's bid after bidding 10000 in round 2: ${updatedPlayerB.getCurrentBidAmount()}`);
		
		// Should be 10000 if deserialization worked
		expect(updatedPlayerB.getCurrentBidAmount()).toBe(10000);
	});
});
