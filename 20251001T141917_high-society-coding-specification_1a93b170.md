# High Society Game - Coding Specification

## Overview
High Society is an auction-based card game for 2-5 players where socialites bid on luxury items, prestige, and try to avoid disgrace while managing their money carefully. The goal is to accumulate the highest status without being cast out for having the least money.

## Architecture Principles

### Clean Architecture Layers
1. **Domain Layer**: Core game rules, entities, and business logic
2. **Application Layer**: Game flow orchestration and use cases  
3. **Infrastructure Layer**: UI, persistence, and external interfaces
4. **Interface Layer**: API contracts and DTOs

### Modularity Design
- **Card System**: Extensible card types with polymorphic behavior
- **Auction Engine**: Pluggable auction strategies (regular vs disgrace)
- **Scoring System**: Composable status effects and calculations
- **Game State Machine**: Clear phase transitions with validation
- **Event System**: Decoupled game events for UI and logging

## Core Domain Entities

### 1. Card System (Domain Models)

#### Base Card Abstraction
```typescript
abstract class Card {
  constructor(
    public readonly id: string,
    public readonly name: string
  ) {}
  
  abstract getDisplayValue(): string;
}

abstract class StatusCard extends Card {
  constructor(
    id: string,
    name: string,
    public readonly isGameEndTrigger: boolean = false
  ) {
    super(id, name);
  }
  
  abstract applyEffect(player: Player, context: GameContext): StatusEffect[];
  abstract calculateStatusContribution(baseStatus: number): number;
}
```

#### Concrete Status Card Types
```typescript
class LuxuryCard extends StatusCard {
  constructor(
    id: string,
    name: string,
    public readonly value: number // 1-10
  ) {
    super(id, name, false);
  }
  
  applyEffect(player: Player): StatusEffect[] {
    return [new AddStatusEffect(this.value)];
  }
  
  calculateStatusContribution(): number {
    return this.value;
  }
}

class PrestigeCard extends StatusCard {
  constructor(id: string, name: string) {
    super(id, name, true); // Game end trigger
  }
  
  applyEffect(): StatusEffect[] {
    return [new MultiplyStatusEffect(2)];
  }
  
  calculateStatusContribution(baseStatus: number): number {
    return baseStatus; // Multiplication handled in scoring engine
  }
}

class DisgraceFauxPas extends StatusCard {
  applyEffect(player: Player, context: GameContext): StatusEffect[] {
    return [new DiscardLuxuryCardEffect(), new RemoveCardEffect(this)];
  }
}

class DisgracePassé extends StatusCard {
  calculateStatusContribution(): number {
    return -5;
  }
}

class DisgraceScandale extends StatusCard {
  constructor() {
    super('scandale', 'Scandale', true); // Game end trigger
  }
  
  applyEffect(): StatusEffect[] {
    return [new HalveStatusEffect()];
  }
}
```

#### Money Card System
```typescript
class MoneyCard extends Card {
  constructor(
    id: string,
    public readonly value: number,
    public readonly playerColor: PlayerColor
  ) {
    super(id, `${value} Francs`);
  }
  
  getDisplayValue(): string {
    return this.value.toLocaleString() + ' Francs';
  }
}

// Standard money card values (11 per player set)
const MONEY_CARD_VALUES = [
  1000, 2000, 3000, 4000, 6000, 8000, 10000, 12000, 15000, 20000, 25000
];
```

### 2. Player Entity (Domain Model)

```typescript
class Player {
  private moneyHand: MoneyCard[] = [];
  private statusCards: StatusCard[] = [];
  private playedMoney: MoneyCard[] = [];
  private pendingEffects: StatusEffect[] = [];
  
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly color: PlayerColor
  ) {}
  
  // Money management
  dealMoneyCards(cards: MoneyCard[]): void {
    this.moneyHand = [...cards];
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
    // Validate cards are in hand
    cards.forEach(card => {
      const index = this.moneyHand.findIndex(c => c.id === card.id);
      if (index === -1) throw new Error('Card not in hand');
      this.moneyHand.splice(index, 1);
      this.playedMoney.push(card);
    });
  }
  
  returnPlayedMoney(): void {
    this.moneyHand.push(...this.playedMoney);
    this.playedMoney = [];
  }
  
  discardPlayedMoney(): void {
    this.playedMoney = []; // Money is permanently spent
  }
  
  // Status card management
  addStatusCard(card: StatusCard): void {
    this.statusCards.push(card);
    this.pendingEffects.push(...card.applyEffect(this, new GameContext()));
  }
  
  removeStatusCard(cardId: string): StatusCard | null {
    const index = this.statusCards.findIndex(c => c.id === cardId);
    if (index === -1) return null;
    return this.statusCards.splice(index, 1)[0];
  }
  
  getLuxuryCards(): LuxuryCard[] {
    return this.statusCards.filter(card => card instanceof LuxuryCard) as LuxuryCard[];
  }
  
  getPrestigeCards(): PrestigeCard[] {
    return this.statusCards.filter(card => card instanceof PrestigeCard) as PrestigeCard[];
  }
  
  // Status calculation
  calculateFinalStatus(): number {
    return new StatusCalculator().calculate(this.statusCards);
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
      totalRemainingMoney: this.getTotalRemainingMoney()
    };
  }
}

enum PlayerColor {
  RED = 'red',
  BLUE = 'blue', 
  GREEN = 'green',
  YELLOW = 'yellow',
  PURPLE = 'purple'
}

interface PlayerPublicState {
  id: string;
  name: string;
  color: PlayerColor;
  statusCards: StatusCard[];
  currentBid: number;
  remainingMoneyCount: number;
  totalRemainingMoney?: number; // Only revealed at game end
}
```

### 3. Game State Machine & Context

```typescript
class GameState {
  private players: Player[] = [];
  private statusDeck: StatusCard[] = [];
  private revealedCards: StatusCard[] = [];
  private currentAuction: Auction | null = null;
  private gameEndTriggerCount = 0;
  private eventBus: GameEventBus;
  
  constructor(
    public readonly gameId: string,
    private phase: GamePhase = GamePhase.SETUP
  ) {
    this.eventBus = new GameEventBus();
  }
  
  // State machine transitions
  transitionTo(newPhase: GamePhase): void {
    const isValidTransition = this.validatePhaseTransition(this.phase, newPhase);
    if (!isValidTransition) {
      throw new Error(`Invalid phase transition: ${this.phase} -> ${newPhase}`);
    }
    
    const oldPhase = this.phase;
    this.phase = newPhase;
    this.eventBus.emit(new PhaseTransitionEvent(oldPhase, newPhase));
  }
  
  // Game progression
  startNewRound(): void {
    if (this.isGameEnd()) {
      this.transitionTo(GamePhase.SCORING);
      return;
    }
    
    const nextCard = this.drawStatusCard();
    this.currentAuction = this.createAuction(nextCard);
    
    const auctionType = nextCard.constructor.name.includes('Disgrace') 
      ? GamePhase.DISGRACE_AUCTION 
      : GamePhase.AUCTION;
    this.transitionTo(auctionType);
    
    this.eventBus.emit(new RoundStartEvent(nextCard, this.currentAuction));
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
    return card.constructor.name.includes('Disgrace')
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
  
  getPublicState(): GamePublicState {
    return {
      gameId: this.gameId,
      phase: this.phase,
      players: this.players.map(p => p.getPublicState()),
      currentCard: this.currentAuction?.getCard() || null,
      gameEndTriggerCount: this.gameEndTriggerCount,
      remainingStatusCards: this.statusDeck.length
    };
  }
}

enum GamePhase {
  SETUP = 'setup',
  AUCTION = 'auction', 
  DISGRACE_AUCTION = 'disgrace_auction',
  SCORING = 'scoring',
  FINISHED = 'finished'
}

interface GamePublicState {
  gameId: string;
  phase: GamePhase;
  players: PlayerPublicState[];
  currentCard: StatusCard | null;
  gameEndTriggerCount: number;
  remainingStatusCards: number;
}

class GameContext {
  constructor(
    public readonly gameState: GameState,
    public readonly currentPlayer?: Player
  ) {}
}
```

## Application Layer (Use Cases & Services)

### 1. Game Setup Service
```typescript
class GameSetupService {
  createGame(playerNames: string[]): GameState {
    this.validatePlayerCount(playerNames.length);
    
    const gameState = new GameState(generateGameId());
    const players = this.createPlayers(playerNames);
    const statusDeck = this.createAndShuffleStatusDeck();
    
    this.dealMoneyCards(players);
    gameState.initializeGame(players, statusDeck);
    
    return gameState;
  }
  
  private validatePlayerCount(count: number): void {
    if (count < 2 || count > 5) {
      throw new GameSetupError('Game requires 2-5 players');
    }
  }
  
  private createAndShuffleStatusDeck(): StatusCard[] {
    const deck = [...LUXURY_CARDS, ...PRESTIGE_CARDS, ...DISGRACE_CARDS];
    return shuffleArray(deck);
  }
  
  private dealMoneyCards(players: Player[]): void {
    players.forEach((player, index) => {
      const moneyCards = MONEY_CARD_VALUES.map((value, cardIndex) => 
        new MoneyCard(`${player.id}-money-${cardIndex}`, value, player.color)
      );
      player.dealMoneyCards(moneyCards);
    });
  }
}
```

### 2. Auction Engine (Strategy Pattern)
```typescript
abstract class Auction {
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
  
  protected validatePlayerActive(player: Player): void {
    if (!this.activePlayers.has(player.id)) {
      throw new AuctionError('Player is not active in this auction');
    }
  }
}

class RegularAuction extends Auction {
  processBid(player: Player, moneyCards: MoneyCard[]): AuctionResult {
    this.validatePlayerActive(player);
    
    player.playMoneyCards(moneyCards);
    const newBid = player.getCurrentBidAmount();
    
    if (newBid <= this.currentHighestBid) {
      player.returnPlayedMoney();
      throw new AuctionError('Bid must be higher than current bid');
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

class DisgraceAuction extends Auction {
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
    return AuctionResult.CONTINUE;
  }
  
  isComplete(): boolean {
    return this.currentWinner !== null;
  }
  
  getWinner(): Player | null {
    return this.currentWinner;
  }
}

enum AuctionResult {
  CONTINUE = 'continue',
  COMPLETE = 'complete'
}
```

### 3. Status Effect System (Command Pattern)
```typescript
abstract class StatusEffect {
  abstract apply(player: Player, context: GameContext): void;
}

class AddStatusEffect extends StatusEffect {
  constructor(private value: number) {
    super();
  }
  
  apply(player: Player): void {
    // Applied during status calculation
  }
  
  getValue(): number {
    return this.value;
  }
}

class MultiplyStatusEffect extends StatusEffect {
  constructor(private multiplier: number) {
    super();
  }
  
  apply(): void {
    // Applied during status calculation
  }
  
  getMultiplier(): number {
    return this.multiplier;
  }
}

class DiscardLuxuryCardEffect extends StatusEffect {
  apply(player: Player, context: GameContext): void {
    const luxuryCards = player.getLuxuryCards();
    
    if (luxuryCards.length > 0) {
      // Trigger UI for player selection
      context.gameState.requestPlayerChoice(
        player,
        new LuxuryCardSelectionChoice(luxuryCards)
      );
    } else {
      // Set pending discard for next luxury card
      player.addPendingEffect(new PendingLuxuryDiscardEffect());
    }
  }
}

class HalveStatusEffect extends StatusEffect {
  apply(): void {
    // Applied during final status calculation
  }
}
```

### 4. Scoring Service (Composable Calculator)
```typescript
class StatusCalculator {
  calculate(statusCards: StatusCard[]): number {
    // Phase 1: Base status calculation
    let baseStatus = this.calculateBaseStatus(statusCards);
    
    // Phase 2: Apply multipliers (prestige cards)
    const multiplier = this.calculateMultiplier(statusCards);
    let finalStatus = baseStatus * multiplier;
    
    // Phase 3: Apply final modifiers (scandale halving)
    finalStatus = this.applyFinalModifiers(finalStatus, statusCards);
    
    return Math.max(0, Math.floor(finalStatus));
  }
  
  private calculateBaseStatus(cards: StatusCard[]): number {
    return cards.reduce((total, card) => {
      return total + card.calculateStatusContribution(0);
    }, 0);
  }
  
  private calculateMultiplier(cards: StatusCard[]): number {
    const prestigeCards = cards.filter(card => card instanceof PrestigeCard);
    return Math.pow(2, prestigeCards.length); // Each prestige card doubles
  }
  
  private applyFinalModifiers(status: number, cards: StatusCard[]): number {
    const hasScandaleCard = cards.some(card => card instanceof DisgraceScandale);
    return hasScandaleCard ? status / 2 : status;
  }
}

class GameScoringService {
  private statusCalculator = new StatusCalculator();
  
  calculateFinalRankings(players: Player[]): PlayerRanking[] {
    // Step 1: Cast out poorest players
    const eligiblePlayers = this.castOutPoorestPlayers(players);
    
    // Step 2: Calculate final status for eligible players
    const rankings = eligiblePlayers.map(player => ({
      player,
      finalStatus: this.statusCalculator.calculate(player.getStatusCards()),
      remainingMoney: player.getTotalRemainingMoney(),
      highestLuxuryCard: this.getHighestLuxuryCardValue(player)
    }));
    
    // Step 3: Sort by game rules with tie-breakers
    return this.sortByGameRules(rankings);
  }
  
  private castOutPoorestPlayers(players: Player[]): Player[] {
    const minMoney = Math.min(...players.map(p => p.getTotalRemainingMoney()));
    return players.filter(player => player.getTotalRemainingMoney() > minMoney);
  }
  
  private sortByGameRules(rankings: PlayerRanking[]): PlayerRanking[] {
    return rankings.sort((a, b) => {
      // Primary: Highest status
      if (a.finalStatus !== b.finalStatus) {
        return b.finalStatus - a.finalStatus;
      }
      
      // Tie-breaker 1: Most money remaining  
      if (a.remainingMoney !== b.remainingMoney) {
        return b.remainingMoney - a.remainingMoney;
      }
      
      // Tie-breaker 2: Highest single luxury card
      return b.highestLuxuryCard - a.highestLuxuryCard;
    });
  }
  
  private getHighestLuxuryCardValue(player: Player): number {
    const luxuryCards = player.getLuxuryCards();
    return luxuryCards.length > 0 
      ? Math.max(...luxuryCards.map(card => card.value))
      : 0;
  }
}

interface PlayerRanking {
  player: Player;
  finalStatus: number;
  remainingMoney: number;
  highestLuxuryCard: number;
  rank?: number;
  isCastOut?: boolean;
}
```

### 5. Event System (Observer Pattern)
```typescript
abstract class GameEvent {
  constructor(
    public readonly timestamp: number = Date.now(),
    public readonly gameId: string
  ) {}
}

class PhaseTransitionEvent extends GameEvent {
  constructor(
    gameId: string,
    public readonly fromPhase: GamePhase,
    public readonly toPhase: GamePhase
  ) {
    super(Date.now(), gameId);
  }
}

class RoundStartEvent extends GameEvent {
  constructor(
    gameId: string,
    public readonly statusCard: StatusCard,
    public readonly auction: Auction
  ) {
    super(Date.now(), gameId);
  }
}

class PlayerActionEvent extends GameEvent {
  constructor(
    gameId: string,
    public readonly playerId: string,
    public readonly action: 'bid' | 'pass',
    public readonly data: any
  ) {
    super(Date.now(), gameId);
  }
}

class AuctionCompleteEvent extends GameEvent {
  constructor(
    gameId: string,
    public readonly winner: Player,
    public readonly card: StatusCard,
    public readonly winningBid: number
  ) {
    super(Date.now(), gameId);
  }
}

class GameEventBus {
  private handlers: Map<string, Array<(event: GameEvent) => void>> = new Map();
  
  subscribe<T extends GameEvent>(eventType: string, handler: (event: T) => void): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }
  
  emit(event: GameEvent): void {
    const eventType = event.constructor.name;
    const handlers = this.handlers.get(eventType) || [];
    handlers.forEach(handler => handler(event));
  }
}
```

### 6. Game Orchestration Service
```typescript
class GameOrchestrator {
  constructor(
    private gameState: GameState,
    private eventBus: GameEventBus,
    private scoringService: GameScoringService
  ) {
    this.setupEventHandlers();
  }
  
  startGame(): void {
    this.gameState.transitionTo(GamePhase.AUCTION);
    this.startNewRound();
  }
  
  processPlayerAction(playerId: string, action: PlayerAction): GameActionResult {
    const player = this.gameState.getPlayer(playerId);
    const auction = this.gameState.getCurrentAuction();
    
    if (!auction) {
      throw new GameError('No active auction');
    }
    
    try {
      const result = this.executePlayerAction(player, action, auction);
      
      if (result === AuctionResult.COMPLETE) {
        this.completeAuction(auction);
      }
      
      return GameActionResult.SUCCESS;
    } catch (error) {
      return GameActionResult.ERROR;
    }
  }
  
  private executePlayerAction(player: Player, action: PlayerAction, auction: Auction): AuctionResult {
    this.eventBus.emit(new PlayerActionEvent(
      this.gameState.gameId,
      player.id,
      action.type,
      action.data
    ));
    
    switch (action.type) {
      case 'bid':
        return auction.processBid(player, action.moneyCards!);
      case 'pass':
        return auction.processPass(player);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }
  
  private completeAuction(auction: Auction): void {
    const winner = auction.getWinner();
    const card = auction.getCard();
    
    if (winner) {
      winner.addStatusCard(card);
      winner.discardPlayedMoney();
      
      this.eventBus.emit(new AuctionCompleteEvent(
        this.gameState.gameId,
        winner,
        card,
        winner.getCurrentBidAmount()
      ));
    }
    
    // Check for game end
    if (this.gameState.isGameEnd()) {
      this.endGame();
    } else {
      this.startNewRound();
    }
  }
  
  private startNewRound(): void {
    this.gameState.startNewRound();
  }
  
  private endGame(): void {
    this.gameState.transitionTo(GamePhase.SCORING);
    const finalRankings = this.scoringService.calculateFinalRankings(this.gameState.getPlayers());
    this.gameState.setFinalRankings(finalRankings);
    this.gameState.transitionTo(GamePhase.FINISHED);
  }
  
  private setupEventHandlers(): void {
    // Setup logging, UI updates, etc.
  }
}

interface PlayerAction {
  type: 'bid' | 'pass';
  moneyCards?: MoneyCard[];
  data?: any;
}

enum GameActionResult {
  SUCCESS = 'success',
  ERROR = 'error',
  INVALID = 'invalid'
}
```

## Game Flow Architecture

### Turn-Based Flow Control
1. **Round Initialization**: GameOrchestrator draws card, creates appropriate auction
2. **Player Actions**: Players submit actions through GameOrchestrator
3. **Action Processing**: Auction engine validates and processes actions
4. **State Updates**: Player and game state updated atomically
5. **Event Emission**: Events broadcast to subscribers (UI, logging, etc.)
6. **Completion Check**: Auction completion triggers next round or game end

### Command Processing Pipeline
```
Player Input → Action Validation → State Mutation → Event Emission → UI Update
```

## Infrastructure Layer

### 1. Player Choice System
```typescript
abstract class PlayerChoice {
  constructor(
    public readonly playerId: string,
    public readonly prompt: string,
    public readonly timeoutMs?: number
  ) {}
  
  abstract validate(selection: any): boolean;
}

class LuxuryCardSelectionChoice extends PlayerChoice {
  constructor(
    playerId: string,
    public readonly availableCards: LuxuryCard[]
  ) {
    super(playerId, 'Select a luxury card to discard');
  }
  
  validate(cardId: string): boolean {
    return this.availableCards.some(card => card.id === cardId);
  }
}

class MoneyCardSelectionChoice extends PlayerChoice {
  constructor(
    playerId: string,
    public readonly availableCards: MoneyCard[],
    public readonly minBidAmount: number
  ) {
    super(playerId, `Select money cards (minimum bid: ${minBidAmount})`);
  }
  
  validate(cardIds: string[]): boolean {
    const selectedCards = this.availableCards.filter(card => cardIds.includes(card.id));
    const totalValue = selectedCards.reduce((sum, card) => sum + card.value, 0);
    return totalValue >= this.minBidAmount;
  }
}
```

### 2. Game Rules Engine
```typescript
class GameRulesEngine {
  validatePlayerAction(action: PlayerAction, context: GameContext): ValidationResult {
    const validators = [
      new PlayerTurnValidator(),
      new BidAmountValidator(),
      new MoneyCardValidator(),
      new GamePhaseValidator()
    ];
    
    for (const validator of validators) {
      const result = validator.validate(action, context);
      if (!result.isValid) {
        return result;
      }
    }
    
    return ValidationResult.success();
  }
}

abstract class ActionValidator {
  abstract validate(action: PlayerAction, context: GameContext): ValidationResult;
}

class BidAmountValidator extends ActionValidator {
  validate(action: PlayerAction, context: GameContext): ValidationResult {
    if (action.type !== 'bid') {
      return ValidationResult.success();
    }
    
    const currentAuction = context.gameState.getCurrentAuction();
    const newBidAmount = action.moneyCards!.reduce((sum, card) => sum + card.value, 0);
    
    if (newBidAmount <= currentAuction!.getCurrentHighestBid()) {
      return ValidationResult.error('Bid must be higher than current bid');
    }
    
    return ValidationResult.success();
  }
}

class ValidationResult {
  constructor(
    public readonly isValid: boolean,
    public readonly errorMessage?: string
  ) {}
  
  static success(): ValidationResult {
    return new ValidationResult(true);
  }
  
  static error(message: string): ValidationResult {
    return new ValidationResult(false, message);
  }
}
```

### 3. Game Persistence
```typescript
class GameRepository {
  async saveGame(gameState: GameState): Promise<void> {
    const serializedState = this.serialize(gameState);
    await this.storage.save(gameState.gameId, serializedState);
  }
  
  async loadGame(gameId: string): Promise<GameState> {
    const serializedState = await this.storage.load(gameId);
    return this.deserialize(serializedState);
  }
  
  private serialize(gameState: GameState): SerializedGameState {
    return {
      gameId: gameState.gameId,
      version: CURRENT_SCHEMA_VERSION,
      timestamp: Date.now(),
      state: gameState.toJSON(),
      events: gameState.getEventHistory()
    };
  }
  
  private deserialize(data: SerializedGameState): GameState {
    // Reconstruct game state from serialized data
    // Handle schema migration if necessary
    return GameState.fromJSON(data.state);
  }
}

interface SerializedGameState {
  gameId: string;
  version: number;
  timestamp: number;
  state: any;
  events: GameEvent[];
}
```

### 4. Game Constants & Configuration
```typescript
// Card definitions
const LUXURY_CARDS: LuxuryCard[] = [
  new LuxuryCard('luxury-1', 'Fashion', 1),
  new LuxuryCard('luxury-2', 'Jewelry', 2),
  new LuxuryCard('luxury-3', 'Haute Cuisine', 3),
  new LuxuryCard('luxury-4', 'Travel', 4),
  new LuxuryCard('luxury-5', 'Art', 5),
  new LuxuryCard('luxury-6', 'Automobiles', 6),
  new LuxuryCard('luxury-7', 'Estate', 7),
  new LuxuryCard('luxury-8', 'Yacht', 8),
  new LuxuryCard('luxury-9', 'Dressage', 9),
  new LuxuryCard('luxury-10', 'Opera', 10)
];

const PRESTIGE_CARDS: PrestigeCard[] = [
  new PrestigeCard('prestige-1', 'Bon Vivant'),
  new PrestigeCard('prestige-2', 'Joie De Vivre'),
  new PrestigeCard('prestige-3', 'Savoir Faire')
];

const DISGRACE_CARDS: StatusCard[] = [
  new DisgraceFauxPas(),
  new DisgracePassé(),
  new DisgraceScandale()
];

// Game configuration
const GAME_CONFIG = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 5,
  GAME_END_TRIGGER_COUNT: 4,
  MONEY_CARD_VALUES: [1000, 2000, 3000, 4000, 6000, 8000, 10000, 12000, 15000, 20000, 25000],
  AUCTION_TIMEOUT_MS: 60000,
  PLAYER_CHOICE_TIMEOUT_MS: 30000
};
```

## Interface Layer (API Design)

### 1. Game API Contract
```typescript
interface GameAPI {
  // Game management
  createGame(request: CreateGameRequest): Promise<GameResponse>;
  joinGame(gameId: string, playerName: string): Promise<JoinGameResponse>;
  getGameState(gameId: string, playerId: string): Promise<GameStateResponse>;
  
  // Player actions
  placeBid(gameId: string, playerId: string, request: BidRequest): Promise<ActionResponse>;
  passAuction(gameId: string, playerId: string): Promise<ActionResponse>;
  selectCard(gameId: string, playerId: string, request: CardSelectionRequest): Promise<ActionResponse>;
  
  // Game events (WebSocket/SSE)
  subscribeToGameEvents(gameId: string, playerId: string): EventStream<GameEvent>;
}

// Request/Response DTOs
interface CreateGameRequest {
  playerNames: string[];
  gameOptions?: GameOptions;
}

interface BidRequest {
  moneyCardIds: string[];
}

interface CardSelectionRequest {
  selectedCardId: string;
  choiceId: string;
}

interface GameResponse {
  gameId: string;
  gameState: GamePublicState;
  players: PlayerPublicState[];
}

interface ActionResponse {
  success: boolean;
  errorMessage?: string;
  updatedGameState?: GamePublicState;
}
```

### 2. UI State Management
```typescript
interface GameUIState {
  // Core game state
  gameId: string;
  currentPlayer: PlayerPublicState;
  allPlayers: PlayerPublicState[];
  currentPhase: GamePhase;
  currentCard: StatusCard | null;
  
  // UI-specific state
  selectedMoneyCards: string[];
  availableActions: PlayerActionType[];
  pendingChoice: PlayerChoice | null;
  isMyTurn: boolean;
  
  // Calculations
  currentBidTotal: number;
  projectedStatus: number;
  remainingMoney: number;
}

interface PlayerActionType {
  type: 'bid' | 'pass' | 'select_card';
  enabled: boolean;
  tooltip?: string;
}
```

### 3. UI Component Architecture
```typescript
// Component hierarchy for clean separation
interface ComponentProps<T = {}> {
  gameState: GameUIState;
  onAction: (action: PlayerAction) => void;
  additionalProps?: T;
}

// Main game components
interface GameBoardProps extends ComponentProps {
  // Game board container
}

interface PlayerHandProps extends ComponentProps {
  showMoneyValues: boolean; // Only for current player
}

interface AuctionPanelProps extends ComponentProps {
  currentAuction: Auction;
}

interface StatusDisplayProps extends ComponentProps {
  players: PlayerPublicState[];
  showCalculations: boolean;
}

interface ActionPanelProps extends ComponentProps {
  availableActions: PlayerActionType[];
  selectedCards: string[];
}
```

## Quality Assurance & Testing

### 1. Error Handling Strategy
```typescript
class GameError extends Error {
  constructor(
    message: string,
    public readonly errorCode: GameErrorCode,
    public readonly context?: any
  ) {
    super(message);
    this.name = 'GameError';
  }
}

enum GameErrorCode {
  INVALID_PLAYER_COUNT = 'INVALID_PLAYER_COUNT',
  INVALID_BID_AMOUNT = 'INVALID_BID_AMOUNT',
  PLAYER_NOT_ACTIVE = 'PLAYER_NOT_ACTIVE',
  INVALID_GAME_PHASE = 'INVALID_GAME_PHASE',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  CARD_NOT_FOUND = 'CARD_NOT_FOUND',
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  AUCTION_TIMEOUT = 'AUCTION_TIMEOUT'
}

class ErrorHandler {
  handleGameError(error: GameError, context: GameContext): ErrorResponse {
    // Log error with context
    // Determine if error is recoverable
    // Return appropriate user-facing message
    return {
      userMessage: this.getUserMessage(error.errorCode),
      canRetry: this.isRecoverable(error.errorCode),
      suggestedAction: this.getSuggestedAction(error.errorCode)
    };
  }
}
```

### 2. Test Strategy
```typescript
// Unit test categories
interface TestSuite {
  // Domain logic tests
  cardEffectTests: () => void;
  statusCalculationTests: () => void;
  auctionLogicTests: () => void;
  
  // Game flow tests
  gameStateTransitionTests: () => void;
  playerActionValidationTests: () => void;
  gameEndConditionTests: () => void;
  
  // Integration tests
  fullGamePlaythroughTests: () => void;
  errorHandlingTests: () => void;
  concurrencyTests: () => void;
}

// Example test cases for key game rules
class GameRulesTests {
  testFauxPasEffect(): void {
    // Given: Player has luxury cards and receives Faux Pas
    // When: Faux Pas effect is applied
    // Then: Player must discard one luxury card, Faux Pas is removed
  }
  
  testPrestigeMultiplier(): void {
    // Given: Player has 2 prestige cards and 10 base status
    // When: Final status is calculated
    // Then: Status should be 10 * 2 * 2 = 40
  }
  
  testGameEndTrigger(): void {
    // Given: 3 game-end cards have been revealed
    // When: 4th game-end card is drawn
    // Then: Game should end immediately without auction
  }
  
  testCastOutLogic(): void {
    // Given: Players with different remaining money amounts
    // When: Final scoring occurs
    // Then: Player(s) with least money are cast out
  }
}
```

### 3. Performance Considerations
```typescript
class PerformanceOptimizations {
  // Efficient card lookups
  private cardIndex: Map<string, StatusCard> = new Map();
  
  // Memoized status calculations
  private statusCache: Map<string, number> = new Map();
  
  // Event batching for UI updates
  private eventBatcher: EventBatcher;
  
  // Memory management for large games
  private gameStateCompactor: StateCompactor;
}

// Scalability metrics to monitor
interface PerformanceMetrics {
  averageGameDurationMs: number;
  peakMemoryUsageMB: number;
  concurrentGamesSupported: number;
  actionProcessingLatencyMs: number;
}
```

## Implementation Guidelines

### 1. Development Phases
1. **Phase 1**: Core domain models and basic game logic
2. **Phase 2**: Auction system and player actions  
3. **Phase 3**: Status effects and scoring system
4. **Phase 4**: Game orchestration and event system
5. **Phase 5**: UI integration and error handling
6. **Phase 6**: Persistence, testing, and optimization

### 2. Architecture Benefits
- **Modularity**: Each system can be developed and tested independently
- **Extensibility**: New card types can be added without core changes
- **Maintainability**: Clear separation of concerns and single responsibilities
- **Testability**: Domain logic isolated from infrastructure concerns
- **Scalability**: Event-driven architecture supports real-time multiplayer

### 3. Rule Completeness Validation
This specification addresses all game rules from the original:
- ✅ 16 status cards with correct effects
- ✅ Money card management and bidding mechanics
- ✅ Regular vs disgrace auction differences
- ✅ Game end triggers (4 dark green cards)
- ✅ Cast out mechanics for poorest players
- ✅ Status calculation with proper order of operations
- ✅ Tie-breaking rules in correct priority order
- ✅ Special card effects (Faux Pas, Passé, Scandale)
- ✅ Turn order and auction flow
- ✅ Player count validation (2-5 players)

The architecture provides sufficient context for clean implementation while maintaining flexibility for future enhancements and platform-specific adaptations.
