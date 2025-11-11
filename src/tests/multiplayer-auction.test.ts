import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '$lib/domain/gameState';
import { AuctionResult } from '$lib/domain/auction';
import type { MoneyCard } from '$lib/domain/cards';

/**
 * Test the exact scenario:
 * - A (host) bids 1
 * - B bids 2
 * - C passes
 * - A bids 2 (total 3)
 * - B passes
 * 
 * Expected: Auction should complete with A as winner
 */
describe('Multiplayer Game Flow - Auction Scenario', () => {
	let gameState: GameState;
	let playerA: any; // Host
	let playerB: any;
	let playerC: any;

	beforeEach(() => {
		// Initialize game with 3 players using seed 1777 (A starts with Opera)
		gameState = new GameState('test-game', 1777);
		gameState.initializeGame(['A', 'B', 'C']);
		gameState.startNewRound();

		const players = gameState.getPlayers();
		playerA = players[0]; // Host
		playerB = players[1];
		playerC = players[2];

		console.log('=== GAME INITIALIZED ===');
		console.log('Players:', players.map(p => p.name));
		console.log('Starting player:', gameState.getCurrentPlayer().name);
	});

	it('should complete auction correctly when A bids, B bids, C passes, A bids, B passes', () => {
		const auction = gameState.getCurrentAuction();
		expect(auction).toBeTruthy();
		
		// Ensure all players are active
		expect(auction!.getActivePlayers().size).toBe(3);
		expect(auction!.getActivePlayers().has(playerA.id)).toBe(true);
		expect(auction!.getActivePlayers().has(playerB.id)).toBe(true);
		expect(auction!.getActivePlayers().has(playerC.id)).toBe(true);

		// Step 1: A bids 1
		console.log('\n=== STEP 1: A bids 1000 ===');
		const aMoney1 = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000);
		expect(aMoney1).toBeTruthy();
		
		let result = auction!.processBid(playerA, [aMoney1!]);
		console.log('Result:', result);
		console.log('A bid amount:', playerA.getCurrentBidAmount());
		console.log('Highest bid:', auction!.getCurrentHighestBid());
		console.log('Active players:', Array.from(auction!.getActivePlayers()).map(id => 
			gameState.getPlayers().find(p => p.id === id)?.name
		));
		
		expect(result).toBe(AuctionResult.CONTINUE);
		expect(playerA.getCurrentBidAmount()).toBe(1000);
		expect(auction!.getCurrentHighestBid()).toBe(1000);
		expect(auction!.getActivePlayers().size).toBe(3);

		// Move to next player (B)
		gameState.setCurrentPlayerIndex(1);
		expect(gameState.getCurrentPlayer().name).toBe('B');

		// Step 2: B bids 2
		console.log('\n=== STEP 2: B bids 2000 ===');
		const bMoney2 = playerB.getMoneyHand().find((c: MoneyCard) => c.value === 2000);
		expect(bMoney2).toBeTruthy();
		
		result = auction!.processBid(playerB, [bMoney2!]);
		console.log('Result:', result);
		console.log('B bid amount:', playerB.getCurrentBidAmount());
		console.log('Highest bid:', auction!.getCurrentHighestBid());
		console.log('Active players:', Array.from(auction!.getActivePlayers()).map(id => 
			gameState.getPlayers().find(p => p.id === id)?.name
		));
		
		expect(result).toBe(AuctionResult.CONTINUE);
		expect(playerB.getCurrentBidAmount()).toBe(2000);
		expect(auction!.getCurrentHighestBid()).toBe(2000);
		expect(auction!.getActivePlayers().size).toBe(3);

		// Move to next player (C)
		gameState.setCurrentPlayerIndex(2);
		expect(gameState.getCurrentPlayer().name).toBe('C');

		// Step 3: C passes
		console.log('\n=== STEP 3: C passes ===');
		result = auction!.processPass(playerC);
		console.log('Result:', result);
		console.log('Active players:', Array.from(auction!.getActivePlayers()).map(id => 
			gameState.getPlayers().find(p => p.id === id)?.name
		));
		
		expect(result).toBe(AuctionResult.CONTINUE);
		expect(auction!.getActivePlayers().size).toBe(2);
		expect(auction!.getActivePlayers().has(playerC.id)).toBe(false);

		// Move to next player (A)
		gameState.setCurrentPlayerIndex(0);
		expect(gameState.getCurrentPlayer().name).toBe('A');

		// Step 4: A bids 2 more (total 3)
		console.log('\n=== STEP 4: A bids 2000 more (total 3000) ===');
		const aMoney2 = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 2000);
		expect(aMoney2).toBeTruthy();
		
		result = auction!.processBid(playerA, [aMoney2!]);
		console.log('Result:', result);
		console.log('A bid amount:', playerA.getCurrentBidAmount());
		console.log('Highest bid:', auction!.getCurrentHighestBid());
		console.log('Active players:', Array.from(auction!.getActivePlayers()).map(id => 
			gameState.getPlayers().find(p => p.id === id)?.name
		));
		
		expect(result).toBe(AuctionResult.CONTINUE);
		expect(playerA.getCurrentBidAmount()).toBe(3000);
		expect(auction!.getCurrentHighestBid()).toBe(3000);
		expect(auction!.getActivePlayers().size).toBe(2);

		// Move to next player (B)
		gameState.setCurrentPlayerIndex(1);
		expect(gameState.getCurrentPlayer().name).toBe('B');

		// Step 5: B passes
		console.log('\n=== STEP 5: B passes ===');
		console.log('Before pass - Active players:', Array.from(auction!.getActivePlayers()).map(id => 
			gameState.getPlayers().find(p => p.id === id)?.name
		));
		
		result = auction!.processPass(playerB);
		console.log('Result:', result);
		console.log('After pass - Active players:', Array.from(auction!.getActivePlayers()).map(id => 
			gameState.getPlayers().find(p => p.id === id)?.name
		));
		
		// CRITICAL: This should return COMPLETE
		expect(result).toBe(AuctionResult.COMPLETE);
		expect(auction!.getActivePlayers().size).toBe(1);
		expect(auction!.getActivePlayers().has(playerA.id)).toBe(true);
		
		// Verify winner
		const winner = auction!.getWinner();
		expect(winner).toBeTruthy();
		expect(winner?.name).toBe('A');
		console.log('\n=== AUCTION COMPLETE ===');
		console.log('Winner:', winner?.name);
		console.log('Winning bid:', winner?.getCurrentBidAmount());
	});

	it('should handle the scenario from all player perspectives (simulating multiplayer)', () => {
		// This test simulates how each player sees the same auction
		// Each player processes the same sequence of events
		
		const auction = gameState.getCurrentAuction();
		expect(auction).toBeTruthy();

		// Simulate what each player would do locally
		const processPlayerAction = (playerName: string, action: 'bid' | 'pass', amount?: number) => {
			const player = gameState.getPlayers().find(p => p.name === playerName);
			expect(player).toBeTruthy();

			if (action === 'bid' && amount) {
				const moneyCard = player!.getMoneyHand().find((c: MoneyCard) => c.value === amount);
				expect(moneyCard).toBeTruthy();
				return auction!.processBid(player!, [moneyCard!]);
			} else {
				return auction!.processPass(player!);
			}
		};

		// Execute the sequence
		let result: AuctionResult;
		
		result = processPlayerAction('A', 'bid', 1000);
		expect(result).toBe(AuctionResult.CONTINUE);
		
		result = processPlayerAction('B', 'bid', 2000);
		expect(result).toBe(AuctionResult.CONTINUE);
		
		result = processPlayerAction('C', 'pass');
		expect(result).toBe(AuctionResult.CONTINUE);
		
		result = processPlayerAction('A', 'bid', 2000);
		expect(result).toBe(AuctionResult.CONTINUE);
		
		result = processPlayerAction('B', 'pass');
		expect(result).toBe(AuctionResult.COMPLETE);

		// All players should see the same winner
		const winner = auction!.getWinner();
		expect(winner?.name).toBe('A');
		expect(winner?.getCurrentBidAmount()).toBe(3000);
	});
});
