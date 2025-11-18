/**
 * Game Orchestrator v2 - Matches actual domain API
 * Coordinates game actions using real GameState, Auction, and Player methods
 */
import { GameState, GamePhase } from '$lib/domain/gameState';
import { AuctionResult } from '$lib/domain/auction';
import type { MoneyCard, StatusCard } from '$lib/domain/cards';
import type { Player } from '$lib/domain/player';
import { logger } from '$lib/utils/logger';

const ctx = 'GameOrchestrator';

export interface ActionResult {
	success: boolean;
	error?: string;
	bidAmount?: number;
	auctionComplete?: boolean;
	needsLuxuryDiscard?: boolean;
	auctionResultData?: {
		winner: Player;
		card: StatusCard;
		winningBid: number;
		isDisgrace: boolean;
		losersInfo?: Array<{ player: Player; bidAmount: number }>;
	};
}

/**
 * Game Orchestrator - wraps a GameState and provides action methods
 * Returns ActionResult objects instead of using callbacks
 */
export class GameOrchestrator {
	private disgraceBidSnapshot: Map<string, number> | null = null;

	constructor(private gameState: GameState) {}

	/**
	 * Place a bid in the current auction
	 * @param moneyCardIds - Array of money card IDs to play
	 * @param currentPlayerIndex - Index of the player making the bid (for validation)
	 * @returns ActionResult with success status and auction completion info
	 */
	placeBid(moneyCardIds: string[], currentPlayerIndex: number): ActionResult {
		const auction = this.gameState.getCurrentAuction();
		const currentPlayer = this.gameState.getCurrentPlayer();
		
		if (!auction || !currentPlayer) {
			return { success: false, error: 'No active auction' };
		}
		
		// Validate it's the correct player's turn
		if (this.gameState.getCurrentPlayerIndex() !== currentPlayerIndex) {
			return { success: false, error: 'Not your turn!' };
		}
		
		// Validate selection
		if (moneyCardIds.length === 0) {
			return { success: false, error: 'Select at least one money card' };
		}
		
		// Find the money cards
		const moneyCards: MoneyCard[] = [];
		for (const cardId of moneyCardIds) {
			const card = currentPlayer.getMoneyHand().find(c => c.id === cardId);
			if (!card) {
				return { success: false, error: 'Invalid money card selected' };
			}
			moneyCards.push(card);
		}
		
		// Attempt the bid using domain API
		try {
			const result = auction.processBid(currentPlayer, moneyCards);
			const bidAmount = currentPlayer.getCurrentBidAmount();
			
			if (result === AuctionResult.COMPLETE) {
				return this.handleAuctionComplete(bidAmount);
			} else {
				// Move to next active player
				this.moveToNextActivePlayer();
				return { success: true, bidAmount, auctionComplete: false };
			}
		} catch (error) {
			return { 
				success: false, 
				error: error instanceof Error ? error.message : 'Invalid bid' 
			};
		}
	}

	/**
	 * Pass in the current auction
	 * @param currentPlayerIndex - Index of the player passing (for validation)
	 * @returns ActionResult with success status and auction completion info
	 */
	pass(currentPlayerIndex: number): ActionResult {
		const auction = this.gameState.getCurrentAuction();
		const currentPlayer = this.gameState.getCurrentPlayer();
		
		if (!auction || !currentPlayer) {
			return { success: false, error: 'No active auction' };
		}
		
		// Validate it's the correct player's turn
		if (this.gameState.getCurrentPlayerIndex() !== currentPlayerIndex) {
			return { success: false, error: 'Not your turn!' };
		}
		
		// Capture disgrace bid snapshot before passing
		this.captureDisgraceBidSnapshot();
		
		// Attempt the pass using domain API
		try {
			const result = auction.processPass(currentPlayer);
			
			if (result === AuctionResult.COMPLETE) {
				return this.handleAuctionComplete(0);
			} else {
				// Move to next active player
				this.moveToNextActivePlayer();
				return { success: true, auctionComplete: false };
			}
		} catch (error) {
			return { 
				success: false, 
				error: error instanceof Error ? error.message : 'Cannot pass' 
			};
		}
	}

	/**
	 * Handle luxury discard (for Faux Pas card)
	 * @param cardId - ID of the luxury card to discard
	 * @param playerId - ID of the player discarding
	 * @returns ActionResult with success status
	 */
	handleLuxuryDiscard(cardId: string, playerId: string): ActionResult {
		const player = this.gameState.getPlayer(playerId);
		if (!player) {
			return { success: false, error: 'Player not found' };
		}
		
		if (!player.getPendingLuxuryDiscard()) {
			return { success: false, error: 'No pending luxury discard' };
		}
		
		const card = player.getStatusCards().find(c => c.id === cardId);
		if (!card) {
			return { success: false, error: 'Card not found' };
		}
		
		// Verify it's a luxury card (not Prestige or Disgrace)
		const isLuxury = card.name !== 'Prestige' && 
			card.name !== 'Faux Pas' && 
			card.name !== 'Passé' && 
			card.name !== 'Scandale';
		
		if (!isLuxury) {
			return { success: false, error: 'Must select a luxury card' };
		}
		
		// Remove the card
		player.removeStatusCard(cardId);
		player.setPendingLuxuryDiscard(false);
		
		return { success: true };
	}

	/**
	 * Start a new round (draw next card and create auction)
	 * @returns ActionResult with success status
	 */
	startNewRound(): ActionResult {
		try {
			this.gameState.startNewRound();
			return { success: true };
		} catch (error) {
			logger.error(ctx, 'startNewRound() - ERROR', error);
			return { 
				success: false, 
				error: error instanceof Error ? error.message : 'Cannot start new round' 
			};
		}
	}

	// Private helper methods

	private handleAuctionComplete(lastBidAmount?: number): ActionResult {
		const auction = this.gameState.getCurrentAuction();
		if (!auction) {
			return { success: false, error: 'No auction to complete' };
		}
		
		logger.debug(ctx, 'handleAuctionComplete() - auction present', { 
			winnerId: auction.getWinner()?.id, 
			highestBid: auction.getCurrentHighestBid(), 
			activePlayers: Array.from(auction.getActivePlayers()) 
		});
		
		const winner = auction.getWinner();
		const card = auction.getCard();
		const winningBid = winner?.getCurrentBidAmount() ?? 0;
		const isDisgrace = this.gameState.getCurrentPhase() === GamePhase.DISGRACE_AUCTION;
		
		// Build losers info from snapshot (for disgrace auctions)
		let losersInfo: Array<{ player: Player; bidAmount: number }> | undefined;
		if (isDisgrace && winner && this.disgraceBidSnapshot) {
			losersInfo = Array.from(this.disgraceBidSnapshot.entries())
				.filter(([playerId]) => playerId !== winner.id)
				.map(([playerId, bidAmount]) => ({
					player: this.gameState.getPlayer(playerId)!,
					bidAmount
				}))
				.sort((a, b) => b.bidAmount - a.bidAmount);
			
			this.disgraceBidSnapshot = null;
		}
		
		// Complete the auction in the game state
		this.gameState.completeAuction();
		
		// Check if winner needs to discard a luxury card (Faux Pas effect)
		// Only require discard if they have the pending flag AND actually have luxury cards to discard
		const needsLuxuryDiscard = (winner?.getPendingLuxuryDiscard() ?? false) && (winner?.getLuxuryCards().length ?? 0) > 0;
		
		const resultData = winner && card ? {
			winner,
			card,
			winningBid,
			isDisgrace,
			losersInfo
		} : undefined;
		
		logger.debug(ctx, 'handleAuctionComplete() - auctionResultData', resultData ? { 
			winnerId: resultData.winner.id, 
			cardId: resultData.card.id, 
			winningBid: resultData.winningBid, 
			isDisgrace: resultData.isDisgrace, 
			losersCount: resultData.losersInfo?.length ?? 0 
		} : null);
		
		return {
			success: true,
			bidAmount: lastBidAmount,
			auctionComplete: true,
			needsLuxuryDiscard,
			auctionResultData: resultData
		};
	}

	private moveToNextActivePlayer(): void {
		const auction = this.gameState.getCurrentAuction();
		if (!auction) return;
		
		const players = this.gameState.getPlayers();
		const activePlayerIds = auction.getActivePlayers();
		
		// Find next active player
		let nextIndex = (this.gameState.getCurrentPlayerIndex() + 1) % players.length;
		let attempts = 0;
		
		while (!activePlayerIds.has(players[nextIndex].id) && attempts < players.length) {
			nextIndex = (nextIndex + 1) % players.length;
			attempts++;
		}
		
		this.gameState.setCurrentPlayerIndex(nextIndex);
	}

	private captureDisgraceBidSnapshot(): void {
		if (this.gameState.getCurrentPhase() === GamePhase.DISGRACE_AUCTION) {
			this.disgraceBidSnapshot = new Map();
			for (const player of this.gameState.getPlayers()) {
				const bid = player.getCurrentBidAmount();
				if (bid > 0) {
					this.disgraceBidSnapshot.set(player.id, bid);
				}
			}
		}
	}
}
