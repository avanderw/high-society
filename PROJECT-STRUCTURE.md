# Project Structure

## Directory Overview

```
high-society/
├── src/
│   ├── lib/
│   │   ├── domain/              # Pure game logic (TypeScript only)
│   │   │   ├── cards.ts         # Card entities and factories
│   │   │   ├── player.ts        # Player state and money management
│   │   │   ├── gameState.ts     # Game state machine
│   │   │   ├── auction.ts       # Auction mechanics
│   │   │   └── scoring.ts       # Winner calculation and cast out logic
│   │   │
│   │   ├── stores/              # Reactive state management
│   │   │   └── reactiveGameStore.svelte.ts  # Svelte 5 wrapper around domain
│   │   │
│   │   ├── orchestrators/       # Action coordination
│   │   │   ├── GameOrchestrator.ts          # Game action handler
│   │   │   └── MultiplayerOrchestrator.ts   # Event sync handler
│   │   │
│   │   ├── multiplayer/         # Networking layer
│   │   │   ├── events.ts        # Event type definitions
│   │   │   ├── service.ts       # WebSocket client (Socket.IO)
│   │   │   ├── serialization.ts # GameState ↔ JSON conversion
│   │   │   └── hostGuard.ts     # Host-only action validation
│   │   │
│   │   ├── components/          # UI components (Svelte 5)
│   │   │   ├── GameSetup.svelte
│   │   │   ├── MultiplayerSetup.svelte
│   │   │   ├── GameBoard.svelte
│   │   │   ├── AuctionPanel.svelte
│   │   │   ├── PlayerHand.svelte
│   │   │   ├── StatusDisplay.svelte
│   │   │   ├── ScoreBoard.svelte
│   │   │   ├── LuxuryDiscardModal.svelte
│   │   │   ├── AuctionResultModal.svelte
│   │   │   ├── Modal.svelte     # Generic modal component
│   │   │   ├── TurnTimer.svelte
│   │   │   ├── UpdatePrompt.svelte
│   │   │   ├── ErrorToast.svelte
│   │   │   ├── StatisticsModal.svelte
│   │   │   └── SettingsModal.svelte
│   │   │
│   │   └── utils/               # Helper utilities
│   │       ├── feedback.ts      # Audio + haptic feedback
│   │       └── statistics.ts    # Local stats tracking
│   │
│   ├── routes/
│   │   ├── +layout.svelte       # Root layout (Pico CSS)
│   │   ├── +layout.ts           # Layout load function
│   │   └── +page.svelte         # Main game page (822 lines)
│   │
│   ├── tests/                   # Vitest test suite
│   │   ├── *.test.ts            # 15 test files
│   │   ├── mocks/               # Test mocks
│   │   └── setup.ts             # Test configuration
│   │
│   └── app.html                 # HTML template
│
├── static/                      # Static assets
│   ├── manifest.webmanifest     # PWA manifest
│   ├── icon-192.png
│   ├── icon-512.png
│   └── robots.txt
│
├── relay-server.js              # Socket.IO relay server
├── test-relay.js                # Server test script
├── package.json                 # Dependencies
├── vite.config.ts               # Vite + PWA config
├── svelte.config.js             # SvelteKit config
├── tsconfig.json                # TypeScript config
└── vitest.config.ts             # Test config
```

## Architecture Layers

### 1. Domain Layer (`src/lib/domain/`)
**Pure business logic - zero framework dependencies**

| File | Purpose |
|------|---------|
| `cards.ts` | Card types, factories, deck creation |
| `player.ts` | Player state, money/status management, bid tracking |
| `gameState.ts` | Game state machine, phase management, round control |
| `auction.ts` | Bidding mechanics, pass handling, auction resolution |
| `scoring.ts` | Final scoring, cast out logic, winner determination |

**Principles:**
- Pure TypeScript (no Svelte, no UI imports)
- Immutable data patterns
- Fully testable in isolation

### 2. Store Layer (`src/lib/stores/`)
**Svelte 5 reactive wrapper**

| File | Purpose |
|------|---------|
| `reactiveGameStore.svelte.ts` | Singleton store with $state/$derived runes, provides reactive access to GameState |

**Key Features:**
- Automatic reactivity via `updateCounter`
- Derived values: `isMyTurn`, `localPlayer`, `currentPlayer`
- Delegates actions to GameOrchestrator
- Multiplayer context management

### 3. Orchestrator Layer (`src/lib/orchestrators/`)
**Coordinates complex actions**

| File | Purpose |
|------|---------|
| `GameOrchestrator.ts` | Wraps domain operations, returns ActionResult objects |
| `MultiplayerOrchestrator.ts` | Handles event broadcasting and remote event application |

**Pattern:** Actions return `{ success, error?, ...data }` instead of throwing

### 4. Multiplayer Layer (`src/lib/multiplayer/`)
**Network synchronization**

| File | Purpose |
|------|---------|
| `events.ts` | GameEventType enum, event payload types |
| `service.ts` | Socket.IO client, singleton pattern, auto-configuration |
| `serialization.ts` | Converts GameState to/from JSON (excludes unrevealed cards) |
| `hostGuard.ts` | Validates host-only actions (game start, round transitions) |

### 5. Component Layer (`src/lib/components/`)
**UI presentation (Svelte 5 + Pico CSS)**

- Props via `$props<T>()`
- Events via callback props
- Semantic HTML with minimal custom CSS
- Generic `Modal.svelte` with snippet API

### 6. Utils Layer (`src/lib/utils/`)
**Cross-cutting concerns**

| File | Purpose |
|------|---------|
| `feedback.ts` | Unified audio (Web Audio oscillators) + haptic feedback |
| `statistics.ts` | localStorage-based game stats |

## Data Flow

### Local Game
```
User Input → store.action() → GameOrchestrator → Domain Layer → store.forceUpdate() → UI
```

### Multiplayer Game
```
Local Action:
  User Input → store.action() → GameOrchestrator → Domain Layer → store.forceUpdate() → UI
                                                                   ↓
                                                    multiplayerOrchestrator.broadcast()
                                                                   ↓
                                                             Relay Server
                                                                   ↓
Remote Event:                                              All Clients
  Event Received → MultiplayerOrchestrator → Domain Layer → store.forceUpdate() → UI
```

## Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/routes/+page.svelte` | 822 | Main game orchestration, multiplayer setup |
| `src/lib/stores/reactiveGameStore.svelte.ts` | 178 | Reactive state management |
| `src/lib/orchestrators/GameOrchestrator.ts` | 269 | Game action coordination |
| `src/lib/orchestrators/MultiplayerOrchestrator.ts` | 418 | Multiplayer event handling |
| `src/lib/domain/gameState.ts` | ~400 | Core game state machine |
| `relay-server.js` | ~200 | WebSocket relay server |

## Tech Stack

- **Framework:** SvelteKit 5 (Svelte 5 runes: `$state`, `$derived`, `$effect`)
- **Language:** TypeScript (strict mode)
- **Styling:** Pico CSS (semantic, classless framework)
- **Build:** Vite 7
- **Networking:** Socket.IO
- **Testing:** Vitest
- **PWA:** Vite PWA plugin + Workbox

## Development Workflow

```powershell
# Install
npm install

# Development (2 terminals)
node relay-server.js    # Terminal 1: Relay server (port 3000)
npm run dev             # Terminal 2: Dev server (port 5173)

# Testing
npm test                # Run test suite
npm test -- --watch     # Watch mode

# Production
npm run build           # Build for production
npm run preview         # Preview production build
```

## Documentation

See [DOCUMENTATION-INDEX.md](./DOCUMENTATION-INDEX.md) for complete documentation listing.
