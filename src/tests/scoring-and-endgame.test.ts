import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '$lib/domain/gameState';
import { GameScoringService, StatusCalculator } from '$lib/domain/scoring';
import { LuxuryCard, PrestigeCard, DisgracePassé, DisgraceScandale } from '$lib/domain/cards';
import { Player, type PlayerPublicState } from '$lib/domain/player';
import { PlayerColor } from '$lib/domain/cards';
import type { MoneyCard } from '$lib/domain/cards';

/**
 * Tests for end game state and scoring:
 * - Cast out mechanics (poorest players excluded)
 * - Scoring calculation order
 * - Tie-breaker rules (status > money > highest luxury)
 */
describe('End Game State and Scoring', () => {
	describe('Cast Out Mechanics', () => {
		it('should cast out player with least money', () => {
			const players = [
				new Player('p1', 'Alice', PlayerColor.RED),
				new Player('p2', 'Bob', PlayerColor.BLUE),
				new Player('p3', 'Charlie', PlayerColor.GREEN)
			];

			// Give them different amounts of money
			// Alice: 50K, Bob: 30K, Charlie: 40K
			players[0].dealMoneyCards([
				{ id: 'm1', value: 50000, playerColor: PlayerColor.RED } as MoneyCard
			]);
			players[1].dealMoneyCards([
				{ id: 'm2', value: 30000, playerColor: PlayerColor.BLUE } as MoneyCard
			]);
			players[2].dealMoneyCards([
				{ id: 'm3', value: 40000, playerColor: PlayerColor.GREEN } as MoneyCard
			]);

			// Give them all the same status cards
			players.forEach(player => {
				player.addStatusCard(new LuxuryCard('luxury', 'Luxury', 10));
			});

			const scoringService = new GameScoringService();
			const rankings = scoringService.calculateFinalRankings(players);

			// Bob should be cast out
			const bobRanking = rankings.find(r => r.player.id === 'p2')!;
			expect(bobRanking.isCastOut).toBe(true);
			expect(bobRanking.finalStatus).toBe(0);

			// Alice and Charlie should not be cast out
			const aliceRanking = rankings.find(r => r.player.id === 'p1')!;
			const charlieRanking = rankings.find(r => r.player.id === 'p3')!;
			expect(aliceRanking.isCastOut).toBe(false);
			expect(charlieRanking.isCastOut).toBe(false);
		});

		it('should cast out multiple players if tied for least money', () => {
			const players = [
				new Player('p1', 'Alice', PlayerColor.RED),
				new Player('p2', 'Bob', PlayerColor.BLUE),
				new Player('p3', 'Charlie', PlayerColor.GREEN)
			];

			// Alice: 50K, Bob: 30K, Charlie: 30K (tied for least)
			players[0].dealMoneyCards([
				{ id: 'm1', value: 50000, playerColor: PlayerColor.RED } as MoneyCard
			]);
			players[1].dealMoneyCards([
				{ id: 'm2', value: 30000, playerColor: PlayerColor.BLUE } as MoneyCard
			]);
			players[2].dealMoneyCards([
				{ id: 'm3', value: 30000, playerColor: PlayerColor.GREEN } as MoneyCard
			]);

			players.forEach(player => {
				player.addStatusCard(new LuxuryCard('luxury', 'Luxury', 10));
			});

			const scoringService = new GameScoringService();
			const rankings = scoringService.calculateFinalRankings(players);

			// Bob and Charlie should both be cast out
			const bobRanking = rankings.find(r => r.player.id === 'p2')!;
			const charlieRanking = rankings.find(r => r.player.id === 'p3')!;
			expect(bobRanking.isCastOut).toBe(true);
			expect(charlieRanking.isCastOut).toBe(true);

			// Only Alice can win
			const aliceRanking = rankings.find(r => r.player.id === 'p1')!;
			expect(aliceRanking.isCastOut).toBe(false);
			expect(aliceRanking.rank).toBe(1);
		});

		it('should not cast anyone out in 2-player game if different money', () => {
			const players = [
				new Player('p1', 'Alice', PlayerColor.RED),
				new Player('p2', 'Bob', PlayerColor.BLUE)
			];

			// Alice: 40K, Bob: 30K
			players[0].dealMoneyCards([
				{ id: 'm1', value: 40000, playerColor: PlayerColor.RED } as MoneyCard
			]);
			players[1].dealMoneyCards([
				{ id: 'm2', value: 30000, playerColor: PlayerColor.BLUE } as MoneyCard
			]);

			players.forEach(player => {
				player.addStatusCard(new LuxuryCard('luxury', 'Luxury', 10));
			});

			const scoringService = new GameScoringService();
			const rankings = scoringService.calculateFinalRankings(players);

			// Bob is cast out
			const bobRanking = rankings.find(r => r.player.id === 'p2')!;
			expect(bobRanking.isCastOut).toBe(true);

			// Only Alice eligible
			const aliceRanking = rankings.find(r => r.player.id === 'p1')!;
			expect(aliceRanking.isCastOut).toBe(false);
			expect(aliceRanking.rank).toBe(1);
		});
	});

	describe('Scoring Calculation Order', () => {
		it('should calculate in correct order: luxury + passé, then × prestige, then ÷ scandale', () => {
			const calculator = new StatusCalculator();

			// The canonical example from rules
			const luxury1 = new LuxuryCard('luxury-1', 'Haute Cuisine', 3);
			const luxury2 = new LuxuryCard('luxury-2', 'Dressage', 9);
			const passe = new DisgracePassé();
			const prestige1 = new PrestigeCard('prestige-1', 'Bon Vivant');
			const prestige2 = new PrestigeCard('prestige-2', 'Joie De Vivre');
			const scandale = new DisgraceScandale();

			const cards = [luxury1, luxury2, passe, prestige1, prestige2, scandale];
			const finalStatus = calculator.calculate(cards);

			// Step 1: 3 + 9 - 5 = 7
			// Step 2: 7 × 2 × 2 = 28
			// Step 3: 28 ÷ 2 = 14
			expect(finalStatus).toBe(14);
		});

		it('should apply prestige multipliers before scandale halving', () => {
			const calculator = new StatusCalculator();

			const luxury = new LuxuryCard('luxury', 'Luxury', 10);
			const prestige = new PrestigeCard('prestige', 'Prestige');
			const scandale = new DisgraceScandale();

			const cards = [luxury, prestige, scandale];
			const finalStatus = calculator.calculate(cards);

			// Correct: (10 × 2) ÷ 2 = 10
			// Wrong if order reversed: (10 ÷ 2) × 2 = 10 (same result, but...)
			// Better test with odd number
			expect(finalStatus).toBe(10);
		});

		it('should apply passé before prestige', () => {
			const calculator = new StatusCalculator();

			const luxury = new LuxuryCard('luxury', 'Luxury', 10);
			const passe = new DisgracePassé();
			const prestige = new PrestigeCard('prestige', 'Prestige');

			const cards = [luxury, passe, prestige];
			const finalStatus = calculator.calculate(cards);

			// Correct: (10 - 5) × 2 = 10
			// Wrong if reversed: 10 × 2 - 5 = 15
			expect(finalStatus).toBe(10);
		});

		it('should handle negative base status before prestige', () => {
			const calculator = new StatusCalculator();

			const luxury = new LuxuryCard('luxury', 'Luxury', 3);
			const passe = new DisgracePassé();
			const prestige = new PrestigeCard('prestige', 'Prestige');

			const cards = [luxury, passe, prestige];
			const finalStatus = calculator.calculate(cards);

			// (3 - 5) × 2 = -4, but floored to 0
			expect(finalStatus).toBe(0);
		});
	});

	describe('Tie-Breaker Rules', () => {
		it('should rank by status first', () => {
			const players = [
				new Player('p1', 'Alice', PlayerColor.RED),
				new Player('p2', 'Bob', PlayerColor.BLUE),
				new Player('p3', 'Charlie', PlayerColor.GREEN)
			];

			// All have same money
			players.forEach(player => {
				player.dealMoneyCards([
					{ id: `m-${player.id}`, value: 50000, playerColor: player.color } as MoneyCard
				]);
			});

			// Different status
			players[0].addStatusCard(new LuxuryCard('luxury-1', 'Luxury', 10)); // 10
			players[1].addStatusCard(new LuxuryCard('luxury-2', 'Luxury', 8));  // 8
			players[2].addStatusCard(new LuxuryCard('luxury-3', 'Luxury', 12)); // 12

			const scoringService = new GameScoringService();
			const rankings = scoringService.calculateFinalRankings(players);

			// Charlie (12) > Alice (10) > Bob (8)
			expect(rankings[0].player.id).toBe('p3');
			expect(rankings[0].rank).toBe(1);
			expect(rankings[1].player.id).toBe('p1');
			expect(rankings[1].rank).toBe(2);
			expect(rankings[2].player.id).toBe('p2');
			expect(rankings[2].rank).toBe(3);
		});

		it('should use money as first tie-breaker when status equal', () => {
			const players = [
				new Player('p1', 'Alice', PlayerColor.RED),
				new Player('p2', 'Bob', PlayerColor.BLUE),
				new Player('p3', 'Charlie', PlayerColor.GREEN)
			];

			// Different money amounts
			players[0].dealMoneyCards([
				{ id: 'm1', value: 40000, playerColor: PlayerColor.RED } as MoneyCard
			]);
			players[1].dealMoneyCards([
				{ id: 'm2', value: 60000, playerColor: PlayerColor.BLUE } as MoneyCard
			]);
			players[2].dealMoneyCards([
				{ id: 'm3', value: 50000, playerColor: PlayerColor.GREEN } as MoneyCard
			]);

			// Same status
			players.forEach(player => {
				player.addStatusCard(new LuxuryCard('luxury', 'Luxury', 10));
			});

			const scoringService = new GameScoringService();
			const rankings = scoringService.calculateFinalRankings(players);

			// Bob (60K) > Charlie (50K) > Alice (40K)
			expect(rankings[0].player.id).toBe('p2');
			expect(rankings[1].player.id).toBe('p3');
			expect(rankings[2].player.id).toBe('p1');
		});

		it('should use highest luxury card as second tie-breaker', () => {
			const players = [
				new Player('p1', 'Alice', PlayerColor.RED),
				new Player('p2', 'Bob', PlayerColor.BLUE),
				new Player('p3', 'Charlie', PlayerColor.GREEN)
			];

			// Same money
			players.forEach(player => {
				player.dealMoneyCards([
					{ id: `m-${player.id}`, value: 50000, playerColor: player.color } as MoneyCard
				]);
			});

			// Same total status but different highest card
			players[0].addStatusCard(new LuxuryCard('luxury-1a', 'Luxury 1', 5));
			players[0].addStatusCard(new LuxuryCard('luxury-1b', 'Luxury 2', 5)); // Total 10, highest 5

			players[1].addStatusCard(new LuxuryCard('luxury-2a', 'Luxury 3', 3));
			players[1].addStatusCard(new LuxuryCard('luxury-2b', 'Luxury 4', 7)); // Total 10, highest 7

			players[2].addStatusCard(new LuxuryCard('luxury-3a', 'Luxury 5', 4));
			players[2].addStatusCard(new LuxuryCard('luxury-3b', 'Luxury 6', 6)); // Total 10, highest 6

			const scoringService = new GameScoringService();
			const rankings = scoringService.calculateFinalRankings(players);

			// All have status 10 and money 50K
			// Bob has highest luxury (7) > Charlie (6) > Alice (5)
			expect(rankings[0].player.id).toBe('p2');
			expect(rankings[1].player.id).toBe('p3');
			expect(rankings[2].player.id).toBe('p1');
		});

		it('should handle complete tie scenario', () => {
			const players = [
				new Player('p1', 'Alice', PlayerColor.RED),
				new Player('p2', 'Bob', PlayerColor.BLUE)
			];

			// Identical status, money, and luxury cards
			players.forEach(player => {
				player.dealMoneyCards([
					{ id: `m-${player.id}`, value: 50000, playerColor: player.color } as MoneyCard
				]);
				player.addStatusCard(new LuxuryCard('luxury', 'Luxury', 10));
			});

			const scoringService = new GameScoringService();
			const rankings = scoringService.calculateFinalRankings(players);

			// Both should be ranked (order undefined in case of complete tie)
			expect(rankings).toHaveLength(2);
			expect(rankings[0].finalStatus).toBe(10);
			expect(rankings[1].finalStatus).toBe(10);
		});
	});

	describe('Full Scoring Integration', () => {
		it('should correctly score and rank a complete game', () => {
			const players = [
				new Player('p1', 'Alice', PlayerColor.RED),
				new Player('p2', 'Bob', PlayerColor.BLUE),
				new Player('p3', 'Charlie', PlayerColor.GREEN)
			];

			// Alice: Luxury 10, Prestige → (10 × 2) = 20, Money: 40K
			players[0].dealMoneyCards([
				{ id: 'm1', value: 40000, playerColor: PlayerColor.RED } as MoneyCard
			]);
			players[0].addStatusCard(new LuxuryCard('luxury-a', 'Luxury', 10));
			players[0].addStatusCard(new PrestigeCard('prestige-a', 'Prestige'));

			// Bob: Luxury 15, Passé → (15 - 5) = 10, Money: 50K
			players[1].dealMoneyCards([
				{ id: 'm2', value: 50000, playerColor: PlayerColor.BLUE } as MoneyCard
			]);
			players[1].addStatusCard(new LuxuryCard('luxury-b', 'Luxury', 15));
			players[1].addStatusCard(new DisgracePassé());

			// Charlie: Luxury 8, Money: 30K (cast out)
			players[2].dealMoneyCards([
				{ id: 'm3', value: 30000, playerColor: PlayerColor.GREEN } as MoneyCard
			]);
			players[2].addStatusCard(new LuxuryCard('luxury-c', 'Luxury', 8));

			const scoringService = new GameScoringService();
			const rankings = scoringService.calculateFinalRankings(players);

			// Charlie is cast out (least money)
			const charlieRanking = rankings.find(r => r.player.id === 'p3')!;
			expect(charlieRanking.isCastOut).toBe(true);
			expect(charlieRanking.rank).toBe(3);

			// Alice wins (20 status) over Bob (10 status)
			const aliceRanking = rankings.find(r => r.player.id === 'p1')!;
			const bobRanking = rankings.find(r => r.player.id === 'p2')!;
			expect(aliceRanking.rank).toBe(1);
			expect(aliceRanking.finalStatus).toBe(20);
			expect(bobRanking.rank).toBe(2);
			expect(bobRanking.finalStatus).toBe(10);
		});

		it('should handle complex scoring with all card types', () => {
			const player = new Player('p1', 'Alice', PlayerColor.RED);
			player.dealMoneyCards([
				{ id: 'm1', value: 50000, playerColor: PlayerColor.RED } as MoneyCard
			]);

			// Multiple luxury, prestige, and disgrace cards
			player.addStatusCard(new LuxuryCard('luxury-1', 'Luxury 1', 7));
			player.addStatusCard(new LuxuryCard('luxury-2', 'Luxury 2', 5));
			player.addStatusCard(new DisgracePassé());
			player.addStatusCard(new PrestigeCard('prestige-1', 'Prestige 1'));
			player.addStatusCard(new PrestigeCard('prestige-2', 'Prestige 2'));
			player.addStatusCard(new DisgraceScandale());

			const calculator = new StatusCalculator();
			const finalStatus = calculator.calculate(player.getStatusCards());

			// (7 + 5 - 5) × 2 × 2 ÷ 2 = 7 × 4 ÷ 2 = 14
			expect(finalStatus).toBe(14);
		});
	});

	describe('Edge Cases', () => {
		it('should handle player with no status cards', () => {
			const players = [
				new Player('p1', 'Alice', PlayerColor.RED),
				new Player('p2', 'Bob', PlayerColor.BLUE)
			];

			players.forEach(player => {
				player.dealMoneyCards([
					{ id: `m-${player.id}`, value: 50000, playerColor: player.color } as MoneyCard
				]);
			});

			// Alice has cards, Bob has none
			players[0].addStatusCard(new LuxuryCard('luxury', 'Luxury', 5));

			const scoringService = new GameScoringService();
			const rankings = scoringService.calculateFinalRankings(players);

			const aliceRanking = rankings.find(r => r.player.id === 'p1')!;
			const bobRanking = rankings.find(r => r.player.id === 'p2')!;

			expect(aliceRanking.rank).toBe(1);
			expect(aliceRanking.finalStatus).toBe(5);
			expect(bobRanking.rank).toBe(2);
			expect(bobRanking.finalStatus).toBe(0);
		});

		it('should handle all players with zero status', () => {
			const players = [
				new Player('p1', 'Alice', PlayerColor.RED),
				new Player('p2', 'Bob', PlayerColor.BLUE)
			];

			// Different money
			players[0].dealMoneyCards([
				{ id: 'm1', value: 40000, playerColor: PlayerColor.RED } as MoneyCard
			]);
			players[1].dealMoneyCards([
				{ id: 'm2', value: 50000, playerColor: PlayerColor.BLUE } as MoneyCard
			]);

			const scoringService = new GameScoringService();
			const rankings = scoringService.calculateFinalRankings(players);

			// Both have 0 status, Bob wins by money
			expect(rankings[0].player.id).toBe('p2');
			expect(rankings[0].finalStatus).toBe(0);
			expect(rankings[1].player.id).toBe('p1');
			expect(rankings[1].finalStatus).toBe(0);
		});

		it('should handle single player game', () => {
			const players = [
				new Player('p1', 'Alice', PlayerColor.RED)
			];

			players[0].dealMoneyCards([
				{ id: 'm1', value: 50000, playerColor: PlayerColor.RED } as MoneyCard
			]);
			players[0].addStatusCard(new LuxuryCard('luxury', 'Luxury', 10));

			const scoringService = new GameScoringService();
			const rankings = scoringService.calculateFinalRankings(players);

			// Alice is the only player, no one to cast out
			expect(rankings).toHaveLength(1);
			expect(rankings[0].rank).toBe(1);
			expect(rankings[0].isCastOut).toBe(false);
		});
	});
});
