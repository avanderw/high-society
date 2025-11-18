import { describe, it, expect } from 'vitest';
import { GameState } from '$lib/domain/gameState';
import { GameOrchestrator } from '$lib/orchestrators/GameOrchestrator';

describe('First Card Discard Bug', () => {
	it('BUG: should NOT require luxury discard when winning Faux Pas as first card', () => {
		// Reproduce exact scenario from logs: Faux Pas is first card, host wins by passing
		const gameState = new GameState('test-game', 1763458037384);
		gameState.initializeGame(['Violet Virtue', 'Jade Justice', 'Geneva Genevieve']);
		gameState.startNewRound();
		const orchestrator = new GameOrchestrator(gameState);
		
		const firstCard = gameState.getPublicState().currentCard;
		console.log('[TEST] First card:', firstCard?.name, firstCard?.id);
		
		const hostPlayer = gameState.getPlayers()[0]; // player-0 (Violet Virtue)
		const publicPlayers = gameState.getPublicState().players;
		const hostPublic = publicPlayers.find(p => p.id === hostPlayer.id)!;
		
		// Verify initial state
		expect(hostPlayer.getLuxuryCards().length).toBe(0);
		expect(hostPlayer.getStatusCards().length).toBe(0);
		expect(hostPublic.hasPendingLuxuryDiscard).toBe(false);
		
		// Host passes (wins Faux Pas with bid 0 - disgrace auctions go to passer)
		const result = orchestrator.pass(0);
		
		console.log('[TEST] Result:', {
			auctionComplete: result.auctionComplete,
			needsLuxuryDiscard: result.needsLuxuryDiscard,
			luxuryCount: hostPlayer.getLuxuryCards().length,
			statusCount: hostPlayer.getStatusCards().length
		});
		
		// Verify results
		expect(result.auctionComplete).toBe(true);
		
		// ❌ BUG: This is returning needsLuxuryDiscard: true
		// ✅ CORRECT: Should be FALSE because host has NO luxury cards to discard yet
		expect(result.needsLuxuryDiscard).toBe(false); 
		
		// Verify post-auction state
		const hostPublicAfter = gameState.getPublicState().players.find(p => p.id === hostPlayer.id)!;
		expect(hostPlayer.getLuxuryCards().length).toBe(0); // Still no luxury cards
		expect(hostPublicAfter.hasPendingLuxuryDiscard).toBe(true); // But flag IS set for future
		expect(hostPlayer.getStatusCards().length).toBe(1); // Has the Faux Pas card
	});
});
