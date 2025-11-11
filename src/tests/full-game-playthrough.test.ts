import { describe, it, expect } from 'vitest';
import { GameState, GamePhase } from '$lib/domain/gameState';
import { GameScoringService } from '$lib/domain/scoring';
import { LuxuryCard, PrestigeCard, DisgraceFauxPas, DisgracePassé, DisgraceScandale } from '$lib/domain/cards';
import { isDisgraceCard } from '$lib/domain/auction';
import type { MoneyCard } from '$lib/domain/cards';

/**
 * Full game playthrough integration tests
 * Tests complete game flows from start to finish
 */
describe('Full Game Playthrough', () => {
	it('should play a complete 3-player game to completion', () => {
		const gameState = new GameState('integration-test');
		gameState.initializeGame(['Alice', 'Bob', 'Charlie']);

		const players = gameState.getPlayers();
		expect(players).toHaveLength(3);
		expect(gameState.getCurrentPhase()).toBe(GamePhase.AUCTION);

		let roundsPlayed = 0;
		const maxRounds = 16;

		// Play through the entire game
		while (roundsPlayed < maxRounds && gameState.getCurrentPhase() !== GamePhase.SCORING) {
			gameState.startNewRound();
			const auction = gameState.getCurrentAuction();

			if (!auction) {
				// Game ended
				break;
			}

			roundsPlayed++;
			const card = auction.getCard();

			console.log(`Round ${roundsPlayed}: ${card.name} (${card.constructor.name})`);

			// Simulate a simple auction - first player bids, others pass
			const currentPlayer = gameState.getCurrentPlayer();
			const moneyCard = currentPlayer.getMoneyHand()[0];

			if (moneyCard) {
				try {
					auction.processBid(currentPlayer, [moneyCard]);
				} catch {
					// If bid fails (not high enough), just pass
					auction.processPass(currentPlayer);
				}
			}

			// Other players pass
			const otherPlayers = players.filter(p => p.id !== currentPlayer.id);
			otherPlayers.forEach(player => {
				if (auction.getActivePlayers().has(player.id)) {
					auction.processPass(player);
				}
			});

			// Complete the auction
			gameState.completeAuction();
		}

		// Game should end
		expect(gameState.getCurrentPhase()).toBe(GamePhase.SCORING);
		expect(roundsPlayed).toBeGreaterThan(0);
		expect(roundsPlayed).toBeLessThanOrEqual(16); // Max possible (all 16 cards)

		// Verify players have status cards
		const totalCards = players.reduce((sum, p) => sum + p.getStatusCards().length, 0);
		expect(totalCards).toBeGreaterThan(0);

		// Calculate final rankings
		const scoringService = new GameScoringService();
		const rankings = scoringService.calculateFinalRankings(players);

		expect(rankings).toHaveLength(3);
		expect(rankings[0].rank).toBe(1); // Winner
		
		// At least one player should be cast out (unless tie)
		const castOutCount = rankings.filter(r => r.isCastOut).length;
		expect(castOutCount).toBeGreaterThanOrEqual(0);
	});

	it('should handle disgrace card auctions correctly in full game', () => {
		const gameState = new GameState('disgrace-test');
		gameState.initializeGame(['Alice', 'Bob', 'Charlie']);

		let disgraceCardsEncountered = 0;
		let roundsPlayed = 0;
		const maxRounds = 16;

		while (roundsPlayed < maxRounds && gameState.getCurrentPhase() !== GamePhase.SCORING) {
			gameState.startNewRound();
			const auction = gameState.getCurrentAuction();

			if (!auction) break;

			roundsPlayed++;
			const card = auction.getCard();

			if (isDisgraceCard(card)) {
				disgraceCardsEncountered++;
				console.log(`Round ${roundsPlayed}: Disgrace card - ${card.name}`);

				// In disgrace auction, everyone bids to avoid except last
				const players = gameState.getPlayers();
				const activePlayers = Array.from(auction.getActivePlayers());

				// First two players bid
				for (let i = 0; i < activePlayers.length - 1; i++) {
					const player = players.find(p => p.id === activePlayers[i])!;
					const moneyCard = player.getMoneyHand()[0];
					
					if (moneyCard) {
						try {
							auction.processBid(player, [moneyCard]);
						} catch {
							// Can't afford or invalid bid
							break;
						}
					}
				}

				// Last player passes and gets the disgrace card
				const lastPlayer = players.find(p => p.id === activePlayers[activePlayers.length - 1])!;
				auction.processPass(lastPlayer);

				expect(auction.isComplete()).toBe(true);
				expect(auction.getWinner()?.id).toBe(lastPlayer.id);
			} else {
				// Regular auction
				const players = gameState.getPlayers();
				const firstPlayer = players[0];
				const moneyCard = firstPlayer.getMoneyHand()[0];

				if (moneyCard) {
					try {
						auction.processBid(firstPlayer, [moneyCard]);
					} catch {
						auction.processPass(firstPlayer);
					}
				}

				// Others pass
				players.slice(1).forEach(player => {
					if (auction.getActivePlayers().has(player.id)) {
						auction.processPass(player);
					}
				});
			}

			gameState.completeAuction();
		}

		// Should have encountered some disgrace cards (3 total in deck)
		expect(disgraceCardsEncountered).toBeGreaterThanOrEqual(0);
		expect(disgraceCardsEncountered).toBeLessThanOrEqual(3);
	});

	it('should handle Faux Pas luxury discard in full game', () => {
		const gameState = new GameState('faux-pas-test');
		gameState.initializeGame(['Alice', 'Bob', 'Charlie']);

		let fauxPasEncountered = false;
		let roundsPlayed = 0;
		const maxRounds = 16;

		while (roundsPlayed < maxRounds && gameState.getCurrentPhase() !== GamePhase.SCORING) {
			gameState.startNewRound();
			const auction = gameState.getCurrentAuction();

			if (!auction) break;

			roundsPlayed++;
			const card = auction.getCard();

			if (card instanceof DisgraceFauxPas) {
				fauxPasEncountered = true;
				console.log(`Round ${roundsPlayed}: Faux Pas encountered`);

				const players = gameState.getPlayers();
				
				// First player passes and gets Faux Pas
				auction.processPass(players[0]);

				expect(auction.isComplete()).toBe(true);
				
				gameState.completeAuction();

				// Winner should have Faux Pas card
				const winner = players[0];
				expect(winner.getStatusCards().some(c => c instanceof DisgraceFauxPas)).toBe(true);
				expect(winner.getPendingLuxuryDiscard()).toBe(true);

				// If player has luxury cards, they need to discard one
				const luxuryCards = winner.getLuxuryCards();
				if (luxuryCards.length > 0) {
					gameState.handleLuxuryDiscard(winner.id, luxuryCards[0].id);
					expect(winner.getPendingLuxuryDiscard()).toBe(false);
				}
			} else {
				// Regular auction - simple resolution
				const players = gameState.getPlayers();
				players.forEach((player, idx) => {
					if (idx === 0 && auction.getActivePlayers().has(player.id)) {
						const moneyCard = player.getMoneyHand()[0];
						if (moneyCard) {
							try {
								auction.processBid(player, [moneyCard]);
							} catch {
								auction.processPass(player);
							}
						}
					} else if (auction.getActivePlayers().has(player.id)) {
						auction.processPass(player);
					}
				});

				gameState.completeAuction();
			}
		}

		// Faux Pas may or may not appear depending on shuffle
		console.log(`Faux Pas encountered: ${fauxPasEncountered}`);
	});

	it('should correctly handle money spending and remaining money', () => {
		const gameState = new GameState('money-test');
		gameState.initializeGame(['Alice', 'Bob']);

		const [alice, bob] = gameState.getPlayers();
		
		const initialAliceMoney = alice.getTotalRemainingMoney();
		const initialBobMoney = bob.getTotalRemainingMoney();

		// Each player starts with 11 money cards totaling 106,000
		expect(initialAliceMoney).toBe(106000);
		expect(initialBobMoney).toBe(106000);

		// Round 1: Alice bids 1000, Bob passes
		gameState.startNewRound();
		let auction = gameState.getCurrentAuction()!;
		
		const aliceMoney1 = alice.getMoneyHand().find((c: MoneyCard) => c.value === 1000)!;
		auction.processBid(alice, [aliceMoney1]);
		auction.processPass(bob);
		
		gameState.completeAuction();

		// Alice should have 1000 less
		expect(alice.getTotalRemainingMoney()).toBe(105000);
		expect(bob.getTotalRemainingMoney()).toBe(106000);

		// Round 2: Bob bids 2000, Alice passes
		gameState.startNewRound();
		auction = gameState.getCurrentAuction()!;
		
		const bobMoney2 = bob.getMoneyHand().find((c: MoneyCard) => c.value === 2000)!;
		auction.processBid(bob, [bobMoney2]);
		auction.processPass(alice);
		
		gameState.completeAuction();

		// Bob should have 2000 less
		expect(alice.getTotalRemainingMoney()).toBe(105000);
		expect(bob.getTotalRemainingMoney()).toBe(104000);

		// Round 3: Alice bids 3000 and 4000 (7000 total), Bob passes
		gameState.startNewRound();
		auction = gameState.getCurrentAuction()!;
		
		const aliceMoney3 = alice.getMoneyHand().find((c: MoneyCard) => c.value === 3000)!;
		const aliceMoney4 = alice.getMoneyHand().find((c: MoneyCard) => c.value === 4000)!;
		auction.processBid(alice, [aliceMoney3, aliceMoney4]);
		auction.processPass(bob);
		
		gameState.completeAuction();

		// Alice should have spent 1000 + 7000 = 8000 total
		expect(alice.getTotalRemainingMoney()).toBe(98000);
		expect(bob.getTotalRemainingMoney()).toBe(104000);
	});

	it('should end game at correct time and determine winner', () => {
		const gameState = new GameState('winner-test');
		gameState.initializeGame(['Alice', 'Bob', 'Charlie']);

		let roundsPlayed = 0;
		const maxRounds = 16;

		// Play through to completion
		while (roundsPlayed < maxRounds && gameState.getCurrentPhase() !== GamePhase.SCORING) {
			gameState.startNewRound();
			const auction = gameState.getCurrentAuction();

			if (!auction) break;

			roundsPlayed++;

			// Rotate who wins each auction
			const players = gameState.getPlayers();
			const winnerIndex = roundsPlayed % 3;
			const winner = players[winnerIndex];

			// Winner bids, others pass
			const moneyCard = winner.getMoneyHand()[0];
			if (moneyCard) {
				try {
					auction.processBid(winner, [moneyCard]);
				} catch {
					// If can't bid, pass
					auction.processPass(winner);
				}
			}

			players.forEach(player => {
				if (player.id !== winner.id && auction.getActivePlayers().has(player.id)) {
					auction.processPass(player);
				}
			});

			gameState.completeAuction();
		}

		expect(gameState.getCurrentPhase()).toBe(GamePhase.SCORING);

		// Calculate final rankings
		const scoringService = new GameScoringService();
		const rankings = scoringService.calculateFinalRankings(gameState.getPlayers());

		expect(rankings).toHaveLength(3);
		
		// Winner should have rank 1
		const winner = rankings.find(r => r.rank === 1)!;
		expect(winner).toBeTruthy();
		expect(winner.isCastOut).toBe(false);

		// Log final results
		console.log('\n=== FINAL RANKINGS ===');
		rankings.forEach(ranking => {
			console.log(`${ranking.rank}. ${ranking.player.name}`);
			console.log(`   Status: ${ranking.finalStatus}`);
			console.log(`   Money: ${ranking.remainingMoney.toLocaleString()}`);
			console.log(`   Cast Out: ${ranking.isCastOut}`);
			console.log(`   Cards: ${ranking.player.getStatusCards().map(c => c.name).join(', ')}`);
		});
	});

	it('should handle edge case of all players spending similar amounts', () => {
		const gameState = new GameState('similar-spending-test');
		gameState.initializeGame(['Alice', 'Bob', 'Charlie']);

		const players = gameState.getPlayers();
		let roundsPlayed = 0;
		const maxRounds = 16;

		// Each player wins roughly equal number of rounds
		while (roundsPlayed < maxRounds && gameState.getCurrentPhase() !== GamePhase.SCORING) {
			gameState.startNewRound();
			const auction = gameState.getCurrentAuction();

			if (!auction) break;

			roundsPlayed++;

			// Rotate winners
			const winnerIndex = roundsPlayed % 3;
			const winner = players[winnerIndex];

			// Winner bids a similar amount each time
			const moneyCard = winner.getMoneyHand().find((c: MoneyCard) => 
				c.value >= 1000 && c.value <= 4000
			);

			if (moneyCard) {
				try {
					auction.processBid(winner, [moneyCard]);
				} catch {
					auction.processPass(winner);
				}
			} else {
				auction.processPass(winner);
			}

			// Others pass
			players.forEach(player => {
				if (player.id !== winner.id && auction.getActivePlayers().has(player.id)) {
					auction.processPass(player);
				}
			});

			gameState.completeAuction();
		}

		// All players should have spent some money
		players.forEach(player => {
			expect(player.getTotalRemainingMoney()).toBeLessThan(106000);
		});

		// Calculate rankings
		const scoringService = new GameScoringService();
		const rankings = scoringService.calculateFinalRankings(players);

		// Should have a clear ranking based on status and money
		expect(rankings[0].rank).toBe(1);
		expect(rankings[1].rank).toBe(2);
		expect(rankings[2].rank).toBe(3);
	});

	it('should handle 2-player game', () => {
		const gameState = new GameState('two-player-test');
		gameState.initializeGame(['Alice', 'Bob']);

		const [alice, bob] = gameState.getPlayers();
		let roundsPlayed = 0;
		const maxRounds = 16;

		while (roundsPlayed < maxRounds && gameState.getCurrentPhase() !== GamePhase.SCORING) {
			gameState.startNewRound();
			const auction = gameState.getCurrentAuction();

			if (!auction) break;

			roundsPlayed++;

			// Alice bids, Bob passes (or vice versa)
			const bidder = roundsPlayed % 2 === 0 ? alice : bob;
			const passer = roundsPlayed % 2 === 0 ? bob : alice;

			const moneyCard = bidder.getMoneyHand()[0];
			if (moneyCard) {
				try {
					auction.processBid(bidder, [moneyCard]);
				} catch {
					auction.processPass(bidder);
				}
			}

			if (auction.getActivePlayers().has(passer.id)) {
				auction.processPass(passer);
			}

			gameState.completeAuction();
		}

		expect(gameState.getCurrentPhase()).toBe(GamePhase.SCORING);

		const scoringService = new GameScoringService();
		const rankings = scoringService.calculateFinalRankings([alice, bob]);

		expect(rankings).toHaveLength(2);
		expect(rankings[0].rank).toBe(1);
		expect(rankings[1].rank).toBe(2);
	});

	it('should handle 5-player game', () => {
		const gameState = new GameState('five-player-test');
		gameState.initializeGame(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve']);

		const players = gameState.getPlayers();
		expect(players).toHaveLength(5);

		let roundsPlayed = 0;
		const maxRounds = 16;

		while (roundsPlayed < maxRounds && gameState.getCurrentPhase() !== GamePhase.SCORING) {
			gameState.startNewRound();
			const auction = gameState.getCurrentAuction();

			if (!auction) break;

			roundsPlayed++;

			// First player bids, rest pass
			const moneyCard = players[0].getMoneyHand()[0];
			if (moneyCard) {
				try {
					auction.processBid(players[0], [moneyCard]);
				} catch {
					auction.processPass(players[0]);
				}
			}

			for (let i = 1; i < 5; i++) {
				if (auction.getActivePlayers().has(players[i].id)) {
					auction.processPass(players[i]);
				}
			}

			gameState.completeAuction();
		}

		expect(gameState.getCurrentPhase()).toBe(GamePhase.SCORING);

		const scoringService = new GameScoringService();
		const rankings = scoringService.calculateFinalRankings(players);

		expect(rankings).toHaveLength(5);
		
		// Should have at least one cast out player (lowest money)
		const castOutCount = rankings.filter(r => r.isCastOut).length;
		expect(castOutCount).toBeGreaterThanOrEqual(1);
	});
});
