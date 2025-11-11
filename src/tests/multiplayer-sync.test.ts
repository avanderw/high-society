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
});
