// Domain Layer - Player Entity
import { MoneyCard, StatusCard, LuxuryCard, PrestigeCard, type PlayerColor, type StatusEffect } from './cards';

export interface PlayerPublicState {
  id: string;
  name: string;
  color: PlayerColor;
  statusCards: StatusCard[];
  currentBid: number;
  remainingMoneyCount: number;
  totalRemainingMoney?: number;
  hasPendingLuxuryDiscard: boolean;
}

export class Player {
  private moneyHand: MoneyCard[] = [];
  private statusCards: StatusCard[] = [];
  private playedMoney: MoneyCard[] = [];
  private pendingEffects: StatusEffect[] = [];
  private hasPendingLuxuryDiscard = false;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly color: PlayerColor
  ) {}

  // Money management
  dealMoneyCards(cards: MoneyCard[]): void {
    this.moneyHand = [...cards];
  }

  getMoneyHand(): MoneyCard[] {
    return [...this.moneyHand];
  }

  getTotalRemainingMoney(): number {
    return this.moneyHand.reduce((sum, card) => sum + card.value, 0);
  }

  getCurrentBidAmount(): number {
    return this.playedMoney.reduce((sum, card) => sum + card.value, 0);
  }

  canAffordBid(amount: number): boolean {
    const availableMoney = this.getTotalRemainingMoney() + this.getCurrentBidAmount();
    return availableMoney >= amount;
  }

  playMoneyCards(cards: MoneyCard[]): void {
    cards.forEach(card => {
      const index = this.moneyHand.findIndex(c => c.id === card.id);
      if (index === -1) {
        throw new Error(`Card ${card.id} not in hand`);
      }
      this.moneyHand.splice(index, 1);
      this.playedMoney.push(card);
    });
  }

  getPlayedMoney(): MoneyCard[] {
    return [...this.playedMoney];
  }

  returnPlayedMoney(): void {
    this.moneyHand.push(...this.playedMoney);
    this.playedMoney = [];
  }

  discardPlayedMoney(): void {
    this.playedMoney = [];
  }

  // Status card management
  addStatusCard(card: StatusCard): void {
    this.statusCards.push(card);
  }

  removeStatusCard(cardId: string): StatusCard | null {
    const index = this.statusCards.findIndex(c => c.id === cardId);
    if (index === -1) return null;
    return this.statusCards.splice(index, 1)[0];
  }

  getStatusCards(): StatusCard[] {
    return [...this.statusCards];
  }

  getLuxuryCards(): LuxuryCard[] {
    return this.statusCards.filter(card => card instanceof LuxuryCard) as LuxuryCard[];
  }

  getPrestigeCards(): PrestigeCard[] {
    return this.statusCards.filter(card => card instanceof PrestigeCard) as PrestigeCard[];
  }

  setPendingLuxuryDiscard(pending: boolean): void {
    this.hasPendingLuxuryDiscard = pending;
  }

  getPendingLuxuryDiscard(): boolean {
    return this.hasPendingLuxuryDiscard;
  }

  // State queries
  getPublicState(): PlayerPublicState {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      statusCards: [...this.statusCards],
      currentBid: this.getCurrentBidAmount(),
      remainingMoneyCount: this.moneyHand.length,
      totalRemainingMoney: this.getTotalRemainingMoney(),
      hasPendingLuxuryDiscard: this.hasPendingLuxuryDiscard
    };
  }
}
