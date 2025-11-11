# Testing High Society

This directory contains comprehensive automated tests for the High Society card game, covering all game mechanics and multiplayer synchronization.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run specific test file
npm run test:run -- disgrace-cards
```

## Test Structure

### Core Game Mechanics Tests

#### `disgrace-cards.test.ts` ✅
Comprehensive tests for all three disgrace cards:
- **Faux Pas**: Luxury card discard mechanics (immediate or pending)
- **Passé**: -5 status penalty
- **Scandale**: Halve final status (÷2), game end trigger
- Disgrace auction mechanics (first to pass gets card, others lose money)
- Scoring order verification

#### `status-cards.test.ts` ✅
Tests for normal status cards:
- **Luxury Cards**: Values 1-10, status contribution
- **Prestige Cards**: ×2 multiplier, game end triggers
- Combined scenarios with multiple cards
- Card metadata and uniqueness
- Edge cases (empty cards, zero values)

#### `auction-completion.test.ts` ✅
Auction completion and state management:
- Regular auction completion (last bidder wins)
- No-bid auctions (everyone passes, last gets card free)
- Disgrace auction completion (first to pass gets card)
- State cleanup between rounds (bids cleared, cards retained)
- Money card discarding and returning
- 2-player and 5-player edge cases

#### `game-end-triggers.test.ts` ✅
Game end trigger mechanics:
- 4 game-end trigger cards: 3 Prestige + 1 Scandale
- Game ends when 4th trigger is revealed
- No auction on final trigger card
- Transition to SCORING phase
- Trigger card distribution and randomization

#### `scoring-and-endgame.test.ts` ✅
End game state and scoring:
- **Cast Out Mechanics**: Poorest player(s) excluded from winning
- **Scoring Order**: (luxury + passé) × prestige ÷ scandale
- **Tie-Breaker Rules**: Status > Money > Highest Luxury Card
- Complex scoring scenarios with all card types
- Edge cases (no status, all zero status, single player)

#### `full-game-playthrough.test.ts` ✅
Integration tests with complete game flows:
- Full 3-player game from start to finish
- Disgrace card handling in full game context
- Faux Pas luxury discard flow
- Money spending and remaining money tracking
- Winner determination
- 2-player and 5-player games
- Edge cases (similar spending, varied strategies)

### Multiplayer Tests

#### `multiplayer-auction.test.ts` ✅
Tests core auction logic with exact scenarios:
- Multi-player bidding sequences
- Auction completion detection
- Winner identification
- Simulated multiplayer perspectives

#### `multiplayer-sync.test.ts` ⚠️
Tests multiplayer event synchronization:
- State synchronization across clients
- Event deduplication (skip own broadcasts)
- Bid state clearing between rounds
- Serialization/deserialization

#### `reactivity-fix.test.ts` ✅
Tests Svelte reactivity fixes:
- New object creation on deserialization
- Proper state updates for UI reactivity

### `/tests/mocks/`
Mock implementations for testing:
- `mockMultiplayerService.ts`: Simulates multiplayer events without WebSocket

## Test Coverage

### ✅ Covered Game Rules

- [x] 16 status cards (10 luxury, 3 prestige, 3 disgrace)
- [x] Money card management and bidding mechanics
- [x] Regular vs disgrace auction differences
- [x] Game end triggers (4 dark green cards)
- [x] Cast out mechanics for poorest players
- [x] Status calculation order: (luxury + passé) × prestige ÷ scandale
- [x] Tie-breaking rules (status > money > highest luxury)
- [x] Faux Pas luxury discard (immediate or pending)
- [x] Passé -5 status penalty
- [x] Scandale status halving
- [x] Turn order and auction flow
- [x] Player count validation (2-5 players)
- [x] Money card discarding and returning
- [x] State cleanup between rounds
- [x] Multiple rounds and full game flow

### Test Statistics

- **Total Test Files**: 9
- **Core Game Mechanics**: 6 comprehensive test suites
- **Multiplayer Tests**: 3 test suites
- **Coverage**: All major game rules and edge cases

## Common Patterns

### Testing Game Flow
```typescript
const gameState = new GameState('test-game');
gameState.initializeGame(['Alice', 'Bob', 'Charlie']);
gameState.startNewRound();

const auction = gameState.getCurrentAuction()!;
const player = gameState.getPlayers()[0];

// Execute actions
auction.processBid(player, [moneyCard]);
auction.processPass(otherPlayer);

// Complete round
gameState.completeAuction();
```

### Testing Scoring
```typescript
const calculator = new StatusCalculator();
const cards = [luxury, prestige, disgrace];
const finalStatus = calculator.calculate(cards);

const scoringService = new GameScoringService();
const rankings = scoringService.calculateFinalRankings(players);
```

## Key Findings

### Auction Logic ✅
When all players process the same sequence of actions in the same order, they all correctly identify:
- When the auction completes
- Who the winner is
- The final bid amount

### Scoring Calculation ✅
The scoring order is correctly implemented:
1. Sum luxury cards and subtract Passé penalties
2. Multiply by prestige cards (2^n)
3. Halve if Scandale present
4. Floor to 0 if negative

### State Management ✅
- Bids properly cleared between rounds
- Status cards retained across rounds
- Money cards discarded or returned correctly
- Game end triggers tracked accurately

## Writing New Tests

### Template for Game Flow Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '$lib/domain/gameState';

describe('My Test Suite', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState('test-game');
    gameState.initializeGame(['Player1', 'Player2', 'Player3']);
    gameState.startNewRound();
  });

  it('should do something', () => {
    // Arrange
    const player = gameState.getPlayers()[0];
    const auction = gameState.getCurrentAuction()!;

    // Act
    const result = auction.processBid(player, [...]);

    // Assert
    expect(result).toBe(AuctionResult.CONTINUE);
  });
});
```

### Template for Multiplayer Test

```typescript
import { createMockMultiplayerSetup } from './mocks/mockMultiplayerService';

it('should sync multiplayer state', () => {
  const { services, simulateBroadcast } = createMockMultiplayerSetup(3);
  
  // Setup event handlers on each service
  services.forEach(service => {
    service.on(GameEventType.BID_PLACED, (event) => {
      // Handle event
    });
  });

  // Simulate a broadcast
  simulateBroadcast(services[0], GameEventType.BID_PLACED, {
    playerId: 'player-0',
    amount: 1000
  });

  // Verify all services received it
  // ...
});
```

## Continuous Integration

(TODO: Add CI configuration for GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:run
```
