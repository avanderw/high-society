// Domain Layer - Game State Machine
import { Player, type PlayerPublicState } from './player';
import { StatusCard, MoneyCard, PlayerColor, LUXURY_CARDS, PRESTIGE_CARDS, DISGRACE_CARDS, MONEY_CARD_VALUES, DisgraceFauxPas, LuxuryCard } from './cards';
import { Auction, RegularAuction, DisgraceAuction, isDisgraceCard } from './auction';
import { loggers } from '../utils/logger';

const log = loggers.domain.gameState;

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
  turnTimerSeconds: number;
}

export class GameContext {
  constructor(
    public readonly gameState: GameState,
    public readonly currentPlayer?: Player
  ) {}
}

// Simple seeded random number generator (mulberry32)
export class SeededRandom {
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

export function shuffleArray<T>(array: T[], rng?: SeededRandom): T[] {
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
  private turnTimerSeconds = 30; // Default 30 seconds per turn

  constructor(
    public readonly gameId: string,
    seed?: number,
    turnTimerSeconds?: number
  ) {
    if (seed !== undefined) {
      this.rng = new SeededRandom(seed);
    }
    if (turnTimerSeconds !== undefined) {
      this.turnTimerSeconds = turnTimerSeconds;
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
    log('startNewRound() called', {
      phase: this.phase,
      gameEndTriggerCount: this.gameEndTriggerCount,
      deckLength: this.statusDeck.length
    });
    
    // If game is already over, do nothing
    if (this.phase === GamePhase.SCORING || this.phase === GamePhase.FINISHED) {
      log('Game already over, returning');
      return;
    }
    
    const nextCard = this.drawStatusCard();
    
    // Check if game should end AFTER drawing (4th trigger ends game immediately)
    if (this.isGameEnd()) {
      log('Game end detected after drawing card');
      this.phase = GamePhase.SCORING;
      return;
    }

    this.currentAuction = this.createAuction(nextCard);

    const auctionType = isDisgraceCard(nextCard)
      ? GamePhase.DISGRACE_AUCTION
      : GamePhase.AUCTION;
    this.phase = auctionType;
    
    log('startNewRound() success', {
      newPhase: this.phase,
      hasAuction: !!this.currentAuction
    });
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

    log('Drew status card', {
      card: card.name,
      isGameEnd: this.isGameEnd(),
      deckRemaining: this.statusDeck.length
    });

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

    log('completeAuction() before', {
      hasAuction: !!this.currentAuction,
      currentPlayerIndex: this.currentPlayerIndex,
      phase: this.phase,
      winnerId: this.currentAuction.getWinner()?.id
    });

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

      // Check if winner has pending luxury discard and just won a luxury card
      // This handles the case where a player previously got Faux Pas with no luxury cards
      // and now wins a luxury card - they must discard it immediately
      if (winner.getPendingLuxuryDiscard() && card instanceof LuxuryCard) {
        // Player already has pending discard flag set (from earlier Faux Pas)
        // The flag remains true so they can discard the card they just won
      }

      // Winner becomes the starting player
      this.currentPlayerIndex = this.players.findIndex(p => p.id === winner.id);
    }

    this.currentAuction = null;

    log('completeAuction() after', {
      hasAuction: !!this.currentAuction,
      currentPlayerIndex: this.currentPlayerIndex,
      isGameEnd: this.isGameEnd()
    });

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
      currentPlayerIndex: this.currentPlayerIndex,
      turnTimerSeconds: this.turnTimerSeconds
    };
  }

  getTurnTimerSeconds(): number {
    return this.turnTimerSeconds;
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
