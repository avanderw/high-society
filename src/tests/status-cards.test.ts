import { describe, it, expect } from 'vitest';
import { LuxuryCard, PrestigeCard, LUXURY_CARDS, PRESTIGE_CARDS } from '$lib/domain/cards';
import { StatusCalculator } from '$lib/domain/scoring';

/**
 * Tests for normal status cards:
 * - Luxury cards (value 1-10)
 * - Prestige cards (×2 multiplier, game end trigger)
 */
describe('Status Cards - Luxury and Prestige', () => {
	describe('Luxury Cards', () => {
		it('should have values from 1 to 10', () => {
			expect(LUXURY_CARDS).toHaveLength(10);
			
			const values = LUXURY_CARDS.map(card => card.value).sort((a, b) => a - b);
			expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		});

		it('should contribute their value to status', () => {
			const calculator = new StatusCalculator();
			
			const luxury5 = new LuxuryCard('test-luxury', 'Test', 5);
			const status = calculator.calculate([luxury5]);
			
			expect(status).toBe(5);
		});

		it('should sum multiple luxury cards', () => {
			const calculator = new StatusCalculator();
			
			const luxury3 = new LuxuryCard('luxury-1', 'Luxury 1', 3);
			const luxury7 = new LuxuryCard('luxury-2', 'Luxury 2', 7);
			const luxury10 = new LuxuryCard('luxury-3', 'Luxury 3', 10);
			
			const status = calculator.calculate([luxury3, luxury7, luxury10]);
			
			// 3 + 7 + 10 = 20
			expect(status).toBe(20);
		});

		it('should not be game end triggers', () => {
			LUXURY_CARDS.forEach(card => {
				expect(card.isGameEndTrigger).toBe(false);
			});
		});

		it('should have unique IDs', () => {
			const ids = LUXURY_CARDS.map(card => card.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(LUXURY_CARDS.length);
		});

		it('should have display values', () => {
			LUXURY_CARDS.forEach(card => {
				const displayValue = card.getDisplayValue();
				expect(displayValue).toBe(card.value.toString());
			});
		});
	});

	describe('Prestige Cards', () => {
		it('should have exactly 3 prestige cards', () => {
			expect(PRESTIGE_CARDS).toHaveLength(3);
		});

		it('should all be game end triggers', () => {
			PRESTIGE_CARDS.forEach(card => {
				expect(card.isGameEndTrigger).toBe(true);
			});
		});

		it('should double status (one prestige card)', () => {
			const calculator = new StatusCalculator();
			
			const luxury = new LuxuryCard('luxury', 'Luxury', 10);
			const prestige = new PrestigeCard('prestige', 'Prestige');
			
			const status = calculator.calculate([luxury, prestige]);
			
			// 10 × 2 = 20
			expect(status).toBe(20);
		});

		it('should quadruple status (two prestige cards)', () => {
			const calculator = new StatusCalculator();
			
			const luxury = new LuxuryCard('luxury', 'Luxury', 10);
			const prestige1 = new PrestigeCard('prestige-1', 'Prestige 1');
			const prestige2 = new PrestigeCard('prestige-2', 'Prestige 2');
			
			const status = calculator.calculate([luxury, prestige1, prestige2]);
			
			// 10 × 2 × 2 = 40
			expect(status).toBe(40);
		});

		it('should multiply by 8 (three prestige cards)', () => {
			const calculator = new StatusCalculator();
			
			const luxury = new LuxuryCard('luxury', 'Luxury', 5);
			const prestige1 = new PrestigeCard('prestige-1', 'Prestige 1');
			const prestige2 = new PrestigeCard('prestige-2', 'Prestige 2');
			const prestige3 = new PrestigeCard('prestige-3', 'Prestige 3');
			
			const status = calculator.calculate([luxury, prestige1, prestige2, prestige3]);
			
			// 5 × 2 × 2 × 2 = 40
			expect(status).toBe(40);
		});

		it('should have no effect with zero base status', () => {
			const calculator = new StatusCalculator();
			
			// Only prestige cards, no luxury
			const prestige1 = new PrestigeCard('prestige-1', 'Prestige 1');
			const prestige2 = new PrestigeCard('prestige-2', 'Prestige 2');
			
			const status = calculator.calculate([prestige1, prestige2]);
			
			// 0 × 2 × 2 = 0
			expect(status).toBe(0);
		});

		it('should have unique IDs', () => {
			const ids = PRESTIGE_CARDS.map(card => card.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(PRESTIGE_CARDS.length);
		});

		it('should have display value of ×2', () => {
			PRESTIGE_CARDS.forEach(card => {
				expect(card.getDisplayValue()).toBe('×2');
			});
		});
	});

	describe('Combined Luxury and Prestige Scenarios', () => {
		it('should handle complex combinations', () => {
			const calculator = new StatusCalculator();
			
			// 3 luxury cards + 2 prestige cards
			const luxury1 = new LuxuryCard('luxury-1', 'Luxury 1', 4);
			const luxury2 = new LuxuryCard('luxury-2', 'Luxury 2', 6);
			const luxury3 = new LuxuryCard('luxury-3', 'Luxury 3', 5);
			const prestige1 = new PrestigeCard('prestige-1', 'Prestige 1');
			const prestige2 = new PrestigeCard('prestige-2', 'Prestige 2');
			
			const status = calculator.calculate([luxury1, luxury2, luxury3, prestige1, prestige2]);
			
			// (4 + 6 + 5) × 2 × 2 = 15 × 4 = 60
			expect(status).toBe(60);
		});

		it('should handle maximum possible luxury + prestige', () => {
			const calculator = new StatusCalculator();
			
			// All 10 luxury cards (total 55) + 3 prestige cards (×8)
			const allLuxury = LUXURY_CARDS;
			const allPrestige = PRESTIGE_CARDS;
			
			const status = calculator.calculate([...allLuxury, ...allPrestige]);
			
			// (1+2+3+4+5+6+7+8+9+10) × 8 = 55 × 8 = 440
			expect(status).toBe(440);
		});

		it('should handle single luxury with prestige', () => {
			const calculator = new StatusCalculator();
			
			const luxury1 = new LuxuryCard('luxury-1', 'Fashion', 1);
			const prestige = new PrestigeCard('prestige', 'Prestige');
			
			const status = calculator.calculate([luxury1, prestige]);
			
			// 1 × 2 = 2
			expect(status).toBe(2);
		});

		it('should calculate in correct order: sum luxury, then multiply prestige', () => {
			const calculator = new StatusCalculator();
			
			// Verify order matters: (a + b) × c, not a + (b × c)
			const luxury1 = new LuxuryCard('luxury-1', 'Luxury 1', 3);
			const luxury2 = new LuxuryCard('luxury-2', 'Luxury 2', 7);
			const prestige = new PrestigeCard('prestige', 'Prestige');
			
			const status = calculator.calculate([luxury1, luxury2, prestige]);
			
			// Correct: (3 + 7) × 2 = 20
			// Wrong if order incorrect: 3 + (7 × 2) = 17
			expect(status).toBe(20);
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty card list', () => {
			const calculator = new StatusCalculator();
			const status = calculator.calculate([]);
			expect(status).toBe(0);
		});

		it('should handle only luxury cards (no prestige)', () => {
			const calculator = new StatusCalculator();
			
			const luxury1 = new LuxuryCard('luxury-1', 'Luxury 1', 8);
			const luxury2 = new LuxuryCard('luxury-2', 'Luxury 2', 4);
			
			const status = calculator.calculate([luxury1, luxury2]);
			
			// 8 + 4 = 12 (no multiplication)
			expect(status).toBe(12);
		});

		it('should handle luxury card with value 0 (hypothetical)', () => {
			const calculator = new StatusCalculator();
			
			const luxury0 = new LuxuryCard('luxury-0', 'Worthless', 0);
			const prestige = new PrestigeCard('prestige', 'Prestige');
			
			const status = calculator.calculate([luxury0, prestige]);
			
			// 0 × 2 = 0
			expect(status).toBe(0);
		});

		it('should handle very high luxury values', () => {
			const calculator = new StatusCalculator();
			
			// Hypothetical high-value luxury
			const luxuryHigh = new LuxuryCard('luxury-high', 'Ultra Luxury', 100);
			const prestige = new PrestigeCard('prestige', 'Prestige');
			
			const status = calculator.calculate([luxuryHigh, prestige]);
			
			// 100 × 2 = 200
			expect(status).toBe(200);
		});
	});

	describe('Card Metadata', () => {
		it('should have standard luxury card names', () => {
			const expectedNames = [
				'Fashion', 'Jewelry', 'Haute Cuisine', 'Travel', 'Art',
				'Automobiles', 'Estate', 'Yacht', 'Dressage', 'Opera'
			];
			
			const actualNames = LUXURY_CARDS.map(card => card.name);
			expect(actualNames).toEqual(expectedNames);
		});

		it('should have standard prestige card names', () => {
			const expectedNames = [
				'Bon Vivant', 'Joie De Vivre', 'Savoir Faire'
			];
			
			const actualNames = PRESTIGE_CARDS.map(card => card.name);
			expect(actualNames).toEqual(expectedNames);
		});
	});
});
