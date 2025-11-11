import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, GamePhase } from '$lib/domain/gameState';
import { LuxuryCard, DisgracePassé, PrestigeCard } from '$lib/domain/cards';
import { AuctionResult, RegularAuction, DisgraceAuction } from '$lib/domain/auction';
import type { MoneyCard } from '$lib/domain/cards';

/**
 * Tests for auction completion scenarios:
 * - Regular auction completion
 * - Disgrace auction completion
 * - No-bid auctions (everyone passes)
 * - State cleanup between rounds
 * - Money card discarding and returning
 */
describe('Auction Completion', () => {
	// Use incrementing seeds to ensure each test suite has deterministic but unique state
	let testSeed = 10000;
	
	describe('Regular Auction Completion', () => {
		let gameState: GameState;

		beforeEach(() => {
			// Use seed 10021 - player-0 starts, first 3 cards: Opera, Art, Fashion (all luxury)
			gameState = new GameState('test-game', 10021);
			gameState.initializeGame(['player-0', 'player-1', 'player-2']);
			gameState.startNewRound();
		});

		it('should complete when only one player remains', () => {
			const [playerA, playerB, playerC] = gameState.getPlayers();
			const auction = gameState.getCurrentAuction()!;

			// A bids
			const aMoney = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			auction.processBid(playerA, [aMoney]);

			// B passes
			let result = auction.processPass(playerB);
			expect(result).toBe(AuctionResult.CONTINUE);

			// C passes
			result = auction.processPass(playerC);
			expect(result).toBe(AuctionResult.COMPLETE);

			// A should be the winner
			expect(auction.getWinner()?.id).toBe(playerA.id);
		});

		it('should complete when last two players pass in sequence', () => {
			const [playerA, playerB, playerC] = gameState.getPlayers();
			const auction = gameState.getCurrentAuction()!;

			// A bids
			const aMoney = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			auction.processBid(playerA, [aMoney]);

			// B bids higher
			const bMoney = playerB.getMoneyHand().find((c: MoneyCard) => c.value === 2000)!;
			auction.processBid(playerB, [bMoney]);

			// A passes
			auction.processPass(playerA);

			// C passes
			const result = auction.processPass(playerC);
			expect(result).toBe(AuctionResult.COMPLETE);

			// B should be the winner
			expect(auction.getWinner()?.id).toBe(playerB.id);
		});

		it('should handle winner with no bid (everyone else passed without bidding)', () => {
			const [playerA, playerB, playerC] = gameState.getPlayers();
			const auction = gameState.getCurrentAuction()!;

			// Everyone passes without bidding
			auction.processPass(playerA);
			auction.processPass(playerB);

			// C is last remaining
			const result = auction.processPass(playerC);
			
			// The last player should be considered the "winner" even with no bid
			expect(result).toBe(AuctionResult.COMPLETE);
			expect(auction.getWinner()).toBeTruthy();
		});

		it('should discard winner money and give them the card', () => {
			const [playerA, playerB, playerC] = gameState.getPlayers();
			const auction = gameState.getCurrentAuction()!;
			const card = auction.getCard();

			// Track initial money count
			const initialMoneyCount = playerA.getMoneyHand().length;

			// A bids 3000
			const a1 = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			const a2 = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 2000)!;
			auction.processBid(playerA, [a1, a2]);

			// B and C pass
			auction.processPass(playerB);
			auction.processPass(playerC);

			// Complete the auction
			gameState.completeAuction();

			// A should have the card
			expect(playerA.getStatusCards()).toContainEqual(card);

			// A's played money should be discarded (currentBid = 0)
			expect(playerA.getCurrentBidAmount()).toBe(0);

			// A should have 2 fewer cards in hand
			expect(playerA.getMoneyHand().length).toBe(initialMoneyCount - 2);
		});

		it('should return money to players who passed', () => {
			const [playerA, playerB, playerC] = gameState.getPlayers();
			const auction = gameState.getCurrentAuction()!;

			const initialMoneyCountA = playerA.getMoneyHand().length;
			const initialMoneyCountB = playerB.getMoneyHand().length;

			// A bids 1000
			const aMoney = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			auction.processBid(playerA, [aMoney]);

			// B bids 2000
			const bMoney = playerB.getMoneyHand().find((c: MoneyCard) => c.value === 2000)!;
			auction.processBid(playerB, [bMoney]);

			// A passes (money returned)
			auction.processPass(playerA);
			expect(playerA.getCurrentBidAmount()).toBe(0);
			expect(playerA.getMoneyHand().length).toBe(initialMoneyCountA);

			// C passes
			auction.processPass(playerC);

			// B wins, complete auction
			gameState.completeAuction();

			// B's money discarded
			expect(playerB.getCurrentBidAmount()).toBe(0);
			expect(playerB.getMoneyHand().length).toBe(initialMoneyCountB - 1);
		});
	});

	describe('No-Bid Auctions', () => {
		let gameState: GameState;

		beforeEach(() => {
			gameState = new GameState('test-game', testSeed++);
			gameState.initializeGame(['A', 'B', 'C']);
			gameState.startNewRound();
		});

		it('should complete when everyone passes without bidding', () => {
			const [playerA, playerB, playerC] = gameState.getPlayers();
			const auction = gameState.getCurrentAuction()!;

			// Everyone passes
			auction.processPass(playerA);
			auction.processPass(playerB);
			const result = auction.processPass(playerC);

			expect(result).toBe(AuctionResult.COMPLETE);
			
			// Last player gets the card for free
			const winner = auction.getWinner();
			expect(winner).toBeTruthy();
		});

		it('should give card to last remaining player for free', () => {
			const [playerA, playerB, playerC] = gameState.getPlayers();
			const auction = gameState.getCurrentAuction()!;
			const card = auction.getCard();

			const initialMoneyCount = playerC.getMoneyHand().length;

			// A and B pass
			auction.processPass(playerA);
			auction.processPass(playerB);

			// C is the last one
			auction.processPass(playerC);

			gameState.completeAuction();

			// C gets the card
			expect(playerC.getStatusCards()).toContainEqual(card);

			// C didn't spend any money
			expect(playerC.getMoneyHand().length).toBe(initialMoneyCount);
		});
	});

	describe('State Cleanup Between Rounds', () => {
		let gameState: GameState;

		beforeEach(() => {
			// Use seed 10021 - player-0 starts, first 3 cards: Opera, Art, Fashion (all luxury)
			gameState = new GameState('test-game', 10021);
			gameState.initializeGame(['A', 'B', 'C']);
			gameState.startNewRound();
		});

		it('should clear all player bids when starting new round', () => {
			const [playerA, playerB, playerC] = gameState.getPlayers();
			const auction = gameState.getCurrentAuction()!;

			// Round 1: A wins with bid
			const aMoney = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			auction.processBid(playerA, [aMoney]);
			auction.processPass(playerB);
			auction.processPass(playerC);

			expect(playerA.getCurrentBidAmount()).toBe(1000);

			// Complete round
			gameState.completeAuction();

			// Bids should be cleared
			expect(playerA.getCurrentBidAmount()).toBe(0);
			expect(playerB.getCurrentBidAmount()).toBe(0);
			expect(playerC.getCurrentBidAmount()).toBe(0);

			// Start round 2
			gameState.startNewRound();

			// All players should start with 0 bid
			gameState.getPlayers().forEach(player => {
				expect(player.getCurrentBidAmount()).toBe(0);
			});
		});

		it('should maintain status cards between rounds', () => {
			const [playerA, playerB, playerC] = gameState.getPlayers();
			const auction = gameState.getCurrentAuction()!;
			const card1 = auction.getCard();

			// Round 1: A wins
			const aMoney = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			auction.processBid(playerA, [aMoney]);
			auction.processPass(playerB);
			auction.processPass(playerC);
			gameState.completeAuction();

			expect(playerA.getStatusCards()).toHaveLength(1);
			expect(playerA.getStatusCards()[0]).toBe(card1);

			// Start round 2 (might end game if 4th trigger is drawn)
			gameState.startNewRound();

			// A should still have the card from round 1 (regardless of game phase)
			expect(playerA.getStatusCards()).toHaveLength(1);
			expect(playerA.getStatusCards()[0]).toBe(card1);
		});

		it('should handle multiple rounds correctly', () => {
			const [playerA, playerB, playerC] = gameState.getPlayers();

			// Round 1: A wins
			let auction = gameState.getCurrentAuction()!;
			let aMoney = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			auction.processBid(playerA, [aMoney]);
			auction.processPass(playerB);
			auction.processPass(playerC);
			gameState.completeAuction();

			expect(playerA.getStatusCards()).toHaveLength(1);

			// Round 2: B wins (if game hasn't ended)
			gameState.startNewRound();
			auction = gameState.getCurrentAuction()!;
			
			// Skip if game ended (4th trigger drawn)
			if (!auction) {
				expect(gameState.getCurrentPhase()).toBe(GamePhase.SCORING);
				return;
			}
			
			let bMoney = playerB.getMoneyHand().find((c: MoneyCard) => c.value === 2000)!;
			auction.processBid(playerB, [bMoney]);
			auction.processPass(playerA);
			auction.processPass(playerC);
			gameState.completeAuction();

			expect(playerA.getStatusCards()).toHaveLength(1);
			expect(playerB.getStatusCards()).toHaveLength(1);

			// Round 3: C wins (if game hasn't ended)
			gameState.startNewRound();
			auction = gameState.getCurrentAuction()!;
			
			// Skip if game ended (4th trigger drawn)
			if (!auction) {
				expect(gameState.getCurrentPhase()).toBe(GamePhase.SCORING);
				return;
			}
			
			let cMoney = playerC.getMoneyHand().find((c: MoneyCard) => c.value === 3000)!;
			auction.processBid(playerC, [cMoney]);
			auction.processPass(playerA);
			auction.processPass(playerB);
			gameState.completeAuction();

			expect(playerA.getStatusCards()).toHaveLength(1);
			expect(playerB.getStatusCards()).toHaveLength(1);
			expect(playerC.getStatusCards()).toHaveLength(1);
		});

		it('should update starting player after auction', () => {
			const [playerA, playerB, playerC] = gameState.getPlayers();
			const auction = gameState.getCurrentAuction()!;

			// B wins the auction
			const bMoney = playerB.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			auction.processBid(playerB, [bMoney]);
			auction.processPass(playerA);
			auction.processPass(playerC);

			gameState.completeAuction();

			// B should be the current player for next round
			expect(gameState.getCurrentPlayerIndex()).toBe(1); // B is index 1
		});
	});

	describe('Disgrace Auction Completion', () => {
		it('should complete immediately when first player passes', () => {
			const gameState = new GameState('test-game', testSeed++);
			gameState.initializeGame(['A', 'B', 'C']);
			const players = gameState.getPlayers();

			const disgrace = new DisgracePassé();
			const auction = new DisgraceAuction(disgrace, players);

			const [playerA, playerB, playerC] = players;

			// A bids to avoid
			const aMoney = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			auction.processBid(playerA, [aMoney]);

			// B passes - gets the disgrace card
			const result = auction.processPass(playerB);

			expect(result).toBe(AuctionResult.COMPLETE);
			expect(auction.getWinner()?.id).toBe(playerB.id);
		});

		it('should discard money from non-passing players', () => {
			const gameState = new GameState('test-game', testSeed++);
			gameState.initializeGame(['A', 'B', 'C']);
			const players = gameState.getPlayers();

			const disgrace = new DisgracePassé();
			const auction = new DisgraceAuction(disgrace, players);

			const [playerA, playerB, playerC] = players;

			const initialCountA = playerA.getMoneyHand().length;
			const initialCountC = playerC.getMoneyHand().length;

			// A bids 1000
			const aMoney = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			auction.processBid(playerA, [aMoney]);

			// C bids 2000
			const cMoney = playerC.getMoneyHand().find((c: MoneyCard) => c.value === 2000)!;
			auction.processBid(playerC, [cMoney]);

			// B passes
			auction.processPass(playerB);

			// A and C's money should be discarded
			expect(playerA.getCurrentBidAmount()).toBe(0);
			expect(playerC.getCurrentBidAmount()).toBe(0);

			// They should have fewer cards
			expect(playerA.getMoneyHand().length).toBe(initialCountA - 1);
			expect(playerC.getMoneyHand().length).toBe(initialCountC - 1);
		});

		it('should return money to passing player', () => {
			const gameState = new GameState('test-game', testSeed++);
			gameState.initializeGame(['A', 'B', 'C']);
			const players = gameState.getPlayers();

			const disgrace = new DisgracePassé();
			const auction = new DisgraceAuction(disgrace, players);

			const [playerA, playerB] = players;

			const initialCountA = playerA.getMoneyHand().length;

			// A bids 1000
			const aMoney = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			auction.processBid(playerA, [aMoney]);

			// B passes - gets money back
			auction.processPass(playerB);

			// A's money discarded
			expect(playerA.getCurrentBidAmount()).toBe(0);
			expect(playerA.getMoneyHand().length).toBe(initialCountA - 1);

			// B's money returned (they never bid)
			expect(playerB.getCurrentBidAmount()).toBe(0);
		});
	});

	describe('Edge Cases', () => {
		it('should handle auction with only 2 players', () => {
			const gameState = new GameState('test-game', testSeed++);
			gameState.initializeGame(['A', 'B']);
			gameState.startNewRound();

			const [playerA, playerB] = gameState.getPlayers();
			const auction = gameState.getCurrentAuction()!;

			// A bids
			const aMoney = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			auction.processBid(playerA, [aMoney]);

			// B passes - auction completes
			const result = auction.processPass(playerB);

			expect(result).toBe(AuctionResult.COMPLETE);
			expect(auction.getWinner()?.id).toBe(playerA.id);
		});

		it('should handle auction with 5 players', () => {
			const gameState = new GameState('test-game', testSeed++);
			gameState.initializeGame(['A', 'B', 'C', 'D', 'E']);
			gameState.startNewRound();

			const players = gameState.getPlayers();
			const auction = gameState.getCurrentAuction()!;

			// A bids
			const aMoney = players[0].getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			auction.processBid(players[0], [aMoney]);

			// B, C, D pass
			auction.processPass(players[1]);
			auction.processPass(players[2]);
			auction.processPass(players[3]);

			// Should still be active with 2 players
			expect(auction.isComplete()).toBe(false);

			// E passes - auction completes
			const result = auction.processPass(players[4]);
			expect(result).toBe(AuctionResult.COMPLETE);
			expect(auction.getWinner()?.id).toBe(players[0].id);
		});
	});
});
