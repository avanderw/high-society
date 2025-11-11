# Reactivity Bug Fix - Bid State Not Clearing Between Rounds

## Problem Description

In multiplayer games, clients were experiencing stale bid state between rounds:

### Symptoms
- Player A is host
- A bids 1000, B bids 4000, C passes
- A bids 8000 (total 9000), B bids 8000 (total 12000)
- A passes, auction completes, B wins
- **Round 2 starts:**
  - B bids 10000
  - **BUG:** A sees highest bid as 8000 (should be 10000)
  - **BUG:** C sees highest bid as 8000 (should be 10000)  
  - **BUG:** B shows total bid as 14000 (should be 10000)

## Root Cause

The issue was in `src/lib/multiplayer/serialization.ts`, specifically the `deserializeGameState` function:

```typescript
// OLD CODE (BUGGY)
export function deserializeGameState(data: SerializedGameState, originalGameState?: GameState): GameState {
  // If we have an original game state with the same ID, update it
  // Otherwise create a new one
  const gameState = originalGameState && originalGameState.gameId === data.gameId
    ? originalGameState  // <-- REUSES THE SAME OBJECT!
    : new GameState(data.gameId);
  
  // Restore players
  const players = data.players.map(deserializePlayer);
  (gameState as any).players = players;  // <-- Mutates internal array
  // ...
}
```

### Why This Broke Reactivity

1. **GameState object was reused**: When deserializing, the same GameState object reference was kept
2. **Svelte couldn't detect changes**: In Svelte 5, reactivity is based on reassignment. When you do:
   ```javascript
   gameState = newState;
   ```
   If `newState` is the SAME object as `gameState`, Svelte doesn't detect a change!

3. **Components held stale references**: Even though the internal `players` array was replaced, components that held references to the old Player objects continued to use them.

### The Flow of the Bug

```
HOST:
1. Completes auction → clears Player.playedMoney ✓
2. Serializes state → empty playedMoney arrays ✓
3. Broadcasts to clients ✓

CLIENT:
1. Receives AUCTION_COMPLETE event ✓
2. Calls deserializeGameState(newState, oldGameState)
   → Returns SAME gameState object (just mutated internally) ✗
3. Assigns: gameState = newState
   → Svelte sees: gameState === gameState (no change!) ✗
4. Components still reference old Player objects ✗
5. UI shows stale bid amounts ✗
```

## The Fix

Changed `deserializeGameState` to ALWAYS create a new GameState object:

```typescript
// NEW CODE (FIXED)
export function deserializeGameState(data: SerializedGameState, originalGameState?: GameState): GameState {
  // Always create a new GameState to ensure Svelte reactivity triggers
  // Reusing the original game state prevents reactivity updates
  const gameState = new GameState(data.gameId);
  
  // Restore players
  const players = data.players.map(deserializePlayer);
  (gameState as any).players = players;
  // ...
}
```

### Why This Works

1. **New object created**: Every deserialization creates a fresh GameState object
2. **Svelte detects change**: `gameState = newState` now assigns a DIFFERENT object reference
3. **Derived values re-evaluate**: All `$derived` values that depend on `gameState` are recalculated:
   ```javascript
   const localPlayer = $derived.by(() => {
     // This re-runs when gameState changes!
     return gameState.getPlayers()[myGameIndex];
   });
   ```
4. **Components get fresh props**: Player references are updated, UI shows correct values

## Test Coverage

Created comprehensive tests in `src/tests/`:

1. **`multiplayer-sync.test.ts`**:
   - ✅ Domain layer correctly clears bid state
   - ✅ Serialization correctly encodes empty bid arrays
   - ✅ Deserialization correctly restores cleared state

2. **`reactivity-fix.test.ts`**:
   - ✅ Deserialization creates NEW GameState objects
   - ✅ Player objects are different after deserialization
   - ✅ Ensures Svelte reactivity will trigger

## Verification

Run the tests:
```bash
npm test -- reactivity-fix.test.ts
```

Output confirms:
```
Deserialized game is new object: true
Player objects are different: true
```

## Impact

- **Before Fix**: Clients showed stale bid amounts between rounds
- **After Fix**: All clients correctly see cleared bid state when new rounds start
- **Performance**: Minimal - creating a new GameState object is fast
- **Memory**: Negligible - old GameState objects are garbage collected

## Related Files Modified

1. `src/lib/multiplayer/serialization.ts` - Fixed deserializeGameState()
2. `src/routes/+page.svelte` - Added debug logging
3. `src/tests/reactivity-fix.test.ts` - New test for the fix
4. `src/tests/multiplayer-sync.test.ts` - Extended with multi-round scenarios
