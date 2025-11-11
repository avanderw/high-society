import { describe, it, expect } from 'vitest';
import { GameState } from '$lib/domain/gameState';
import { serializeGameState, deserializeGameState } from '$lib/multiplayer/serialization';
import type { MoneyCard } from '$lib/domain/cards';

/**
 * Test that deserialization creates NEW GameState objects
 * to ensure Svelte reactivity triggers
 */
describe('Reactivity Fix - Deserialization', () => {
	it('should create a NEW GameState object on deserialization for reactivity', () => {
		// Create original game state with seed 1777 (A starts with Opera - luxury card)
		const originalGame = new GameState('test-game', 1777);
		originalGame.initializeGame(['A', 'B', 'C']);
		originalGame.startNewRound();

		const [playerA, playerB, playerC] = originalGame.getPlayers();
		const auction = originalGame.getCurrentAuction()!;

		// Make some bids - use whatever money cards are available
		const aMoneyCard = playerA.getMoneyHand().find((c: MoneyCard) => c.value > 0)!;
		const bMoneyCard = playerB.getMoneyHand().find((c: MoneyCard) => c.value > aMoneyCard.value)!;
		
		auction.processBid(playerA, [aMoneyCard]);
		auction.processBid(playerB, [bMoneyCard]);
		auction.processPass(playerC);

		console.log('Original game - Player B bid:', playerB.getCurrentBidAmount());
		expect(playerB.getCurrentBidAmount()).toBe(bMoneyCard.value);

		// Serialize the state
		const serialized = serializeGameState(originalGame);

		// Simulate host completing auction and starting new round
		auction.processPass(playerA);
		originalGame.completeAuction();
		originalGame.startNewRound();

		console.log('After completion - Player B bid:', originalGame.getPlayers()[1].getCurrentBidAmount());
		expect(originalGame.getPlayers()[1].getCurrentBidAmount()).toBe(0);

		// Serialize the new state
		const serializedAfterComplete = serializeGameState(originalGame);

		// CLIENT: Deserialize the new state
		// This should create a NEW GameState object, not reuse the original
		const deserializedGame = deserializeGameState(serializedAfterComplete, originalGame);

		// CRITICAL: The deserialized game should be a DIFFERENT object
		// This ensures Svelte's reactivity will detect the change
		expect(deserializedGame).not.toBe(originalGame);
		console.log('Deserialized game is new object:', deserializedGame !== originalGame);

		// Verify the state is correct
		const deserializedPlayerB = deserializedGame.getPlayers()[1];
		console.log('Deserialized Player B bid:', deserializedPlayerB.getCurrentBidAmount());
		expect(deserializedPlayerB.getCurrentBidAmount()).toBe(0);

		// The player objects should also be different
		expect(deserializedPlayerB).not.toBe(playerB);
		console.log('Player objects are different:', deserializedPlayerB !== playerB);
	});
});
