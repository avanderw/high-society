# 🚀 Quick Reference Card

One-page reference for the most common commands and patterns.

## ⚡ Quick Commands

```powershell
# Installation (first time)
npm install
npm install socket.io

# Development (2 terminals needed)
node relay-server.js          # Terminal 1: Relay server
npm run dev                   # Terminal 2: Dev server

# Testing
node test-relay.js            # Test relay server
npm run build                 # Test build process

# Production
npm run build                 # Build for deployment
npm run preview               # Test production build
```

## 🌐 URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Game (Dev)** | http://localhost:5173 | Development game client |
| **Relay Server** | http://localhost:3000 | WebSocket server |
| **Preview** | http://localhost:4173 | Production build test |

## 📁 Key Files

| File | What It Does |
|------|--------------|
| `relay-server.js` | WebSocket relay server |
| `src/routes/+page.svelte` | Main game page |
| `src/lib/multiplayer/service.ts` | WebSocket client |
| `src/lib/domain/gameState.ts` | Game logic |
| `.env` | Configuration |

## 🎮 Game Flow

```
Main Menu → Choose Mode
  ├─ Local → GameSetup → Play (hotseat)
  └─ Multiplayer → MultiplayerSetup → Play (online)
      ├─ Create Room → Wait for players → Start Game
      └─ Join Room → Wait for host → Play
```

## 🔧 Common Fixes

| Problem | Solution |
|---------|----------|
| Can't connect | 1. Check relay server running<br>2. Check `.env` file<br>3. Restart both servers |
| Room not found | 1. Verify room code<br>2. Host still connected?<br>3. Create new room |
| Cards not syncing | 1. All players refresh<br>2. Check console for errors<br>3. Restart game |
| Build fails | 1. Check error message<br>2. `npm install`<br>3. Delete `node_modules`, reinstall |

## 📝 Event Types

```typescript
// Room events
ROOM_CREATED, PLAYER_JOINED, PLAYER_LEFT

// Action events
BID_PLACED, PASS_AUCTION, LUXURY_DISCARDED

// State events
GAME_STARTED, ROUND_STARTED, AUCTION_COMPLETE, GAME_ENDED
```

## 🏗️ Architecture Pattern

```
Player Action → Local State Update → Broadcast Event
                                          ↓
                                    Relay Server
                                          ↓
                          All Clients (including sender)
                                          ↓
                            Remote State Update → UI Update
```

## 💻 Code Snippets

### Broadcast Event
```typescript
multiplayerService.broadcastEvent(GameEventType.BID_PLACED, {
  playerId: player.id,
  playerName: player.name,
  moneyCardIds: cards.map(c => c.id),
  totalBid: amount
});
```

### Listen for Event
```typescript
multiplayerService.on(GameEventType.BID_PLACED, (event) => {
  // Apply remote player's action
  const player = gameState.getPlayer(event.data.playerId);
  // ... process bid
  updateCounter++;
});
```

### Create Room
```typescript
await multiplayerService.connect();
const { roomId, playerId } = await multiplayerService.createRoom(playerName);
```

### Join Room
```typescript
await multiplayerService.connect();
const result = await multiplayerService.joinRoom(roomId, playerName);
```

## 🐛 Debug Checklist

Quick things to check when something's wrong:

- [ ] Relay server running? (Check terminal)
- [ ] `.env` file exists?
- [ ] Dev server running? (`npm run dev`)
- [ ] Browser console clear? (F12)
- [ ] Tried refreshing? (Ctrl+Shift+R)
- [ ] Port 3000 free? (`netstat -ano | findstr :3000`)

## 🌍 Environment Variables

```env
# .env file
VITE_SOCKET_SERVER_URL=http://localhost:3000

# Production
VITE_SOCKET_SERVER_URL=https://your-relay-server.com
```

**Remember**: Restart dev server after changing `.env`!

## 📖 Documentation Guide

| Need to... | Read... |
|------------|---------|
| Get started | [QUICKSTART-MULTIPLAYER.md](./QUICKSTART-MULTIPLAYER.md) |
| Understand code | [PROJECT-STRUCTURE.md](./PROJECT-STRUCTURE.md) |
| Fix issues | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |
| Deploy | [README.md](./README.md) + [MULTIPLAYER-ARCHITECTURE.md](./MULTIPLAYER-ARCHITECTURE.md) |

## 🎯 Testing Multiplayer Locally

**Fastest way** (2 browser windows):

1. Start relay: `node relay-server.js`
2. Start dev: `npm run dev`
3. Open http://localhost:5173
4. Create room → Copy code
5. Open incognito window (Ctrl+Shift+N)
6. Join room → Paste code
7. Start game!

## 🔍 Useful Console Commands

```javascript
// Check connection
multiplayerService.isConnected()

// View game state (in +page.svelte context)
gameState.getPlayers()
gameState.getCurrentPlayer()
gameState.getCurrentAuction()

// Enable debug logging
localStorage.debug = '*'
```

## 📊 Project Stats

- **TypeScript Files**: 20+
- **Components**: 10
- **Event Types**: 10+
- **Documentation Files**: 7
- **Lines of Code**: ~3,500+

## ⚙️ Relay Server Ports

Default: `3000`

Change with:
```powershell
$env:PORT=8080; node relay-server.js
```

Update `.env`:
```env
VITE_SOCKET_SERVER_URL=http://localhost:8080
```

## 🎨 UI Patterns

```svelte
<!-- Svelte 5 State -->
let value = $state(initial);

<!-- Svelte 5 Derived -->
const computed = $derived(value * 2);

<!-- Svelte 5 Effect -->
$effect(() => {
  // Runs when dependencies change
});
```

## 🚀 Deployment Quick Guide

### Relay Server
```bash
# Heroku
heroku create
git push heroku main

# Or use Railway, Fly.io, DigitalOcean
```

### Game Client
```bash
npm run build
# Deploy 'build' folder to:
# - Netlify (drag & drop)
# - Vercel (auto-deploy from git)
# - GitHub Pages (gh-pages branch)
```

## 📱 Mobile Testing

Find your IP:
```powershell
ipconfig
# Look for: IPv4 Address . . . : 192.168.x.x
```

On mobile, navigate to:
```
http://192.168.x.x:5173
```

## 🔗 Quick Links

- [Main README](./README.md)
- [Documentation Index](./DOCUMENTATION-INDEX.md)
- [Quick Start](./QUICKSTART-MULTIPLAYER.md)
- [Architecture](./MULTIPLAYER-ARCHITECTURE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

---

**Pro Tip**: Bookmark this page for instant reference! 📌
