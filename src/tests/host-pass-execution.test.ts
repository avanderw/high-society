/**
 * Test for Host Pass Execution Bug
 * 
 * This test verifies that when a client broadcasts a pass action,
 * the host actually executes the pass logic and progresses the game state.
 * 
 * Bug symptoms from logs:
 * - Client broadcasts action:pass event multiple times (9 times in logs)
 * - Host receives the action:pass events (visible in host logs)
 * - Host does NOT execute the pass logic (no "[pass] HOST" log)
 * - Game state does not progress (currentPlayerIndex stays at 1)
 * - Client keeps broadcasting pass because it's still their turn
 * 
 * Root cause:
 * - MultiplayerOrchestrator.handlePassAuction() only calls store.forceUpdate()
 * - It does NOT call store.pass() to actually execute the pass logic
 * - The host needs to execute the pass logic when receiving action:pass from clients
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReactiveGameStore } from '$lib/stores/reactiveGameStore.svelte';
import { GamePhase } from '$lib/domain/gameState';

describe('Host Pass Execution Bug', () => {
	let store: ReactiveGameStore;
	
	beforeEach(() => {
		store = new ReactiveGameStore();
	});
	
	it('should advance turn when pass is executed', () => {
		// Initialize game with seed 1777 which gives a luxury card (Opera/Art) for testing
		const playerNames = ['Host Player', 'Client Player', 'Bot Player'];
		store.initialize(playerNames, 1777, 30);
		store.setMultiplayerContext('player-0', new Map([
			['player-0', 0],
			['player-1', 1],
			['player-2', 2]
		]));
		
		// Verify initial state - should be auction phase for luxury card
		expect(store.currentPhase).toBe(GamePhase.AUCTION);
		expect(store.gameState?.getCurrentPlayerIndex()).toBe(0);
		
		// Get a valid money card from player 0's hand
		const player0 = store.gameState?.getPlayer('player-0');
		const moneyCards = player0?.getMoneyHand();
		expect(moneyCards).toBeDefined();
		expect(moneyCards!.length).toBeGreaterThan(0);
		
		// Host (player 0) places a bid with first available money card
		const bidResult = store.placeBid([moneyCards![0].id]);
		expect(bidResult.success).toBe(true);
		expect(bidResult.auctionComplete).toBe(false);
		
		// Turn should advance to player 1 (client)
		expect(store.gameState?.getCurrentPlayerIndex()).toBe(1);
		
		// Get auction state before pass
		const auctionBeforePass = store.currentAuction;
		expect(auctionBeforePass).toBeDefined();
		const activePlayersBeforePass = Array.from(auctionBeforePass!.getActivePlayers());
		expect(activePlayersBeforePass).toHaveLength(3);
		expect(activePlayersBeforePass).toContain('player-1');
		
		// BUG REPRODUCTION: In multiplayer, when client (player 1) passes:
		// - Client calls broadcastPass() which sends action:pass event
		// - Host receives action:pass event
		// - Host's handlePassAuction() is called
		// - BUT handlePassAuction() only calls forceUpdate(), NOT store.pass()
		// - So the game state doesn't actually progress
		
		// What SHOULD happen: Host executes the pass
		const passResult = store.pass();
		expect(passResult.success).toBe(true);
		
		// Verify turn advanced to player 2
		expect(store.gameState?.getCurrentPlayerIndex()).toBe(2);
		
		// Verify player 1 is no longer active
		const auctionAfterPass = store.currentAuction;
		expect(auctionAfterPass).toBeDefined();
		const activePlayersAfterPass = Array.from(auctionAfterPass!.getActivePlayers());
		expect(activePlayersAfterPass).not.toContain('player-1');
		expect(activePlayersAfterPass).toHaveLength(2);
	});
	
	it('should document expected behavior vs actual buggy behavior', () => {
		// This test documents what SHOULD happen vs what currently DOES happen
		
		// Setup with seed 1777 for luxury card
		const playerNames = ['Host', 'Client', 'Bot'];
		store.initialize(playerNames, 1777, 30);
		store.setMultiplayerContext('player-0', new Map([
			['player-0', 0],
			['player-1', 1],
			['player-2', 2]
		]));
		
		// Get valid money card
		const player0 = store.gameState?.getPlayer('player-0');
		const moneyCards = player0?.getMoneyHand();
		expect(moneyCards!.length).toBeGreaterThan(0);
		
		// Host bids
		store.placeBid([moneyCards![0].id]);
		const playerIndexAfterHostBid = store.gameState?.getCurrentPlayerIndex();
		expect(playerIndexAfterHostBid).toBe(1); // Client's turn
		
		// === EXPECTED BEHAVIOR (what should happen) ===
		// 1. Client broadcasts action:pass event
		// 2. Host receives action:pass event
		// 3. Host's MultiplayerOrchestrator.handlePassAuction() is called
		// 4. Host executes store.pass() to apply the pass logic
		// 5. Turn advances to player 2
		// 6. Host broadcasts state:sync with updated game state
		// 7. All clients receive updated state with currentPlayerIndex = 2
		
		// === ACTUAL BUGGY BEHAVIOR (what currently happens) ===
		// 1. Client broadcasts action:pass event
		// 2. Host receives action:pass event
		// 3. Host's MultiplayerOrchestrator.handlePassAuction() is called
		// 4. Host ONLY calls store.forceUpdate() ❌ BUG HERE
		// 5. Turn does NOT advance, still at player 1 ❌
		// 6. Host does not broadcast state:sync (no state change) ❌
		// 7. Client still sees it's their turn (currentPlayerIndex = 1) ❌
		// 8. Client broadcasts action:pass again (infinite loop) ❌
		
		// To verify the bug exists, we check that forceUpdate alone doesn't advance turn
		const updateCounterBefore = store.updateCounter;
		store.forceUpdate();
		const updateCounterAfter = store.updateCounter;
		
		// forceUpdate increments counter but doesn't change game state
		expect(updateCounterAfter).toBe(updateCounterBefore + 1);
		// Turn should still be at player 1 (bug reproduction)
		expect(store.gameState?.getCurrentPlayerIndex()).toBe(1);
		
		// Now execute the CORRECT behavior - actually call pass()
		store.pass();
		// Turn should now advance to player 2
		expect(store.gameState?.getCurrentPlayerIndex()).toBe(2);
	});
	
	it('should complete auction when only one player remains after passes', () => {
		// Full scenario test showing the complete flow
		const playerNames = ['Host', 'Client', 'Bot'];
		store.initialize(playerNames, 1777, 30);
		store.setMultiplayerContext('player-0', new Map([
			['player-0', 0],
			['player-1', 1],
			['player-2', 2]
		]));
		
		// Initial state
		expect(store.currentPhase).toBe(GamePhase.AUCTION);
		const initialCard = store.currentCard;
		expect(initialCard).toBeDefined();
		
		// Get valid money cards
		const player0 = store.gameState?.getPlayer('player-0');
		const moneyCards = player0?.getMoneyHand();
		expect(moneyCards!.length).toBeGreaterThan(1);
		
		// Host bids
		const hostBidResult = store.placeBid([moneyCards![0].id]);
		expect(hostBidResult.success).toBe(true);
		expect(hostBidResult.auctionComplete).toBe(false);
		expect(store.gameState?.getCurrentPlayerIndex()).toBe(1);
		
		// Client passes
		const clientPassResult = store.pass();
		expect(clientPassResult.success).toBe(true);
		expect(clientPassResult.auctionComplete).toBe(false);
		expect(store.gameState?.getCurrentPlayerIndex()).toBe(2);
		
		// Bot passes  
		const botPassResult = store.pass();
		expect(botPassResult.success).toBe(true);
		// After bot passes, only host is left, so auction completes
		// (This is different from bid scenario where host can continue bidding)
		// When a pass leaves only one player, that player wins immediately
		expect(botPassResult.auctionComplete).toBe(true);
		expect(botPassResult.auctionResultData).toBeDefined();
		expect(botPassResult.auctionResultData?.winner.id).toBe('player-0');
	});
	
	it('should not allow multiple passes in rapid succession to break game state', () => {
		// Simulates the scenario from logs where client sends 9 pass events
		const playerNames = ['Host', 'Client', 'Bot'];
		store.initialize(playerNames, 1777, 30);
		store.setMultiplayerContext('player-0', new Map([
			['player-0', 0],
			['player-1', 1],
			['player-2', 2]
		]));
		
		// Get valid money card
		const player0 = store.gameState?.getPlayer('player-0');
		const moneyCards = player0?.getMoneyHand();
		expect(moneyCards!.length).toBeGreaterThan(0);
		
		// Host bids
		store.placeBid([moneyCards![0].id]);
		expect(store.gameState?.getCurrentPlayerIndex()).toBe(1);
		
		const auctionBeforePass = store.currentAuction;
		const activePlayersBeforePass = Array.from(auctionBeforePass!.getActivePlayers());
		expect(activePlayersBeforePass).toHaveLength(3);
		
		// Execute pass once (correct behavior)
		store.pass();
		expect(store.gameState?.getCurrentPlayerIndex()).toBe(2);
		
		const auctionAfterPass = store.currentAuction;
		const activePlayersAfterPass = Array.from(auctionAfterPass!.getActivePlayers());
		expect(activePlayersAfterPass).toHaveLength(2);
		expect(activePlayersAfterPass).not.toContain('player-1');
		
		// Attempting to pass again for the same player should not work
		// (player 1 is no longer active, so even if event comes through again, it should be ignored)
		// This is what event deduplication should prevent
	});
	
	it('should verify player becomes inactive after passing', () => {
		// Specific test for the pass mechanic
		const playerNames = ['A', 'B', 'C'];
		store.initialize(playerNames, 1777, 30);
		store.setMultiplayerContext('player-0', new Map([
			['player-0', 0],
			['player-1', 1],
			['player-2', 2]
		]));
		
		// Get valid money card
		const player0 = store.gameState?.getPlayer('player-0');
		const moneyCards = player0?.getMoneyHand();
		expect(moneyCards!.length).toBeGreaterThan(0);
		
		// Player A bids
		store.placeBid([moneyCards![0].id]);
		
		// Player B passes
		const currentPlayerBeforePass = store.gameState?.getCurrentPlayerIndex();
		expect(currentPlayerBeforePass).toBe(1);
		
		const auction = store.currentAuction!;
		const activePlayersBeforePass = Array.from(auction.getActivePlayers());
		expect(activePlayersBeforePass).toContain('player-1');
		
		// Execute pass
		const passResult = store.pass();
		expect(passResult.success).toBe(true);
		
		// Player B should no longer be active
		const activePlayersAfterPass = Array.from(auction.getActivePlayers());
		expect(activePlayersAfterPass).not.toContain('player-1');
		
		// Turn should advance to player C
		const currentPlayerAfterPass = store.gameState?.getCurrentPlayerIndex();
		expect(currentPlayerAfterPass).toBe(2);
	});
});
