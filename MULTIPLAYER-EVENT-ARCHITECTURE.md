# Multiplayer Event Architecture

## Overview

The multiplayer system now has clear separation between **HOST** and **CLIENT** roles to prevent event loops and make the code easier to maintain.

## Roles

### HOST
- **Authoritative game state**: The host's game state is the source of truth
- **Broadcasts major state changes**: Game start, auction completion, round start
- **Processes own actions locally**: Like any other player
- **Ignores own broadcasts**: Prevents duplicate processing

### CLIENTS  
- **Sync state from host**: Receive and apply authoritative state updates
- **Broadcast own actions**: Bid, pass, discard events
- **Process other players' actions**: Update local state based on events
- **Wait for host for final state**: Don't complete auctions/rounds independently

## Event Flow

### 1. Game Start
```
HOST: Click "Start Game" 
  → startGameAsHost()
  → Initialize game locally
  → Broadcast GAME_STARTED with full game state
  → Ignore own GAME_STARTED event

CLIENTS: In lobby
  → Receive GAME_STARTED event
  → startGameAsClient() 
  → Deserialize and sync game state from host
  → Transition to game view
```

### 2. Player Action (Bid/Pass/Discard)
```
ANY PLAYER: Perform action
  → Update local game state
  → Broadcast event (BID_PLACED, PASS_AUCTION, LUXURY_DISCARDED)
  → Skip own event when received

OTHER PLAYERS: Receive action event
  → Check it's not from self (skip if it is)
  → Update local game state with action
  → If auction completes, wait for host broadcast
```

### 3. Auction Complete
```
HOST: Detects auction complete
  → completeAuction()
  → Process luxury discard if needed
  → Start new round or finish game
  → Broadcast AUCTION_COMPLETE with full game state
  → Ignore own AUCTION_COMPLETE event

CLIENTS: Receive AUCTION_COMPLETE
  → Deserialize game state from host
  → Sync to authoritative state
  → Handle luxury discard UI if needed
```

## Key Functions

### Host-Specific
- `startGameAsHost(playerNames)`: Initialize and broadcast game start
- Only host calls `completeAuction()` and broadcasts final state

### Client-Specific  
- `startGameAsClient(event)`: Receive and sync initial game state
- Clients wait for `AUCTION_COMPLETE` event instead of completing independently

### Shared
- `placeBid()`, `pass()`, `handleLuxuryDiscard()`: All players broadcast their actions
- All players process other players' actions from events

## Event Deduplication

Each event is tracked by `eventType_timestamp` to prevent duplicate processing:

```typescript
function shouldProcessEvent(eventType: string, eventTimestamp: number): boolean {
  const eventId = `${eventType}_${eventTimestamp}`;
  if (processedEvents.has(eventId)) {
    return false; // Skip duplicate
  }
  processedEvents.add(eventId);
  return true;
}
```

## Debugging

All event handlers now have clear logging:
- `HOST:` prefix for host-specific logic
- `CLIENT:` prefix for client-specific logic  
- `My Role - Is Host: true/false` to identify current role
- Event timestamps logged for deduplication tracking

## Common Patterns

### Event Handler Template
```typescript
multiplayerService.on(EventType, (event: GameEvent) => {
  console.log('=== EVENT_NAME RECEIVED ===');
  console.log('My Role - Is Host:', isHost);
  
  // Deduplication
  if (!shouldProcessEvent('EVENT_NAME', event.timestamp)) {
    return;
  }
  
  // Skip own events
  if (event.data.multiplayerPlayerId === myPlayerId) {
    console.log('Skipping own event');
    return;
  }
  
  // HOST-specific logic
  if (isHost) {
    console.log('HOST: ...');
    // Host ignores broadcasts or handles special cases
    return;
  }
  
  // CLIENT-specific logic
  console.log('CLIENT: ...');
  // Process event
});
```

## Preventing Infinite Loops

The infinite loop was caused by:
1. Host starts game → broadcasts `GAME_STARTED`
2. Clients receive event → call `onRoomReady()`
3. `onRoomReady()` checked `isHost` and called `startGame()` again
4. Loop repeats infinitely

**Fix**: 
- Clients now check `isHost` BEFORE calling `onRoomReady()` in `MultiplayerSetup`
- `onRoomReady()` (aka `handleMultiplayerRoomReady()`) only calls `startGameAsHost()` for the actual host
- Clients call it to transition to game view but don't start a new game
