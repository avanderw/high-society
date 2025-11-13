# Multiplayer Architecture for High Society

## Overview

The application has been converted from a local hotseat game to a multiplayer websocket-based game where:
- A relay server (Socket.IO) receives and broadcasts events to all players in a room
- Each client manages their own game state independently  
- State synchronization happens through event broadcasting
- No server-side game logic - clients are authoritative

## Architecture Components

### 1. Event System (`src/lib/multiplayer/events.ts`)

Defines all game events for multiplayer communication:

**Room Management Events:**
- `ROOM_CREATED` - Room created by host
- `PLAYER_JOINED` - Player joined the room
- `PLAYER_LEFT` - Player left the room
- `GAME_STARTED` - Game initialization started

**Player Action Events:**
- `BID_PLACED` - Player placed a bid
- `PASS_AUCTION` - Player passed on auction
- `LUXURY_DISCARDED` - Player discarded a luxury card

**Game State Events:**
- `STATE_SYNC` - Full state synchronization
- `ROUND_STARTED` - New auction round began
- `AUCTION_COMPLETE` - Auction finished
- `GAME_ENDED` - Game completed with final scores

### 2. WebSocket Service (`src/lib/multiplayer/service.ts`)

Manages connection and communication with the Socket.IO server:

**Key Methods:**
- `connect()` - Connect to the relay server
- `createRoom(playerName)` - Create a new game room
- `joinRoom(roomId, playerName)` - Join an existing room
- `broadcastEvent(type, data)` - Broadcast event to all players
- `on(eventType, callback)` - Register event handler
- `off(eventType, callback)` - Unregister event handler

**Configuration:**
The client automatically detects the relay server URL based on hostname:
- `localhost` → `http://localhost:3000`
- `avanderw.co.za` → `https://high-society.avanderw.co.za`

Override via environment variable if needed:
```
VITE_SOCKET_SERVER_URL=http://localhost:3000
```

### 3. State Serialization (`src/lib/multiplayer/serialization.ts`)

Handles serialization/deserialization of game state for transmission:

**Functions:**
- `serializeGameState(gameState)` - Convert GameState to JSON
- `deserializeGameState(data, originalState)` - Restore GameState from JSON
- `applyPartialStateUpdate(currentState, updates)` - Apply incremental updates

**Security:**
- Status deck is NOT serialized to prevent cheating
- Only revealed/public information is shared

## Client-Side State Management

### Event-Driven Updates

Each client:
1. Maintains its own `GameState` instance
2. Listens for events from other players
3. Applies the same game logic locally when events are received
4. Broadcasts its own actions to other players

### Synchronization Pattern

```typescript
// When local player takes an action
function placeBid() {
  // 1. Apply action locally
  const result = auction.processBid(player, selectedCards);
  
  // 2. Broadcast to other players
  multiplayerService.broadcastEvent(GameEventType.BID_PLACED, {
    playerId: player.id,
    playerName: player.name,
    moneyCardIds: selectedCards.map(c => c.id),
    totalBid: player.getCurrentBidAmount()
  });
  
  // 3. Update UI
  updateCounter++;
}

// When receiving event from another player
multiplayerService.on(GameEventType.BID_PLACED, (event) => {
  // Skip own events
  if (event.playerId === myPlayerId) return;
  
  // 1. Find the player
  const player = gameState.getPlayer(event.data.playerId);
  const auction = gameState.getCurrentAuction();
  
  // 2. Apply the action
  const moneyCards = player.getMoneyHand().filter(c => 
    event.data.moneyCardIds.includes(c.id)
  );
  auction.processBid(player, moneyCards);
  
  // 3. Update UI
  updateCounter++;
});
```

### Deterministic Game Logic

For proper synchronization, the game must be deterministic:
- ✅ **Already deterministic:** All game logic is pure and based on player actions
- ✅ **No random elements during play:** Card shuffling happens once at game start
- ⚠️ **Initial shuffle sync:** The host broadcasts the initial shuffled deck order

## Relay Server Requirements

### Socket.IO Events to Implement

The relay server needs to handle:

```typescript
// Room management
socket.on('create_room', ({ roomId, playerId, playerName }) => {
  // Join socket to room
  socket.join(roomId);
  // Store player info
  // Send acknowledgment
  callback({ success: true });
});

socket.on('join_room', ({ roomId, playerId, playerName }) => {
  socket.join(roomId);
  // Broadcast to room
  io.to(roomId).emit('player:joined', { playerId, playerName });
  callback({ success: true });
});

socket.on('leave_room', ({ roomId, playerId }) => {
  socket.leave(roomId);
  io.to(roomId).emit('player:left', { playerId });
});

// Game events
socket.on('game_event', (event) => {
  // Broadcast to everyone in the room (including sender)
  io.to(event.roomId).emit(event.type, event.data);
});
```

### Minimal Server Implementation

```javascript
const io = require('socket.io')(3000, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map(); // roomId -> Set<playerId>

io.on('connection', (socket) => {
  socket.on('create_room', ({ roomId, playerId, playerName }, callback) => {
    socket.join(roomId);
    rooms.set(roomId, new Set([playerId]));
    callback({ success: true });
  });

  socket.on('join_room', ({ roomId, playerId, playerName }, callback) => {
    if (!rooms.has(roomId)) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    
    socket.join(roomId);
    rooms.get(roomId).add(playerId);
    
    io.to(roomId).emit('room:joined', { playerId, playerName, roomId });
    callback({ success: true });
  });

  socket.on('leave_room', ({ roomId, playerId }) => {
    socket.leave(roomId);
    if (rooms.has(roomId)) {
      rooms.get(roomId).delete(playerId);
      io.to(roomId).emit('room:left', { playerId });
    }
  });

  socket.on('game_event', (event) => {
    io.to(event.roomId).emit(event.type, event);
  });

  socket.on('disconnect', () => {
    // Clean up player from rooms
  });
});
```

## Usage Flow

### 1. Create/Join Room

**Host (creates room):**
```typescript
const service = getMultiplayerService();
await service.connect();
const roomId = await service.createRoom('Alice');
// Share roomId with other players
```

**Other Players (join room):**
```typescript
const service = getMultiplayerService();
await service.connect();
await service.joinRoom(roomId, 'Bob');
```

### 2. Start Game

**Host initiates:**
```typescript
// When all players have joined
startGame(playerNames); // Creates local game state
service.broadcastEvent(GameEventType.GAME_STARTED, {
  players: playerNames.map((name, i) => ({ id: playerIds[i], name })),
  initialState: serializeGameState(gameState)
});
```

**Others receive:**
```typescript
service.on(GameEventType.GAME_STARTED, (event) => {
  gameState = deserializeGameState(event.data.initialState);
  updateCounter++;
});
```

### 3. Play Game

Each player action:
1. Updates local state
2. Broadcasts event
3. Other clients receive event and update their state

### 4. Handle Disconnections

```typescript
service.on(GameEventType.PLAYER_LEFT, (event) => {
  // Pause game or handle reconnection
  showNotification(`${event.data.playerName} disconnected`);
});
```

## Testing Locally

### 1. Start Relay Server

```bash
node relay-server.js
# Or use the Socket.IO example server
```

### 2. Run Multiple Clients

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev -- --port 5174

# Terminal 3
npm run dev -- --port 5175
```

### 3. Test Flow

1. Open first client → Create room → Copy room ID
2. Open second client → Join room with room ID
3. First client starts game
4. Take turns, watch state sync across clients

## Implementation Checklist

- [x] Event type definitions
- [x] WebSocket service with Socket.IO client
- [x] State serialization/deserialization
- [ ] Update GameSetup component for multiplayer
- [ ] Update main +page.svelte for multiplayer
- [ ] Add room creation/joining UI
- [ ] Add player list display
- [ ] Implement event broadcasting for all actions
- [ ] Implement event listeners for remote actions
- [ ] Handle edge cases (disconnections, rejoin, etc.)
- [ ] Add loading states and error handling
- [ ] Test with multiple clients

## Security Considerations

### Client-Side Authority

- ✅ Simple to implement
- ✅ No server logic needed
- ⚠️ Vulnerable to cheating (players can modify local state)
- ⚠️ Requires trust between players

### Mitigation Strategies

1. **Validation**: Each client validates received events
2. **Checksums**: Periodically compare state hashes between clients
3. **Audit Log**: Keep event history for dispute resolution
4. **Room Passwords**: Limit access to trusted players

For untrusted environments, consider adding server-side validation.

## Future Enhancements

- **Reconnection**: Save state and allow players to rejoin
- **Spectator Mode**: Allow watching without playing
- **Chat**: In-game messaging
- **Replay**: Save and replay games
- **Matchmaking**: Automatic room creation and player matching
- **Server Validation**: Optional server-side game logic validation
