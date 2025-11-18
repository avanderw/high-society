/**
 * Host Guard - Ensures only the host executes certain game logic operations
 * 
 * This module provides utilities to protect host-only operations in multiplayer games.
 * Clients should only broadcast actions and wait for state updates from the host.
 */

import type { MultiplayerService } from './service';

/**
 * Guard result indicating whether an operation should proceed
 */
export interface GuardResult {
	/** Whether the operation should execute */
	shouldExecute: boolean;
	/** Reason for the decision (useful for debugging) */
	reason: 'single-player' | 'host' | 'client';
}

/**
 * Check if the current player should execute game logic
 * 
 * @param multiplayerService - The multiplayer service (null if single-player)
 * @returns GuardResult indicating whether to execute and why
 * 
 * @example
 * ```typescript
 * const guard = shouldExecuteGameLogic(multiplayerService);
 * if (guard.shouldExecute) {
 *   // Execute game logic
 *   const result = store.pass();
 * } else {
 *   // Just broadcast the action
 *   multiplayerOrchestrator.broadcastPass();
 * }
 * ```
 */
export function shouldExecuteGameLogic(
	multiplayerService: MultiplayerService | null
): GuardResult {
	// Single-player mode - always execute
	if (!multiplayerService) {
		return { shouldExecute: true, reason: 'single-player' };
	}

	// Multiplayer mode - only host executes
	const isHost = multiplayerService.isHost();
	return {
		shouldExecute: isHost,
		reason: isHost ? 'host' : 'client'
	};
}

/**
 * Execute game logic only if this player is the host (or in single-player mode)
 * Otherwise, execute the broadcast function
 * 
 * @param multiplayerService - The multiplayer service (null if single-player)
 * @param gameLogic - Function to execute game logic (host or single-player)
 * @param broadcastAction - Function to broadcast action (client only)
 * @returns Result from whichever function was executed
 * 
 * @example
 * ```typescript
 * executeAsHost(
 *   multiplayerService,
 *   () => {
 *     // Host logic
 *     const result = store.pass();
 *     if (result.success) {
 *       feedback.play(FeedbackType.PASS);
 *       // ... handle result
 *     }
 *     return result;
 *   },
 *   () => {
 *     // Client logic
 *     multiplayerOrchestrator.broadcastPass();
 *     store.selectedMoneyCards = [];
 *     feedback.play(FeedbackType.PASS);
 *   }
 * );
 * ```
 */
export function executeAsHost<TGameResult, TBroadcastResult = void>(
	multiplayerService: MultiplayerService | null,
	gameLogic: () => TGameResult,
	broadcastAction: () => TBroadcastResult
): TGameResult | TBroadcastResult {
	const guard = shouldExecuteGameLogic(multiplayerService);
	
	if (guard.shouldExecute) {
		console.log(`[HostGuard] Executing game logic as ${guard.reason}`);
		return gameLogic();
	} else {
		console.log(`[HostGuard] Broadcasting action as ${guard.reason}`);
		return broadcastAction();
	}
}

/**
 * Assert that the current context is host or single-player
 * Throws an error if called by a client
 * 
 * @param multiplayerService - The multiplayer service (null if single-player)
 * @param operationName - Name of the operation being guarded (for error messages)
 * @throws Error if called by a non-host client
 * 
 * @example
 * ```typescript
 * function startNewRound() {
 *   assertHost(multiplayerService, 'startNewRound');
 *   // Only reaches here if host or single-player
 *   return store.startNewRound();
 * }
 * ```
 */
export function assertHost(
	multiplayerService: MultiplayerService | null,
	operationName: string
): void {
	const guard = shouldExecuteGameLogic(multiplayerService);
	
	if (!guard.shouldExecute) {
		throw new Error(
			`[HostGuard] Operation "${operationName}" can only be executed by the host. ` +
			`Current role: ${guard.reason}`
		);
	}
}

/**
 * Check if the current player is a client in multiplayer mode
 * 
 * @param multiplayerService - The multiplayer service (null if single-player)
 * @returns true if this is a non-host client
 */
export function isClient(multiplayerService: MultiplayerService | null): boolean {
	if (!multiplayerService) {
		return false; // Single-player
	}
	return !multiplayerService.isHost();
}
