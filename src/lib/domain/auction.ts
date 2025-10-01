// Application Layer - Auction System
import { StatusCard, MoneyCard, DisgraceFauxPas, DisgracePassé, DisgraceScandale } from './cards';
import type { Player } from './player';

export enum AuctionResult {
  CONTINUE = 'continue',
  COMPLETE = 'complete'
}

export abstract class Auction {
  protected activePlayers: Set<string>;
  protected currentHighestBid = 0;
  protected currentWinner: Player | null = null;

  constructor(
    protected card: StatusCard,
    protected players: Player[]
  ) {
    this.activePlayers = new Set(players.map(p => p.id));
  }

  abstract processBid(player: Player, moneyCards: MoneyCard[]): AuctionResult;
  abstract processPass(player: Player): AuctionResult;
  abstract isComplete(): boolean;
  abstract getWinner(): Player | null;

  getCard(): StatusCard {
    return this.card;
  }

  getActivePlayers(): Set<string> {
    return new Set(this.activePlayers);
  }

  getCurrentHighestBid(): number {
    return this.currentHighestBid;
  }

  protected validatePlayerActive(player: Player): void {
    if (!this.activePlayers.has(player.id)) {
      throw new Error('Player is not active in this auction');
    }
  }
}

export class RegularAuction extends Auction {
  processBid(player: Player, moneyCards: MoneyCard[]): AuctionResult {
    this.validatePlayerActive(player);

    const previousBid = player.getCurrentBidAmount();
    player.playMoneyCards(moneyCards);
    const newBid = player.getCurrentBidAmount();

    // New bid must be higher than the current highest bid
    if (newBid <= this.currentHighestBid) {
      // Undo the bid by returning ALL played money
      player.returnPlayedMoney();
      throw new Error(`Bid must be higher than ${this.currentHighestBid.toLocaleString()} Francs (your bid: ${newBid.toLocaleString()})`);
    }

    this.currentHighestBid = newBid;
    this.currentWinner = player;

    return AuctionResult.CONTINUE;
  }

  processPass(player: Player): AuctionResult {
    this.validatePlayerActive(player);

    player.returnPlayedMoney();
    this.activePlayers.delete(player.id);

    return this.activePlayers.size <= 1 ? AuctionResult.COMPLETE : AuctionResult.CONTINUE;
  }

  isComplete(): boolean {
    return this.activePlayers.size <= 1;
  }

  getWinner(): Player | null {
    return this.isComplete() ? this.currentWinner : null;
  }
}

export class DisgraceAuction extends Auction {
  processPass(player: Player): AuctionResult {
    this.validatePlayerActive(player);

    // In disgrace auctions, first to pass gets the card
    player.returnPlayedMoney();
    this.currentWinner = player;

    // All other players lose their money
    this.players.forEach(p => {
      if (p.id !== player.id) {
        p.discardPlayedMoney();
      }
    });

    return AuctionResult.COMPLETE;
  }

  processBid(player: Player, moneyCards: MoneyCard[]): AuctionResult {
    // Bidding in disgrace auction - trying to avoid the card
    this.validatePlayerActive(player);
    player.playMoneyCards(moneyCards);
    const newBid = player.getCurrentBidAmount();

    if (newBid <= this.currentHighestBid) {
      player.returnPlayedMoney();
      throw new Error('Bid must be higher than current bid');
    }

    this.currentHighestBid = newBid;
    
    return AuctionResult.CONTINUE;
  }

  isComplete(): boolean {
    return this.currentWinner !== null;
  }

  getWinner(): Player | null {
    return this.currentWinner;
  }
}

export function isDisgraceCard(card: StatusCard): boolean {
  return card instanceof DisgraceFauxPas || 
         card instanceof DisgracePassé || 
         card instanceof DisgraceScandale;
}
