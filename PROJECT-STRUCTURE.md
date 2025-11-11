# Project Structure

## Directory Layout

```
high-society/
├── relay-server.js              # Socket.IO relay server
├── test-relay.js                # Server testing script
├── .env                         # Local environment config
├── package.json                 # Dependencies
├── vite.config.ts               # Vite + PWA config
├── svelte.config.js             # SvelteKit config
├── tsconfig.json                # TypeScript config
│
├── src/
│   ├── app.html                 # HTML template
│   ├── routes/
│   │   ├── +layout.svelte       # Root layout (Pico CSS)
│   │   └── +page.svelte         # Main game page
│   │
│   └── lib/
│       ├── domain/              # Game logic (pure TypeScript)
│       │   ├── cards.ts         # Card entities
│       │   ├── player.ts        # Player entity
│       │   ├── gameState.ts     # Game state machine
│       │   ├── auction.ts       # Auction system
│       │   └── scoring.ts       # Scoring system
│       │
│       ├── multiplayer/         # Networking layer
│       │   ├── events.ts        # Event type system
│       │   ├── service.ts       # WebSocket client
│       │   └── serialization.ts # State serialization
│       │
│       └── components/          # UI components (Svelte)
│           ├── GameSetup.svelte
│           ├── MultiplayerSetup.svelte
│           ├── GameBoard.svelte
│           ├── AuctionPanel.svelte
│           ├── PlayerHand.svelte
│           ├── StatusDisplay.svelte
│           ├── ScoreBoard.svelte
│           ├── LuxuryDiscardModal.svelte
│           └── UpdatePrompt.svelte
│
├── static/                      # Static assets
│   ├── icon-192.png
│   ├── icon-512.png
│   └── robots.txt
│
└── build/                       # Production build output
    ├── index.html
    ├── sw.js                    # Service worker
    ├── manifest.webmanifest     # PWA manifest
    └── _app/                    # App bundles
```

## Architecture Layers

### Domain Layer (`src/lib/domain/`)
Pure game logic with no UI dependencies:
- **Cards**: Luxury, Prestige, Disgrace, Money entities
- **Player**: Money management, status tracking, bids
- **GameState**: Game phases, round management, state machine
- **Auction**: Regular and Disgrace auction mechanics
- **Scoring**: Cast out determination, winner calculation

### Multiplayer Layer (`src/lib/multiplayer/`)
Networking and state synchronization:
- **Events**: Type-safe event system (10+ event types)
- **Service**: WebSocket client (Socket.IO), singleton pattern
- **Serialization**: GameState ↔ JSON conversion

### UI Layer (`src/lib/components/` & `src/routes/`)
Svelte components using Pico CSS:
- **Setup**: Game configuration (local/multiplayer)
- **Board**: Main game display, card deck
- **Auction**: Bidding interface
- **Display**: Status tracking, scoreboard
- **Modals**: Luxury discard, PWA updates

## Data Flow

### Local Game
```
User Input → GameState Update → UI Refresh
```

### Multiplayer Game
```
User Action → Local GameState Update → Broadcast Event
                                            ↓
                                      Relay Server
                                            ↓
                               All Clients in Room
                                            ↓
                            Remote GameState Update → UI Refresh
```

## Key Files

| File | Purpose |
|------|---------|
| `relay-server.js` | WebSocket relay (room management, broadcasting) |
| `src/routes/+page.svelte` | Main game orchestration |
| `src/lib/domain/gameState.ts` | Core game logic |
| `src/lib/multiplayer/service.ts` | Network communication |
| `vite.config.ts` | Build configuration |

## Tech Stack

- **Framework**: SvelteKit 5 with Svelte 5 runes
- **Language**: TypeScript
- **Styling**: Pico CSS (semantic, minimal)
- **Build**: Vite 7
- **Networking**: Socket.IO
- **PWA**: Vite PWA plugin + Workbox

## Component Hierarchy

```
+page.svelte (Main orchestrator)
├── GameSetup.svelte (Local mode)
├── MultiplayerSetup.svelte (Multiplayer lobby)
└── Game Components (When playing)
    ├── GameBoard.svelte
    ├── AuctionPanel.svelte
    ├── PlayerHand.svelte
    ├── StatusDisplay.svelte
    ├── ScoreBoard.svelte
    ├── LuxuryDiscardModal.svelte
    └── UpdatePrompt.svelte
```

## Development Workflow

```powershell
# Install dependencies
npm install

# Development (2 terminals)
node relay-server.js    # Terminal 1: Relay server
npm run dev             # Terminal 2: Dev server

# Testing
node test-relay.js      # Test relay server
npm run build           # Test production build

# Production
npm run build           # Build static site
npm run preview         # Preview production build
```

## Entry Points

### For Users
- **Game**: http://localhost:5173 (dev) or deployed URL
- **Relay Server**: Port 3000 (or configured PORT)

### For Developers
- **Main logic**: `src/routes/+page.svelte`
- **Game rules**: `src/lib/domain/`
- **Networking**: `src/lib/multiplayer/`
- **Server**: `relay-server.js`

## Documentation

See [DOCUMENTATION-INDEX.md](./DOCUMENTATION-INDEX.md) for full documentation listing.
