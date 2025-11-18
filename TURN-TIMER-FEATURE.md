# Turn Timer Feature

## Overview

A configurable turn timer has been added to automatically pass idle or unresponsive players during their turn. This prevents games from stalling when a player is not actively participating.

## Features

### Configuration
- **Default Timer**: 30 seconds per turn
- **Configurable Range**: 15-120 seconds (adjustable in 5-second increments)
- **Configuration Location**: Game setup lobby (host only)

### Behavior
- Timer starts when a player's turn begins
- Timer counts down from the configured duration
- When timer reaches 0, the player automatically passes
- Timer is reset when turn changes to next player
- Timer only runs during active auction phases (not during setup, scoring, or game end)

### Visual Feedback
- Timer displays next to the current player's name in the player status panel
- Shows remaining seconds with a clock icon
- Color-coded feedback:
  - **Green**: >50% time remaining
  - **Orange**: 25-50% time remaining  
  - **Red**: <25% time remaining
- Pulsing animation to draw attention

### Multiplayer Synchronization
- Timeout events are broadcast to all players
- All clients process the auto-pass consistently
- Timer state is included in game serialization for reconnection scenarios

## Implementation Details

### Files Modified

1. **MultiplayerSetup.svelte**
   - Added turn timer slider configuration (15-120s range)
   - Updated props to pass timer configuration to game

2. **GameState.ts** (Domain Layer)
   - Added `turnTimerSeconds` property
   - Included in `GamePublicState` interface
   - Added `getTurnTimerSeconds()` getter method

3. **serialization.ts** (Multiplayer Layer)
   - Added `turnTimerSeconds` to `SerializedGameState` interface
   - Included in serialization/deserialization functions

4. **events.ts** (Multiplayer Layer)
   - Added `TURN_TIMEOUT` event type
   - Added `TurnTimeoutEvent` interface
   - Updated `isActionEvent` type guard

5. **+page.svelte** (Main Game View)
   - Added turn timer state variables
   - Implemented `$effect` to manage countdown
   - Added `handleTurnTimeout()` to auto-pass on timeout
   - Added listener for `TURN_TIMEOUT` events
   - Passed timer props to `AuctionPanel` component

6. **AuctionPanel.svelte** (UI Component)
   - Added timer display with clock icon
   - Color-coded timer based on time remaining
   - Pulsing animation for visibility

7. **StatusDisplay.svelte** (UI Component)
   - Added timer props (prepared for future use)
   - Timer display implementation

## Testing

### Manual Testing Steps

1. **Start Development Server**
   ```powershell
   # Terminal 1: Start relay server
   node relay-server.js
   
   # Terminal 2: Start dev server
   npm run dev
   ```

2. **Create a Game**
   - Open browser to `http://localhost:5173`
   - Create a room
   - Adjust turn timer slider (try 15s for quick testing)
   - Share room code

3. **Join with Second Player**
   - Open second browser window (or incognito)
   - Join room with the code
   - Host starts the game

4. **Test Timer Behavior**
   - Wait for current player's turn
   - Observe timer countdown in player status panel
   - Watch color change as time decreases
   - Let timer reach 0 without taking action
   - Verify player automatically passes
   - Verify turn moves to next player
   - Check that timer resets for new turn

5. **Test Multiplayer Sync**
   - Verify both players see the same timer countdown
   - Verify both players see the auto-pass happen simultaneously
   - Test with 3+ players to ensure timer works for all

### Automated Tests

All existing tests pass with the new feature:
```powershell
npm test
```

**Test Results**: 111 tests passed across 11 test files

## Usage Guide

### For Game Hosts

1. When creating a room, you'll see a "Turn Timer" slider in the game settings
2. Adjust the slider to set how long each player has per turn (15-120 seconds)
3. Default is 30 seconds - adjust based on your group's preferences:
   - **Quick games**: 15-20 seconds
   - **Standard**: 30-45 seconds
   - **Relaxed**: 60-90 seconds
   - **Very relaxed**: 90-120 seconds
4. Start the game - all players will use this timer setting

### For All Players

- The timer appears next to the current player's name in the player status section
- You'll see a clock icon with the remaining seconds
- Color changes warn you when time is running low
- If you run out of time, you'll automatically pass your turn
- Plan your bids quickly to avoid timing out!

## Technical Architecture

### Clean Architecture Compliance

✅ **Domain Layer**: Pure TypeScript with no UI dependencies
- `GameState` stores timer configuration
- No timer logic in domain (stays in UI layer)

✅ **UI Layer**: Svelte 5 runes only
- Timer state managed with `$state`
- Countdown effect using `$effect`
- Derived values using `$derived`

✅ **Multiplayer Layer**: Event-driven synchronization
- Client-authoritative (each client manages own timer)
- Timeout events broadcast to maintain consistency
- Deterministic auto-pass behavior

### Event Flow

```
Turn Changes
    ↓
$effect detects currentPlayerIndex change
    ↓
Timer resets to turnTimerSeconds
    ↓
setInterval counts down every second
    ↓
When timer reaches 0:
    ↓
handleTurnTimeout() called
    ↓
Broadcast TURN_TIMEOUT event
    ↓
Call handlePass() locally
    ↓
Other clients receive TURN_TIMEOUT
    ↓
Process as pass on their local state
    ↓
All clients in sync
```

## Known Limitations

1. **Client-side timer**: Timer runs on each client independently. Network lag may cause slight differences in exact timing between players.

2. **No pause mechanism**: Timer cannot be paused once a turn begins.

3. **No extension**: Players cannot request more time for complex decisions.

4. **Host-only configuration**: Only the host can configure the timer at game creation. Cannot be changed mid-game.

## Future Enhancements

Potential improvements for future versions:

- [ ] Add pause button for emergencies
- [ ] Allow mid-game timer adjustment (host only)
- [ ] Add per-player time bank (chess-style)
- [ ] Sound/notification when time is running low
- [ ] Statistics on average decision time
- [ ] Different timers for different phases (e.g., longer for luxury cards)

## Troubleshooting

**Timer not appearing**: Ensure you're in an active auction phase (not setup/scoring/finished)

**Timer not syncing**: Check that all players are connected (green wifi icon)

**Auto-pass not working**: Verify the TURN_TIMEOUT event listener is registered in setupMultiplayerListeners

**Tests failing**: Run `npm test` - all 111 tests should pass

### Fixed Issues

**v1.0.1** - Fixed `handlePass is not defined` error
- Changed `handleTurnTimeout()` to call `pass()` instead of non-existent `handlePass()`
- Timer now correctly auto-passes when countdown reaches 0

**v1.0.2** - Fixed "Player is not active in this auction" error
- Added check to verify player is still active before processing timeout
- Prevents duplicate pass attempts when player has already passed
- Both `handleTurnTimeout()` and the `TURN_TIMEOUT` event listener now check `auction.getActivePlayers()` before attempting to pass
- Eliminates console errors when timeout event fires after player has already acted

**v1.0.3** - Extended active player checks to all event handlers
- Added `auction.getActivePlayers().has(player.id)` check to `BID_PLACED` event handler
- Added `auction.getActivePlayers().has(player.id)` check to `PASS_AUCTION` event handler
- Prevents race conditions where events arrive out of order or after player has already acted
- Eliminates all "Player is not active in this auction" errors across all multiplayer events

## Related Documentation

- [AI-CONTEXT.md](./AI-CONTEXT.md) - Development context and patterns
- [MULTIPLAYER-ARCHITECTURE.md](./MULTIPLAYER-ARCHITECTURE.md) - Multiplayer design
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and fixes
