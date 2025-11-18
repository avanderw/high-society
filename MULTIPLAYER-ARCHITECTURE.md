# Multiplayer Architecture

## Design Philosophy

**Client-Authoritative Event Broadcasting**
- Relay server broadcasts events, does NOT validate game logic
- Each client maintains independent `GameState` instance
- Deterministic game logic ensures state consistency
- Suitable for trusted players only (no anti-cheat)

## System Components

### 1. Relay Server (`relay-server.js`)
**Purpose**: Stateless event broadcaster using Socket.IO

**Responsibilities:**
- Room management (create/join/leave)
- Event broadcasting to room members
- Connection lifecycle handling

**Does NOT:**
- Validate game moves
- Maintain game state
- Enforce game rules

### 2. Event System (`src/lib/multiplayer/events.ts`)
**Purpose**: Type-safe event definitions for game actions

**Event Categories:**
- **Room**: `ROOM_CREATED`, `PLAYER_JOINED`, `PLAYER_LEFT`, `GAME_STARTED`
- **Actions**: `BID_PLACED`, `PASS_AUCTION`, `LUXURY_DISCARDED`
- **Game**: `STATE_SYNC`, `ROUND_STARTED`, `AUCTION_COMPLETE`, `GAME_ENDED`

### 3. Multiplayer Service (`src/lib/multiplayer/service.ts`)
**Purpose**: WebSocket client wrapper (singleton pattern)

**Key Methods:**
```typescript
connect() // Connect to relay server
createRoom(playerName) // Create room, become host
joinRoom(roomId, playerName) // Join existing room
broadcastEvent(type, data) // Send event to room
on(eventType, callback) // Register listener
```

**Auto-configuration:**
- `localhost` → `http://localhost:3000`
- `avanderw.co.za` → `https://high-society.avanderw.co.za`
- Override: `VITE_SOCKET_SERVER_URL` environment variable

### 4. State Serialization (`src/lib/multiplayer/serialization.ts`)
**Purpose**: Convert GameState ↔ JSON for network transmission

**Security:**
- ✅ Serializes: Players, revealed cards, public state
- ❌ Does NOT serialize: Status deck (unrevealed cards)
- Prevents cheating via network inspection

### 5. Orchestrators
- **GameOrchestrator**: Coordinates local game actions
- **MultiplayerOrchestrator**: Handles event broadcasting and remote event application

## Synchronization Pattern

### Action Flow
```
1. Local player acts
   ↓
2. Apply to local GameState (via GameOrchestrator)
   ↓
3. Trigger UI update (store.forceUpdate())
   ↓
4. Broadcast event to room (via MultiplayerOrchestrator)
   ↓
5. Relay server broadcasts to all clients
   ↓
6. Remote clients receive event
   ↓
7. Remote clients apply same action to their GameState
   ↓
8. Remote clients update their UI
```

### Code Pattern
```typescript
// Local action
const result = store.placeBid(selectedCardIds);
if (result.success) {
  // Broadcast after local success
  multiplayerOrchestrator.broadcastBid(result.bidAmount!);
}

// Remote event handling (in MultiplayerOrchestrator)
service.on(GameEventType.BID_PLACED, (event) => {
  if (isDuplicateEvent(event.eventId)) return;
  
  // Apply action from event data
  const player = getPlayerById(event.data.playerId);
  const cards = getMoneyCards(event.data.moneyCardIds);
  auction.processBid(player, cards);
  
  store.forceUpdate(); // Trigger reactivity
});
```

### Determinism Requirements
- ✅ Pure domain logic (no randomness during play)
- ✅ Same inputs → same outputs
- ✅ Seeded RNG for initial deck shuffle (host broadcasts seed)
- ✅ Event ordering guaranteed by Socket.IO

## Relay Server Implementation

### Minimal Server (relay-server.js)
```javascript
const io = require('socket.io')(3000);
const rooms = new Map(); // roomId -> player info

io.on('connection', (socket) => {
  // Room management
  socket.on('create_room', ({ roomId, playerId, playerName }, callback) => {
    socket.join(roomId);
    rooms.set(roomId, new Set([playerId]));
    callback({ success: true });
  });

  socket.on('join_room', ({ roomId, playerId, playerName }, callback) => {
    if (!rooms.has(roomId)) return callback({ success: false });
    socket.join(roomId);
    rooms.get(roomId).add(playerId);
    io.to(roomId).emit('room:joined', { playerId, playerName, roomId });
    callback({ success: true });
  });

  // Event broadcasting
  socket.on('game_event', (event) => {
    io.to(event.roomId).emit(event.type, event.data);
  });
});
```

### Server Responsibilities
- ✅ Accept connections
- ✅ Manage rooms (create/join/leave)
- ✅ Broadcast events to room members
- ❌ NO game logic validation
- ❌ NO state persistence
- ❌ NO anti-cheat

## Security Model

**Trust-Based Design:**
- Clients can modify local state
- Clients can send fake events
- No server-side validation

**Suitable For:**
- ✅ Friends playing together
- ✅ Trusted groups
- ✅ Casual gameplay

**NOT Suitable For:**
- ❌ Competitive tournaments
- ❌ Untrusted players
- ❌ Leaderboards/rankings

**For Untrusted Players, Would Need:**
- Server-side game state
- Server validates all actions
- Server is source of truth
- Clients become "view only"

## Deployment

**Development:**
```powershell
node relay-server.js  # Port 3000
npm run dev           # Port 5173
```

**Production:**
- Deploy relay server to any Node.js host
- Set `VITE_SOCKET_SERVER_URL` or use auto-detection
- Build client: `npm run build`
- Deploy static files to any web host

See [DEPLOY-RELAY-SERVER.md](./DEPLOY-RELAY-SERVER.md) for details.  socket.on('game_event', (event) => {
    io.to(event.roomId).emit(event.type, event);
  });


  socket.on('disconnect', () => {
    // Clean up player from rooms
  });
});
```

### Server Responsibilities
- ✅ Accept connections
- ✅ Manage rooms (create/join/leave)
- ✅ Broadcast events to room members
- ❌ NO game logic validation
- ❌ NO state persistence
- ❌ NO anti-cheat

## Security Model

**Trust-Based Design:**
- Clients can modify local state
- Clients can send fake events
- No server-side validation

**Suitable For:**
- ✅ Friends playing together
- ✅ Trusted groups
- ✅ Casual gameplay

**NOT Suitable For:**
- ❌ Competitive tournaments
- ❌ Untrusted players
- ❌ Leaderboards/rankings

**For Untrusted Players, Would Need:**
- Server-side game state
- Server validates all actions
- Server is source of truth
- Clients become "view only"

## Testing Locally

**Start servers:**
```powershell
node relay-server.js  # Port 3000
npm run dev           # Port 5173
```

**Test multiplayer:**
- Open multiple browser windows to `localhost:5173`
- Create room in one window (copy room code)
- Join same room in other windows
- Verify state synchronizes across all clients

## Deployment

See [DEPLOY-RELAY-SERVER.md](./DEPLOY-RELAY-SERVER.md) for production deployment guide.