# High Society - Complete Project Structure

```
high-society/
│
├── 📄 Configuration Files
│   ├── package.json                          # Dependencies (socket.io-client, etc.)
│   ├── vite.config.ts                        # Vite + PWA config
│   ├── svelte.config.js                      # SvelteKit config (adapter-static)
│   ├── tsconfig.json                         # TypeScript config
│   ├── .env                                  # Local environment (VITE_SOCKET_SERVER_URL)
│   └── .env.example                          # Environment template
│
├── 🌐 Relay Server
│   ├── relay-server.js                       # Socket.IO relay server (room management, broadcasting)
│   └── test-relay.js                         # Test script for relay server
│
├── 📚 Documentation
│   ├── README.md                             # Main project documentation
│   ├── QUICKSTART-MULTIPLAYER.md             # Step-by-step multiplayer setup
│   ├── MULTIPLAYER-ARCHITECTURE.md           # Technical architecture guide
│   ├── IMPLEMENTATION-SUMMARY.md             # Complete implementation summary
│   ├── 20251001T141917_high-society-coding-specification_1a93b170.md
│   └── 20251001T142857_high-society-rules_0b8224f9.md
│
├── 📁 src/
│   │
│   ├── 🎮 Routes (Pages)
│   │   ├── routes/
│   │   │   ├── +layout.svelte               # Root layout (Pico CSS)
│   │   │   └── +page.svelte                 # Main game page (mode selection, multiplayer integration)
│   │   │
│   │   ├── app.html                         # HTML template
│   │   └── app.d.ts                         # TypeScript declarations
│   │
│   └── 📚 lib/
│       │
│       ├── 🎯 Domain Layer (Game Logic)
│       │   ├── domain/
│       │   │   ├── cards.ts                 # Card entities (Luxury, Prestige, Disgrace, Money)
│       │   │   ├── player.ts                # Player entity (money, status, bids)
│       │   │   ├── gameState.ts             # Game state machine (phases, rounds, auctions)
│       │   │   ├── auction.ts               # Auction system (RegularAuction, DisgraceAuction)
│       │   │   └── scoring.ts               # Scoring system (cast out, status calculation)
│       │   │
│       │   └── index.ts                     # Library exports
│       │
│       ├── 🌐 Multiplayer System (NEW!)
│       │   ├── multiplayer/
│       │   │   ├── events.ts                # Event types (10+ game events, type-safe)
│       │   │   ├── service.ts               # MultiplayerService (WebSocket client, singleton)
│       │   │   └── serialization.ts         # State serialization (GameState ↔ JSON)
│       │
│       ├── 🎨 UI Components
│       │   ├── components/
│       │   │   ├── GameSetup.svelte         # Local game setup (player names)
│       │   │   ├── MultiplayerSetup.svelte  # Multiplayer lobby (NEW!)
│       │   │   ├── GameBoard.svelte         # Main game board (status deck, triggers)
│       │   │   ├── AuctionPanel.svelte      # Auction controls (bid/pass buttons)
│       │   │   ├── PlayerHand.svelte        # Player's money cards
│       │   │   ├── StatusDisplay.svelte     # Player status/money display
│       │   │   ├── ScoreBoard.svelte        # End game scoring
│       │   │   ├── LuxuryDiscardModal.svelte # Luxury card discard modal
│       │   │   └── UpdatePrompt.svelte      # PWA update prompt
│       │
│       └── 🖼️ Assets
│           └── assets/
│               └── favicon.svg
│
├── 📦 Static Files
│   └── static/
│       └── robots.txt
│
└── 🏗️ Build Output
    └── build/                                # Production build (adapter-static)
        ├── _app/                             # App bundles
        ├── sw.js                             # Service worker (PWA)
        └── manifest.webmanifest              # PWA manifest

```

## 📊 Component Relationships

### Page Flow
```
Main Menu (+page.svelte)
├── Local Game
│   ├── GameSetup.svelte → Enter player names
│   └── Game Components → Play local hotseat
│
└── Multiplayer Game
    ├── MultiplayerSetup.svelte → Create/Join room
    │   ├── Create Room → Host lobby
    │   └── Join Room → Guest lobby
    │
    └── Game Components → Play online
        ├── GameBoard.svelte
        ├── AuctionPanel.svelte
        ├── PlayerHand.svelte
        ├── StatusDisplay.svelte
        └── ScoreBoard.svelte
```

### Data Flow (Multiplayer)
```
User Action (Bid/Pass)
    ↓
Local GameState Update
    ↓
Event Broadcast (MultiplayerService)
    ↓
Relay Server (relay-server.js)
    ↓
All Clients in Room
    ↓
Event Listener (setupMultiplayerListeners)
    ↓
Remote GameState Update
    ↓
UI Update (updateCounter++)
```

## 🎯 Key Directories Explained

### `/src/lib/domain/`
**Pure game logic** - No UI, no networking, just business rules
- Cards: Entity classes with game effects
- Player: Manages money, status, bids
- GameState: Orchestrates game flow
- Auction: Handles bidding mechanics
- Scoring: Calculates winners

### `/src/lib/multiplayer/`
**Networking layer** - Handles online play
- events.ts: Defines what can happen
- service.ts: Sends/receives events
- serialization.ts: Converts state for network

### `/src/lib/components/`
**UI layer** - Svelte components
- Display game state
- Handle user input
- Reactive updates via Svelte 5 runes

### `/src/routes/`
**Pages** - SvelteKit routes
- +page.svelte: Main game orchestration
- +layout.svelte: Shared layout (CSS)

## 📈 Dependencies Tree

```
High Society App
├── SvelteKit 5 (Framework)
│   ├── Svelte 5 (UI library with runes)
│   ├── Vite 7 (Build tool)
│   └── adapter-static (Static site generation)
│
├── Pico CSS (Styling)
│   └── @picocss/pico
│
├── PWA Support
│   ├── @vite-pwa/sveltekit
│   └── workbox-* (Service worker)
│
└── Multiplayer
    ├── socket.io-client (WebSocket client)
    └── socket.io (Server - separate install)
```

## 🔢 By the Numbers

### Code Statistics
- **Total TypeScript Files**: 20+
- **Svelte Components**: 10
- **Domain Classes**: 15+
- **Event Types**: 10+
- **Lines of Code**: ~3,500+

### Feature Completeness
- ✅ Full game rules implementation
- ✅ Local hotseat mode
- ✅ Online multiplayer mode
- ✅ PWA installable
- ✅ Mobile responsive
- ✅ Type-safe (100% TypeScript)
- ✅ Production ready

### Bundle Sizes (Production)
- Client bundle: ~95 KB (gzipped: ~31 KB)
- Server bundle: ~126 KB
- CSS: ~83 KB (gzipped: ~12 KB)
- Total: ~304 KB

## 🎨 UI Component Hierarchy

```
+page.svelte (Main orchestrator)
├── Mode: Menu
│   └── [Mode selection cards]
│
├── Mode: Local Setup
│   └── GameSetup.svelte
│       └── [Player name inputs]
│
├── Mode: Multiplayer Setup
│   └── MultiplayerSetup.svelte
│       ├── [Create/Join forms]
│       └── [Player lobby]
│
└── Mode: Playing
    ├── [Multiplayer info badge]
    ├── [Error messages]
    ├── GameBoard.svelte
    │   ├── [Status deck]
    │   ├── [Current card]
    │   └── [Game end triggers]
    │
    ├── Grid (auction + status)
    │   ├── AuctionPanel.svelte
    │   │   ├── [Current player]
    │   │   ├── [Bid info]
    │   │   └── [Bid/Pass buttons]
    │   │
    │   └── StatusDisplay.svelte
    │       └── [All players' status]
    │
    ├── PlayerHand.svelte
    │   └── [Selectable money cards]
    │
    ├── LuxuryDiscardModal.svelte (conditional)
    │   └── [Discard selection]
    │
    └── ScoreBoard.svelte (end game)
        ├── [Final scores]
        ├── [Cast out players]
        └── [Winner]
```

## 🚀 Development Workflow

```bash
# 1. Development
npm install              # Install dependencies
node relay-server.js     # Start relay (new terminal)
npm run dev              # Start dev server

# 2. Testing
npm run build            # Production build
npm run preview          # Test production build
node test-relay.js       # Test relay server

# 3. Deployment
npm run build            # Build static files
# Deploy 'build/' to:
# - GitHub Pages
# - Netlify
# - Vercel
# - Any static host

# Deploy relay-server.js to:
# - Heroku
# - Railway
# - DigitalOcean
# - AWS/GCP
```

## 🎯 Entry Points

### For Users
- **Main app**: `http://localhost:5173` (dev) or deployed URL
- **Relay server**: Runs on port 3000 (or configured PORT)

### For Developers
- **Main game logic**: `src/routes/+page.svelte`
- **Domain layer**: `src/lib/domain/`
- **Multiplayer**: `src/lib/multiplayer/`
- **Relay server**: `relay-server.js`
- **Documentation**: All `.md` files in root

## 📖 Documentation Guide

| Need to... | Read this |
|------------|-----------|
| Get started quickly | `QUICKSTART-MULTIPLAYER.md` |
| Understand architecture | `MULTIPLAYER-ARCHITECTURE.md` |
| See what was implemented | `IMPLEMENTATION-SUMMARY.md` |
| Deploy to production | `README.md` (Multiplayer Setup) |
| Understand game rules | `20251001T142857_high-society-rules_*.md` |
| See code specs | `20251001T141917_high-society-coding-specification_*.md` |

---

**Legend**
- 📄 Configuration
- 🌐 Server/Network
- 📚 Documentation
- 🎮 Pages/Routes
- 🎯 Domain/Logic
- 🎨 UI Components
- 📦 Build/Static
- 🖼️ Assets
