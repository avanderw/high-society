// Domain Layer - Game State Machine
import { Player, type PlayerPublicState } from './player';
import { StatusCard, MoneyCard, PlayerColor, LUXURY_CARDS, PRESTIGE_CARDS, DISGRACE_CARDS, MONEY_CARD_VALUES, DisgraceFauxPas } from './cards';
import { Auction, RegularAuction, DisgraceAuction, isDisgraceCard } from './auction';

export enum GamePhase {
  SETUP = 'setup',
  AUCTION = 'auction',
  DISGRACE_AUCTION = 'disgrace_auction',
  SCORING = 'scoring',
  FINISHED = 'finished'
}

export interface GamePublicState {
  gameId: string;
  phase: GamePhase;
  players: PlayerPublicState[];
  currentCard: StatusCard | null;
  gameEndTriggerCount: number;
  remainingStatusCards: number;
  currentPlayerIndex: number;
}

export class GameContext {
  constructor(
    public readonly gameState: GameState,
    public readonly currentPlayer?: Player
  ) {}
}

// Simple seeded random number generator (mulberry32)
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function shuffleArray<T>(array: T[], rng?: SeededRandom): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor((rng ? rng.next() : Math.random()) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export class GameState {
  private players: Player[] = [];
  private statusDeck: StatusCard[] = [];
  private revealedCards: StatusCard[] = [];
  private currentAuction: Auction | null = null;
  private gameEndTriggerCount = 0;
  private phase: GamePhase = GamePhase.SETUP;
  private currentPlayerIndex = 0;
  private rng?: SeededRandom;

  constructor(
    public readonly gameId: string,
    seed?: number
  ) {
    if (seed !== undefined) {
      this.rng = new SeededRandom(seed);
    }
  }

  // Initialization
  initializeGame(playerNames: string[]): void {
    if (playerNames.length < 2 || playerNames.length > 5) {
      throw new Error('Game requires 2-5 players');
    }

    const colors = [PlayerColor.RED, PlayerColor.BLUE, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.PURPLE];
    
    this.players = playerNames.map((name, index) => 
      new Player(`player-${index}`, name, colors[index])
    );

    // Deal money cards
    this.players.forEach((player) => {
      const moneyCards = MONEY_CARD_VALUES.map((value, cardIndex) => 
        new MoneyCard(`${player.id}-money-${cardIndex}`, value, player.color)
      );
      player.dealMoneyCards(moneyCards);
    });

    // Create and shuffle status deck
    const deck = [...LUXURY_CARDS, ...PRESTIGE_CARDS, ...DISGRACE_CARDS];
    this.statusDeck = shuffleArray(deck, this.rng);

    this.phase = GamePhase.AUCTION;
  }

  // Game progression
  startNewRound(): void {
    // If game is already over, do nothing
    if (this.phase === GamePhase.SCORING || this.phase === GamePhase.FINISHED) {
      return;
    }
    
    const nextCard = this.drawStatusCard();
    
    // Check if game should end AFTER drawing (4th trigger ends game immediately)
    if (this.isGameEnd()) {
      this.phase = GamePhase.SCORING;
      return;
    }

    this.currentAuction = this.createAuction(nextCard);

    const auctionType = isDisgraceCard(nextCard)
      ? GamePhase.DISGRACE_AUCTION
      : GamePhase.AUCTION;
    this.phase = auctionType;
  }

  private drawStatusCard(): StatusCard {
    if (this.statusDeck.length === 0) {
      throw new Error('No more status cards');
    }

    const card = this.statusDeck.pop()!;
    this.revealedCards.push(card);

    if (card.isGameEndTrigger) {
      this.gameEndTriggerCount++;
    }

    return card;
  }

  private isGameEnd(): boolean {
    return this.gameEndTriggerCount >= 4;
  }

  private createAuction(card: StatusCard): Auction {
    return isDisgraceCard(card)
      ? new DisgraceAuction(card, this.players)
      : new RegularAuction(card, this.players);
  }

  // State queries
  getCurrentPhase(): GamePhase {
    return this.phase;
  }

  getCurrentAuction(): Auction | null {
    return this.currentAuction;
  }

  getPlayers(): Player[] {
    return [...this.players];
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.find(p => p.id === playerId);
  }

  getCurrentPlayer(): Player {
    return this.players[this.currentPlayerIndex];
  }

  getCurrentPlayerIndex(): number {
    return this.currentPlayerIndex;
  }

  setCurrentPlayerIndex(index: number): void {
    this.currentPlayerIndex = index;
  }

  nextPlayer(): void {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
  }

  completeAuction(): void {
    if (!this.currentAuction) return;

    const winner = this.currentAuction.getWinner();
    if (winner) {
      // Winner discards their money
      winner.discardPlayedMoney();
      
      // Winner gets the card
      const card = this.currentAuction.getCard();
      winner.addStatusCard(card);

      // Apply card effects
      if (card instanceof DisgraceFauxPas) {
        const luxuryCards = winner.getLuxuryCards();
        if (luxuryCards.length > 0) {
          // Mark that player needs to discard
          winner.setPendingLuxuryDiscard(true);
        } else {
          // Will discard next luxury card received
          winner.setPendingLuxuryDiscard(true);
        }
      }

      // Winner becomes the starting player
      this.currentPlayerIndex = this.players.findIndex(p => p.id === winner.id);
    }

    this.currentAuction = null;

    // Check if game should end
    if (this.isGameEnd()) {
      this.phase = GamePhase.SCORING;
    }
  }

  setPhase(phase: GamePhase): void {
    this.phase = phase;
  }

  getPublicState(): GamePublicState {
    return {
      gameId: this.gameId,
      phase: this.phase,
      players: this.players.map(p => p.getPublicState()),
      currentCard: this.currentAuction?.getCard() || null,
      gameEndTriggerCount: this.gameEndTriggerCount,
      remainingStatusCards: this.statusDeck.length,
      currentPlayerIndex: this.currentPlayerIndex
    };
  }

  handleLuxuryDiscard(playerId: string, luxuryCardId: string): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    player.removeStatusCard(luxuryCardId);
    
    // Remove Faux Pas card
    const fauxPasCard = player.getStatusCards().find(c => c.id === 'faux-pas');
    if (fauxPasCard) {
      player.removeStatusCard(fauxPasCard.id);
    }
    
    player.setPendingLuxuryDiscard(false);
  }
}
