# Testing High Society Multiplayer

This directory contains automated tests for the High Society card game, with a focus on multiplayer synchronization.

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
npm run test:run -- multiplayer-auction
```

## Test Structure

### `/tests/mocks/`
Mock implementations for testing without real servers:
- `mockMultiplayerService.ts`: Simulates multiplayer events without WebSocket connection

### `/tests/multiplayer-auction.test.ts`
Tests core auction logic with the exact scenario from gameplay:
- **A bids 1000**
- **B bids 2000**  
- **C passes**
- **A bids 2000 more (total 3000)**
- **B passes** → Auction should complete with A as winner

✅ **Status**: PASSING - Auction logic is correct

### `/tests/multiplayer-sync.test.ts`
Tests that all players see the same game state after processing same events.

⚠️ **Status**: Needs refinement - Games have different random decks

## Key Findings

### The Auction Logic is Correct ✅
When all players process the same sequence of actions in the same order, they all correctly identify:
- When the auction completes
- Who the winner is
- The final bid amount

### Event Skipping is Correct ✅
When a player performs an action (bid/pass):
1. They process it locally
2. They broadcast it to others
3. They receive their own broadcast back
4. They **correctly skip** processing it again (would be duplicate)

### What to Test Next

1. **Full Multiplayer Event Flow**
   - Create test with mock multiplayer service
   - Simulate Host broadcasts GAME_STARTED
   - Simulate players broadcast BID_PLACED / PASS_AUCTION
   - Verify Host broadcasts AUCTION_COMPLETE
   - Verify all clients sync to final state

2. **Event Deduplication**
   - Verify `shouldProcessEvent()` prevents duplicate processing
   - Test with rapid-fire events
   - Test with delayed/out-of-order events

3. **State Synchronization**
   - Test that `serializeGameState()` captures all necessary state
   - Test that `deserializeGameState()` correctly reconstructs state
   - Verify clients match host after `AUCTION_COMPLETE`

## Common Issues to Watch For

### Issue: "Client skips own pass event"
**Status**: NOT A BUG - This is correct behavior!
- Client processes pass locally
- Client broadcasts event
- Client receives own broadcast back  
- Client skips it (already processed)

### Issue: "Host sees auction complete, clients don't"
**Possible Causes**:
1. Host not broadcasting `AUCTION_COMPLETE` event
2. Clients not receiving `AUCTION_COMPLETE` event
3. Clients not processing `AUCTION_COMPLETE` correctly
4. Network delay between events

**How to Test**:
- Add logging in `completeAuction()` to verify broadcast
- Add logging in `AUCTION_COMPLETE` handler to verify receipt
- Check server logs for event transmission

## Test Coverage Goals

- [ ] Basic auction logic (3 players, various bid sequences)
- [ ] Multiplayer event broadcasting
- [ ] Event deduplication
- [ ] State serialization/deserialization  
- [ ] Host/Client role separation
- [ ] Auction completion synchronization
- [ ] Luxury card discard flow
- [ ] Multiple rounds
- [ ] Game end conditions
- [ ] Scoring calculations

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
