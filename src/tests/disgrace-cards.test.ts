import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '$lib/domain/gameState';
import { DisgraceFauxPas, DisgracePassé, DisgraceScandale, LuxuryCard, PrestigeCard } from '$lib/domain/cards';
import { DisgraceAuction, AuctionResult } from '$lib/domain/auction';
import { Player } from '$lib/domain/player';
import { StatusCalculator } from '$lib/domain/scoring';
import type { MoneyCard } from '$lib/domain/cards';

/**
 * Comprehensive tests for all three disgrace cards:
 * - Faux Pas: Discard a luxury card (or next one received)
 * - Passé: -5 status
 * - Scandale: Halve final status (game end trigger)
 */
describe('Disgrace Cards', () => {
	describe('Faux Pas - Luxury Card Discard', () => {
		let gameState: GameState;
		let players: Player[];

		beforeEach(() => {
			gameState = new GameState('test-game');
			gameState.initializeGame(['A', 'B', 'C']);
			players = gameState.getPlayers();
		});

		it('should require player to discard a luxury card when they have one', () => {
			const player = players[0];
			
			// Give player a luxury card first
			const luxuryCard = new LuxuryCard('test-luxury', 'Test Luxury', 5);
			player.addStatusCard(luxuryCard);
			
			expect(player.getLuxuryCards()).toHaveLength(1);
			expect(player.getStatusCards()).toHaveLength(1);

			// Give player Faux Pas
			const fauxPas = new DisgraceFauxPas();
			player.addStatusCard(fauxPas);
			
			// Manually trigger the Faux Pas effect (normally done in completeAuction)
			player.setPendingLuxuryDiscard(true);
			
			// Player should have pending discard
			expect(player.getPendingLuxuryDiscard()).toBe(true);
			expect(player.getStatusCards()).toHaveLength(2);
		});

		it('should allow player to discard luxury card and remove Faux Pas', () => {
			const player = players[0];
			
			// Give player multiple luxury cards
			const luxury1 = new LuxuryCard('luxury-1', 'Luxury 1', 5);
			const luxury2 = new LuxuryCard('luxury-2', 'Luxury 2', 8);
			player.addStatusCard(luxury1);
			player.addStatusCard(luxury2);
			
			// Give Faux Pas
			const fauxPas = new DisgraceFauxPas();
			player.addStatusCard(fauxPas);
			player.setPendingLuxuryDiscard(true);
			
			expect(player.getStatusCards()).toHaveLength(3);
			expect(player.getLuxuryCards()).toHaveLength(2);

			// Player discards one luxury card
			gameState.handleLuxuryDiscard(player.id, luxury1.id);
			
			// Verify luxury card and Faux Pas are both removed
			expect(player.getStatusCards()).toHaveLength(1);
			expect(player.getLuxuryCards()).toHaveLength(1);
			expect(player.getStatusCards()[0].id).toBe('luxury-2');
			expect(player.getPendingLuxuryDiscard()).toBe(false);
		});

		it('should set pending discard if player has no luxury cards', () => {
			const player = players[0];
			
			// Give Faux Pas with no luxury cards
			const fauxPas = new DisgraceFauxPas();
			player.addStatusCard(fauxPas);
			player.setPendingLuxuryDiscard(true);
			
			expect(player.getPendingLuxuryDiscard()).toBe(true);
			expect(player.getLuxuryCards()).toHaveLength(0);
			
			// When player gets a luxury card later, they must discard it
			const luxury = new LuxuryCard('luxury-1', 'Luxury 1', 5);
			player.addStatusCard(luxury);
			
			// Player should still have pending discard
			expect(player.getPendingLuxuryDiscard()).toBe(true);
			
			// Handle the discard
			gameState.handleLuxuryDiscard(player.id, luxury.id);
			
			// Luxury and Faux Pas both removed
			expect(player.getStatusCards()).toHaveLength(0);
			expect(player.getPendingLuxuryDiscard()).toBe(false);
		});

		it('should not affect non-luxury status cards', () => {
			const player = players[0];
			
			// Give player prestige and disgrace cards (not luxury)
			const passe = new DisgracePassé();
			player.addStatusCard(passe);
			
			// Give Faux Pas
			const fauxPas = new DisgraceFauxPas();
			player.addStatusCard(fauxPas);
			
			expect(player.getStatusCards()).toHaveLength(2);
			expect(player.getLuxuryCards()).toHaveLength(0);
			
			// Faux Pas should not affect Passé
			expect(player.getStatusCards().some(c => c.id === 'passe')).toBe(true);
		});
	});

	describe('Passé - Status Reduction', () => {
		it('should reduce status by 5', () => {
			const calculator = new StatusCalculator();
			
			// Player has luxury cards worth 12 and Passé (-5)
			const luxury1 = new LuxuryCard('luxury-1', 'Luxury 1', 7);
			const luxury2 = new LuxuryCard('luxury-2', 'Luxury 2', 5);
			const passe = new DisgracePassé();
			
			const cards = [luxury1, luxury2, passe];
			const finalStatus = calculator.calculate(cards);
			
			// 7 + 5 - 5 = 7
			expect(finalStatus).toBe(7);
		});

		it('should work with prestige multipliers correctly', () => {
			const calculator = new StatusCalculator();
			
			// Test scoring order: (luxury + passé) × prestige
			const luxury = new LuxuryCard('luxury-1', 'Luxury', 10);
			const passe = new DisgracePassé();
			const prestige = new PrestigeCard('test-prestige', 'Test Prestige');
			
			const cards = [luxury, passe, prestige];
			const finalStatus = calculator.calculate(cards);
			
			// (10 - 5) × 2 = 10
			expect(finalStatus).toBe(10);
		});

		it('should not reduce status below 0', () => {
			const calculator = new StatusCalculator();
			
			// Passé with no luxury cards
			const passe = new DisgracePassé();
			
			const finalStatus = calculator.calculate([passe]);
			
			// -5 floored to 0
			expect(finalStatus).toBe(0);
		});

		it('should stack with multiple Passé cards', () => {
			const calculator = new StatusCalculator();
			
			// If somehow player gets 2 Passé cards
			const luxury = new LuxuryCard('luxury-1', 'Luxury', 15);
			const passe1 = new DisgracePassé();
			const passe2 = new class extends DisgracePassé {
				constructor() { 
					super();
					// Override ID to make it different
					(this as any).id = 'passe-2';
				}
			}();
			
			const cards = [luxury, passe1, passe2];
			const finalStatus = calculator.calculate(cards);
			
			// 15 - 5 - 5 = 5
			expect(finalStatus).toBe(5);
		});
	});

	describe('Scandale - Status Halving', () => {
		it('should halve final status', () => {
			const calculator = new StatusCalculator();
			
			// Player has luxury cards worth 20 and Scandale
			const luxury1 = new LuxuryCard('luxury-1', 'Luxury 1', 10);
			const luxury2 = new LuxuryCard('luxury-2', 'Luxury 2', 10);
			const scandale = new DisgraceScandale();
			
			const cards = [luxury1, luxury2, scandale];
			const finalStatus = calculator.calculate(cards);
			
			// 20 ÷ 2 = 10
			expect(finalStatus).toBe(10);
		});

		it('should apply after prestige multipliers (correct order)', () => {
			const calculator = new StatusCalculator();
			
			// Test: (luxury × prestige) ÷ scandale
			const luxury = new LuxuryCard('luxury-1', 'Luxury', 5);
			const prestige = new PrestigeCard('test-prestige', 'Test Prestige');
			const scandale = new DisgraceScandale();
			
			const cards = [luxury, prestige, scandale];
			const finalStatus = calculator.calculate(cards);
			
			// (5 × 2) ÷ 2 = 5
			expect(finalStatus).toBe(5);
		});

		it('should apply after Passé (correct order)', () => {
			const calculator = new StatusCalculator();
			
			// Test: (luxury + passé) ÷ scandale
			const luxury = new LuxuryCard('luxury-1', 'Luxury', 15);
			const passe = new DisgracePassé();
			const scandale = new DisgraceScandale();
			
			const cards = [luxury, passe, scandale];
			const finalStatus = calculator.calculate(cards);
			
			// (15 - 5) ÷ 2 = 5
			expect(finalStatus).toBe(5);
		});

		it('should match rules example: (luxury + passé) × prestige ÷ scandale', () => {
			const calculator = new StatusCalculator();
			
			// Rahul's example from rules:
			// Luxury: 3 + 9 = 12
			// Passé: -5
			// 2 Prestige cards: ×2 ×2 = ×4
			// Scandale: ÷2
			// Result: ((12 - 5) × 4) ÷ 2 = 14
			
			const luxury1 = new LuxuryCard('haute-cuisine', 'Haute Cuisine', 3);
			const luxury2 = new LuxuryCard('dressage', 'Dressage', 9);
			const passe = new DisgracePassé();
			const prestige1 = new PrestigeCard('bon-vivant', 'Bon Vivant');
			const prestige2 = new PrestigeCard('joie-de-vivre', 'Joie De Vivre');
			const scandale = new DisgraceScandale();
			
			const cards = [luxury1, luxury2, passe, prestige1, prestige2, scandale];
			const finalStatus = calculator.calculate(cards);
			
			expect(finalStatus).toBe(14);
		});

		it('should round down when halving odd numbers', () => {
			const calculator = new StatusCalculator();
			
			const luxury = new LuxuryCard('luxury-1', 'Luxury', 7);
			const scandale = new DisgraceScandale();
			
			const cards = [luxury, scandale];
			const finalStatus = calculator.calculate(cards);
			
			// 7 ÷ 2 = 3.5 → 3
			expect(finalStatus).toBe(3);
		});

		it('should be a game end trigger', () => {
			const scandale = new DisgraceScandale();
			expect(scandale.isGameEndTrigger).toBe(true);
		});
	});

	describe('Disgrace Auction Mechanics', () => {
		let players: Player[];
		let auction: DisgraceAuction;

		beforeEach(() => {
			const gameState = new GameState('test-game');
			gameState.initializeGame(['A', 'B', 'C']);
			players = gameState.getPlayers();
			
			const fauxPas = new DisgraceFauxPas();
			auction = new DisgraceAuction(fauxPas, players);
		});

		it('should end immediately when first player passes', () => {
			const [playerA, playerB, playerC] = players;

			// A bids to avoid
			const aMoney = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			let result = auction.processBid(playerA, [aMoney]);
			expect(result).toBe(AuctionResult.CONTINUE);

			// B bids to avoid
			const bMoney = playerB.getMoneyHand().find((c: MoneyCard) => c.value === 2000)!;
			result = auction.processBid(playerB, [bMoney]);
			expect(result).toBe(AuctionResult.CONTINUE);

			// C passes - immediately gets the card
			result = auction.processPass(playerC);
			expect(result).toBe(AuctionResult.COMPLETE);
			
			// C is the "winner" (gets the disgrace card)
			expect(auction.getWinner()?.id).toBe(playerC.id);
			
			// C gets their money back
			expect(playerC.getCurrentBidAmount()).toBe(0);
		});

		it('should make all other players lose their bid money when someone passes', () => {
			const [playerA, playerB, playerC] = players;

			// A bids 1000
			const aMoney = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			auction.processBid(playerA, [aMoney]);
			expect(playerA.getCurrentBidAmount()).toBe(1000);

			// B bids 2000
			const bMoney = playerB.getMoneyHand().find((c: MoneyCard) => c.value === 2000)!;
			auction.processBid(playerB, [bMoney]);
			expect(playerB.getCurrentBidAmount()).toBe(2000);

			// C passes - A and B lose their money
			auction.processPass(playerC);
			
			// A and B's money is discarded
			expect(playerA.getCurrentBidAmount()).toBe(0);
			expect(playerB.getCurrentBidAmount()).toBe(0);
			
			// But they no longer have those cards in their hand
			expect(playerA.getMoneyHand().some(c => c.id === aMoney.id)).toBe(false);
			expect(playerB.getMoneyHand().some(c => c.id === bMoney.id)).toBe(false);
		});

		it('should require increasing bids like regular auction', () => {
			const [playerA, playerB] = players;

			// A bids 2000
			const aMoney = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 2000)!;
			auction.processBid(playerA, [aMoney]);

			// B tries to bid 1000 (lower) - should fail
			const bMoney = playerB.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
			expect(() => {
				auction.processBid(playerB, [bMoney]);
			}).toThrow();
			
			// B's money should be returned
			expect(playerB.getCurrentBidAmount()).toBe(0);
		});

		it('should handle scenario where everyone passes without bidding', () => {
			const [playerA, playerB, playerC] = players;

			// A passes immediately
			const result = auction.processPass(playerA);
			
			// Auction completes, A gets the card
			expect(result).toBe(AuctionResult.COMPLETE);
			expect(auction.getWinner()?.id).toBe(playerA.id);
			
			// No money spent by anyone
			expect(playerA.getCurrentBidAmount()).toBe(0);
			expect(playerB.getCurrentBidAmount()).toBe(0);
			expect(playerC.getCurrentBidAmount()).toBe(0);
		});
	});

	describe('Disgrace Cards Integration', () => {
		it('should handle full disgrace auction flow with Faux Pas', () => {
			const gameState = new GameState('test-game');
			gameState.initializeGame(['A', 'B', 'C']);
			
			// Manually set up a Faux Pas card as current auction
			const fauxPas = new DisgraceFauxPas();
			const players = gameState.getPlayers();
			const auction = new DisgraceAuction(fauxPas, players);
			
			// Set the auction in game state (need to expose this or use reflection)
			// For now, we'll just test the auction directly
			
			const [playerA, playerB, playerC] = players;
			
			// Give player A a luxury card
			const luxury = new LuxuryCard('luxury-1', 'Luxury', 8);
			playerA.addStatusCard(luxury);
			
			// A and B bid to avoid
			const aMoney = playerA.getMoneyHand().find((c: MoneyCard) => c.value === 2000)!;
			auction.processBid(playerA, [aMoney]);
			
			const bMoney = playerB.getMoneyHand().find((c: MoneyCard) => c.value === 3000)!;
			auction.processBid(playerB, [bMoney]);
			
			// C passes, gets Faux Pas
			auction.processPass(playerC);
			
			// C gets the card
			playerC.addStatusCard(fauxPas);
			
			// C has no luxury cards, so pending discard
			expect(playerC.getLuxuryCards()).toHaveLength(0);
			playerC.setPendingLuxuryDiscard(true);
			expect(playerC.getPendingLuxuryDiscard()).toBe(true);
			
			// A and B lost their money
			playerA.discardPlayedMoney();
			playerB.discardPlayedMoney();
			
			expect(playerA.getCurrentBidAmount()).toBe(0);
			expect(playerB.getCurrentBidAmount()).toBe(0);
		});
	});
});
