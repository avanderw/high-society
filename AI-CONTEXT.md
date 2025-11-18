# AI Development Context

**Quick reference for AI assistants working on this High Society card game implementation.**

## 🎯 Project Overview

**What**: Digital multiplayer implementation of Reiner Knizia's High Society auction card game  
**Stack**: SvelteKit 5 + TypeScript + Pico CSS + Socket.IO  
**Architecture**: Clean architecture with domain-driven design  
**Security Model**: Client-authoritative (trusted players only)

## ✅ MAJOR REFACTOR COMPLETED (November 2025)

Successfully reduced complexity while maintaining all functionality:

**Metrics:**
- **+page.svelte: 2,846 → 822 lines** (71% reduction)
- **All 111 tests passing** ✅
- **Better separation of concerns**

**Key Architecture Components:**
1. **ReactiveGameStore** (`stores/reactiveGameStore.svelte.ts`) - Svelte 5 reactive wrapper around domain
2. **GameOrchestrator** (`orchestrators/GameOrchestrator.ts`) - Game action coordinator
3. **MultiplayerOrchestrator** (`orchestrators/MultiplayerOrchestrator.ts`) - Event sync handler
4. **Feedback System** (`utils/feedback.ts`) - Unified audio + haptic feedback

## 🏗️ Architecture Layers (CRITICAL)

### 1. Domain Layer (`src/lib/domain/`)
**Pure business logic - NO dependencies on UI or framework**

- ✅ Pure TypeScript classes and functions
- ✅ Immutable by default (create new objects, don't mutate)
- ✅ Fully testable without any framework
- ❌ No Svelte imports
- ❌ No UI concerns
- ❌ No side effects

**Core files:** `cards.ts`, `player.ts`, `gameState.ts`, `auction.ts`, `scoring.ts`

### 2. Store Layer (`src/lib/stores/`)
**Svelte 5 reactive wrapper around domain**

- ✅ Uses `$state`, `$derived` runes for reactivity
- ✅ Provides reactive access to domain state
- ✅ Single source of truth: `reactiveGameStore`
- ⚠️ Uses `updateCounter` to force reactivity after state changes
- ❌ No business logic (delegate to domain or orchestrators)

**Core file:** `reactiveGameStore.svelte.ts`

### 3. Orchestrator Layer (`src/lib/orchestrators/`)
**Coordinates actions and handles results**

- ✅ Wraps domain operations
- ✅ Returns `ActionResult` objects with success/error states
- ✅ Handles cross-cutting concerns (validation, state updates)
- ❌ No direct UI manipulation

**Core files:** `GameOrchestrator.ts`, `MultiplayerOrchestrator.ts`

### 4. Component Layer (`src/lib/components/`)
**UI presentation and user interaction**

- ✅ Svelte 5 components with runes
- ✅ Pico CSS semantic HTML
- ✅ Props via `$props<T>()` (not `export let`)
- ✅ Events via callback props
- ❌ Minimal business logic (call orchestrators instead)

### 5. Multiplayer Layer (`src/lib/multiplayer/`)
**Event-driven state synchronization**

- ✅ Client-authoritative design
- ✅ Broadcast actions, apply locally
- ✅ Deterministic state updates
- ❌ No server-side validation (trust model)

**Core files:** `service.ts`, `events.ts`, `serialization.ts`


## 🔑 Essential Patterns

### 1. State Management (ReactiveGameStore)
```typescript
// ✅ CORRECT - Access reactive state from store singleton
import { reactiveGameStore } from '$lib/stores/reactiveGameStore.svelte';

const store = reactiveGameStore;

// Reactive derived values (auto-update UI)
const isMyTurn = store.isMyTurn;
const currentPlayer = store.currentPlayer;
const localPlayer = store.localPlayer;

// Initialize game
store.initialize(['Alice', 'Bob', 'Charlie']);
store.setMultiplayerContext(myPlayerId, playerMapping);

// ❌ WRONG - Don't create new instances
const myStore = new ReactiveGameStore(); // Only use singleton
```

### 2. Game Actions (via Store + Orchestrator)
```typescript
// ✅ CORRECT - Call actions through store
const result = store.placeBid(selectedMoneyCardIds);

// Handle ActionResult
if (result.success) {
  if (result.auctionComplete && result.auctionResultData) {
    // Show modal with result.auctionResultData
    showAuctionResultModal(result.auctionResultData);
  }
  // Broadcast to other players
  multiplayerOrchestrator.broadcastBid(result.bidAmount!);
} else {
  // Show error
  showToast(result.error!, 'error');
}

// Other actions
store.pass();
store.discardLuxuryCard(cardId);
store.nextRound();

// ❌ WRONG - Don't call domain methods directly from components
gameState.getCurrentAuction().processBid(player, cards);
```

### 3. Reactivity Pattern
```typescript
// ✅ CORRECT - Store handles reactivity internally
// Derived values automatically update when updateCounter changes
const currentPlayer = store.currentPlayer; // auto-reactive

// Store methods call forceUpdate() internally after mutations
store.placeBid(cards); // automatically triggers UI update

// ⚠️ INTERNAL ONLY - updateCounter is used internally by store
// You don't manually increment it in components
```

### 4. Multiplayer Synchronization
```typescript
// ✅ CORRECT - Setup orchestrator once
const mpOrch = new MultiplayerOrchestrator(multiplayerService, store);
mpOrch.setOnAuctionComplete((gameState, data) => {
  // Handle auction completion on remote clients
});
mpOrch.setupEventListeners();

// Broadcast actions AFTER local execution
const result = store.placeBid(cardIds);
if (result.success) {
  mpOrch.broadcastBid(result.bidAmount!);
}

// ❌ WRONG - Don't manually handle sync events in components
multiplayerService.on(GameEventType.BID_PLACED, (event) => {
  // Let MultiplayerOrchestrator handle this
});
```

### 5. Feedback (Audio + Haptics)
```typescript
// ✅ CORRECT - Unified feedback system
import { feedback, FeedbackType } from '$lib/utils/feedback';

feedback.play(FeedbackType.BID);
feedback.play(FeedbackType.PASS);
feedback.play(FeedbackType.AUCTION_WIN);
feedback.play(FeedbackType.ERROR);

// ❌ WRONG - Old separate systems (removed)
playSound(SoundEffect.BID_PLACE);
vibrate(HapticPattern.SUCCESS);
```

### 6. Component Props (Svelte 5)
```typescript
// ✅ CORRECT - Use $props with TypeScript
let { player, onAction, isActive = false } = $props<{ 
  player: Player;
  onAction: (cardId: string) => void;
  isActive?: boolean;
}>();

// ❌ WRONG - Svelte 4 syntax (don't use)
export let player: Player;
export let onAction: (cardId: string) => void;
export let isActive = false;
```

### 7. Modal Pattern
```svelte
<script>
  import Modal from '$lib/components/Modal.svelte';
  let showModal = $state(false);
  let modalData = $state<MyData | null>(null);
</script>

<Modal bind:show={showModal} title="My Title" size="medium">
  {#snippet children()}
    <p>Content using {modalData?.someField}</p>
  {/snippet}
  {#snippet footer()}
    <button onclick={() => showModal = false}>Close</button>
  {/snippet}
</Modal>

<!-- Trigger modal -->
<button onclick={() => { modalData = data; showModal = true; }}>
  Open
</button>
```


## 🎮 Game Logic Reference

### Card Types & Effects
| Type | Values | Effect |
|------|--------|--------|
| **Luxury** | 1-10 | Add value to status score |
| **Prestige** | ×2 (3 cards) | Multiply final status by 2 (stackable) |
| **Disgrace: Faux Pas** | — | Winner discards highest luxury card |
| **Disgrace: Passé** | -5 | Subtract 5 from status score |
| **Disgrace: Scandale** | ÷2 | Divide final status by 2 |

### Game End Trigger
Game ends immediately when **4th green-bordered card** is revealed:
- 3× Prestige cards (×2)
- 1× Scandale card (÷2)

### Scoring Algorithm (Order Matters!)
1. Sum all luxury card values
2. Subtract 5 for each Passé card
3. Multiply by 2 for each Prestige card (e.g., 2 Prestige = ×4)
4. Divide by 2 for each Scandale card
5. **Eliminate** players with least remaining money
6. **Winner**: Highest status among remaining players
   - Tie-breaker 1: Most money remaining
   - Tie-breaker 2: Highest single luxury card

### Domain API Quick Reference
```typescript
// GameState - Main game controller
gameState.initializeGame(playerNames: string[]);
gameState.startNewRound();
gameState.completeAuction();
gameState.getCurrentPlayer(): Player | null;
gameState.getCurrentAuction(): Auction | null;
gameState.getCurrentPhase(): GamePhase;
gameState.getPublicState(): PublicGameState;

// Auction - Round bidding logic
auction.processBid(player: Player, cards: MoneyCard[]): AuctionResult;
auction.processPass(player: Player): AuctionResult;
auction.getWinner(): Player | null;
auction.getActivePlayers(): Player[];

// Player - Individual player state
player.playMoneyCards(cards: MoneyCard[]): void;
player.receiveStatusCard(card: StatusCard): void;
player.getCurrentBidAmount(): number;
player.getPendingLuxuryDiscard(): StatusCard | null;
player.removeStatusCard(cardId: string): void;

// Scoring
GameScoringService.calculateFinalScores(players: Player[]): ScoringResult;
```


## 🛠️ Common Development Tasks

### Adding a New Multiplayer Event
```typescript
// 1. Define event type in events.ts
export enum GameEventType {
  // ... existing events
  MY_NEW_EVENT = 'MY_NEW_EVENT'
}

// 2. Add payload type
interface MyNewEventData {
  playerId: string;
  someValue: number;
}

export type GameEventData = {
  // ... existing mappings
  [GameEventType.MY_NEW_EVENT]: MyNewEventData;
};

// 3. Broadcast in MultiplayerOrchestrator
broadcastMyAction(value: number) {
  this.service.broadcastEvent(GameEventType.MY_NEW_EVENT, {
    playerId: this.store.myPlayerId,
    someValue: value
  });
}

// 4. Handle in setupEventListeners()
this.service.on(GameEventType.MY_NEW_EVENT, (event) => {
  if (this.isDuplicateEvent(event.eventId)) return;
  // Apply event to game state
  this.store.forceUpdate();
});
```

### Adding a New Game Action
```typescript
// 1. Add domain logic in GameState/Auction/Player
// (pure TypeScript, no UI)

// 2. Add orchestrator method in GameOrchestrator
myNewAction(param: string): ActionResult {
  const player = this.gameState.getCurrentPlayer();
  if (!player) {
    return { success: false, error: 'No active player' };
  }
  
  // Perform domain operation
  try {
    player.doSomething(param);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 3. Expose through ReactiveGameStore
myNewAction(param: string): ActionResult {
  if (!this.orchestrator) {
    return { success: false, error: 'Game not initialized' };
  }
  const result = this.orchestrator.myNewAction(param);
  if (result.success) {
    this.forceUpdate();
  }
  return result;
}

// 4. Call from component
const result = store.myNewAction(value);
if (result.success) {
  mpOrchestrator.broadcastMyAction(value);
} else {
  showToast(result.error);
}
```

### Creating a New UI Component
```svelte
<script lang="ts">
  import type { Player } from '$lib/domain/player';
  
  // Props with TypeScript
  let { player, onSelect, disabled = false } = $props<{
    player: Player;
    onSelect: (playerId: string) => void;
    disabled?: boolean;
  }>();
  
  // Local state
  let isHovered = $state(false);
  
  // Derived values
  const statusTotal = $derived(
    player.statusCards.reduce((sum, c) => sum + (c.value ?? 0), 0)
  );
</script>

<!-- Semantic HTML with Pico CSS -->
<article 
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
  class:disabled
>
  <header>
    <h3>{player.name}</h3>
  </header>
  <p>Status: {statusTotal}</p>
  <footer>
    <button onclick={() => onSelect(player.id)} {disabled}>
      Select
    </button>
  </footer>
</article>

<style>
  /* Minimal custom CSS - prefer Pico defaults */
  .disabled {
    opacity: 0.5;
    pointer-events: none;
  }
</style>
```

### Adding Feedback for New Action
```typescript
// In utils/feedback.ts, add new type
export enum FeedbackType {
  // ... existing types
  MY_ACTION = 'MY_ACTION'
}

// Add configuration
const FEEDBACK_CONFIG: Record<FeedbackType, FeedbackConfig> = {
  // ... existing configs
  [FeedbackType.MY_ACTION]: {
    sound: { oscillator: { type: 'sine', frequency: 440, duration: 100 } },
    haptic: { pattern: [10, 10, 10] }
  }
};

// Use in component
import { feedback, FeedbackType } from '$lib/utils/feedback';
feedback.play(FeedbackType.MY_ACTION);
```


## 🚨 Anti-Patterns & Pitfalls

### ❌ NEVER Do This

**1. Mutating Domain Objects**
```typescript
// ❌ WRONG - Mutates existing object
player.moneyCards.push(newCard);
player.statusCards[0].value = 10;

// ✅ CORRECT - Create new instances
const updatedPlayer = {
  ...player,
  moneyCards: [...player.moneyCards, newCard]
};
```

**2. Mixing UI in Domain Layer**
```typescript
// ❌ WRONG - Domain importing Svelte
import { writable } from 'svelte/store'; // In domain file

// ✅ CORRECT - Domain is pure TypeScript
export class GameState {
  // Only TypeScript, no framework code
}
```

**3. Using Svelte 4 Patterns**
```typescript
// ❌ WRONG - Svelte 4 syntax
import { writable } from 'svelte/store';
export let player: Player;
$: statusSum = player.statusCards.length;

// ✅ CORRECT - Svelte 5 runes
let player = $state<Player>();
const statusSum = $derived(player?.statusCards.length ?? 0);
```

**4. Calling Domain Directly from Components**
```typescript
// ❌ WRONG - Bypass store/orchestrator
gameState.getCurrentAuction().processBid(player, cards);
player.playMoneyCards(selectedCards);

// ✅ CORRECT - Use store methods
const result = store.placeBid(selectedCardIds);
```

**5. Manual Event Handling in Components**
```typescript
// ❌ WRONG - Handle multiplayer events in +page.svelte
multiplayerService.on(GameEventType.BID_PLACED, (event) => {
  // 50 lines of event logic...
});

// ✅ CORRECT - Let MultiplayerOrchestrator handle it
const mpOrch = new MultiplayerOrchestrator(service, store);
mpOrch.setupEventListeners();
```

**6. Serializing Secret Information**
```typescript
// ❌ WRONG - Exposes hidden cards to cheating
const state = {
  ...gameState,
  statusDeck: gameState.getStatusDeck() // Contains unrevealed cards!
};

// ✅ CORRECT - Only serialize public state
const state = gameState.getPublicState();
```

**7. Creating Multiple Store Instances**
```typescript
// ❌ WRONG - Creates new instance
const myStore = new ReactiveGameStore();

// ✅ CORRECT - Use singleton
import { reactiveGameStore } from '$lib/stores/reactiveGameStore.svelte';
const store = reactiveGameStore;
```

### ⚠️ Common Mistakes

**Forgetting to Force Update**
```typescript
// ⚠️ PROBLEM - UI won't update
function applyRemoteAction(data) {
  gameState.doSomething(data);
  // Missing: store.forceUpdate();
}

// ✅ SOLUTION - Always call forceUpdate after mutations
function applyRemoteAction(data) {
  gameState.doSomething(data);
  store.forceUpdate(); // Triggers UI reactivity
}
```

**Not Handling ActionResult Errors**
```typescript
// ⚠️ PROBLEM - Silent failures
const result = store.placeBid(cards);
mpOrchestrator.broadcastBid(result.bidAmount); // Might be undefined!

// ✅ SOLUTION - Check success first
const result = store.placeBid(cards);
if (result.success) {
  mpOrchestrator.broadcastBid(result.bidAmount!);
} else {
  showToast(result.error!, 'error');
}
```

**Broadcasting Before Local Application**
```typescript
// ⚠️ PROBLEM - Race condition
mpOrchestrator.broadcastBid(amount);
store.placeBid(cards); // Local state behind remote

// ✅ SOLUTION - Apply locally first
const result = store.placeBid(cards);
if (result.success) {
  mpOrchestrator.broadcastBid(result.bidAmount!);
}
```


## 📁 File Location Guide

| Task | Primary File(s) | Layer |
|------|----------------|-------|
| **Modify game rules** | `src/lib/domain/*.ts` | Domain |
| **Add scoring logic** | `src/lib/domain/scoring.ts` | Domain |
| **Change card behavior** | `src/lib/domain/cards.ts`, `player.ts` | Domain |
| **Update main UI** | `src/routes/+page.svelte` | Component |
| **Create UI component** | `src/lib/components/*.svelte` | Component |
| **Manage game state** | `src/lib/stores/reactiveGameStore.svelte.ts` | Store |
| **Add game action** | `src/lib/orchestrators/GameOrchestrator.ts` | Orchestrator |
| **Handle multiplayer sync** | `src/lib/orchestrators/MultiplayerOrchestrator.ts` | Orchestrator |
| **Add event type** | `src/lib/multiplayer/events.ts` | Multiplayer |
| **Add feedback sound** | `src/lib/utils/feedback.ts` | Utils |
| **Modify relay server** | `relay-server.js` | Backend |
| **Update build config** | `vite.config.ts`, `svelte.config.js` | Config |
| **Write tests** | `src/tests/*.test.ts` | Tests |

### Directory Structure
```
src/lib/
├── domain/          # Pure game logic (no UI/framework)
│   ├── cards.ts
│   ├── player.ts
│   ├── gameState.ts
│   ├── auction.ts
│   └── scoring.ts
├── stores/          # Reactive state management
│   └── reactiveGameStore.svelte.ts
├── orchestrators/   # Action coordination
│   ├── GameOrchestrator.ts
│   └── MultiplayerOrchestrator.ts
├── multiplayer/     # Network sync
│   ├── service.ts
│   ├── events.ts
│   ├── serialization.ts
│   └── hostGuard.ts
├── components/      # UI components
│   ├── GameBoard.svelte
│   ├── AuctionPanel.svelte
│   ├── PlayerHand.svelte
│   └── ...
└── utils/           # Helpers
    ├── feedback.ts
    └── statistics.ts
```


## 🔍 Quick Reference Links

**Start Here:**
- [DOCUMENTATION-INDEX.md](./DOCUMENTATION-INDEX.md) - Complete documentation hub
- [AI-CONTEXT.md](./AI-CONTEXT.md) - This file (AI assistant guide)

**Architecture:**
- [MULTIPLAYER-ARCHITECTURE.md](./MULTIPLAYER-ARCHITECTURE.md) - Deep dive into multiplayer design
- [PROJECT-STRUCTURE.md](./PROJECT-STRUCTURE.md) - Detailed file structure explanation
- [ARCHITECTURE-USAGE-GUIDE.md](./ARCHITECTURE-USAGE-GUIDE.md) - How to use the architecture

**Game Design:**
- [20251001T142857_high-society-rules_*.md](./20251001T142857_high-society-rules_0b8224f9.md) - Official game rules
- [20251001T141917_high-society-coding-specification_*.md](./20251001T141917_high-society-coding-specification_1a93b170.md) - Implementation spec

**Deployment:**
- [QUICKSTART-MULTIPLAYER.md](./QUICKSTART-MULTIPLAYER.md) - How to run multiplayer locally
- [DEPLOY-RELAY-SERVER.md](./DEPLOY-RELAY-SERVER.md) - Production deployment guide

**Troubleshooting:**
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Known issues and solutions
- [TEST-ISSUES-SUMMARY.md](./TEST-ISSUES-SUMMARY.md) - Test suite issues

**Development:**
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
- [CHANGELOG.md](./CHANGELOG.md) - Version history

## 💡 Development Workflow

### Local Development
```powershell
# Terminal 1: Start relay server
cd C:\Users\Andrew\code\high-society
node relay-server.js
# Server runs on http://localhost:3000

# Terminal 2: Start dev server
npm run dev
# App runs on http://localhost:5173
```

### Testing Multiplayer Locally
1. Open multiple browser windows (or different browsers)
2. Navigate to `http://localhost:5173`
3. Create/join same room in each window
4. Use different player names
5. Start game when all players ready

### Running Tests
```powershell
# Run all tests
npm test

# Run specific test file
npm test -- auction-completion.test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Build for Production
```powershell
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

## 🎯 Decision Guide for AI Assistants

**When user asks to...**

| Request | Action | Files to Edit |
|---------|--------|---------------|
| "Fix a bug in bidding" | 1. Check domain logic first<br>2. Then check orchestrator<br>3. Finally check UI | `domain/auction.ts`<br>`GameOrchestrator.ts`<br>`AuctionPanel.svelte` |
| "Add new card type" | 1. Add to domain<br>2. Update scoring<br>3. Add UI rendering | `domain/cards.ts`<br>`domain/scoring.ts`<br>`components/*.svelte` |
| "Multiplayer not syncing" | 1. Check event definition<br>2. Check broadcast call<br>3. Check event handler | `multiplayer/events.ts`<br>`MultiplayerOrchestrator.ts`<br>Check `setupEventListeners()` |
| "UI not updating" | 1. Check if forceUpdate called<br>2. Check derived values<br>3. Check component reactivity | `reactiveGameStore.svelte.ts`<br>Component using `$derived` |
| "Add new UI screen" | 1. Create component<br>2. Add to +page.svelte<br>3. Add state management | `components/NewScreen.svelte`<br>`routes/+page.svelte`<br>`reactiveGameStore.svelte.ts` |

## 🔐 Security & Trust Model

**Client-Authoritative Architecture:**
- Game logic executes on each client
- No server-side validation
- Host player's state is source of truth
- Suitable for **trusted players only**

**Implications:**
- ✅ Simple architecture, low latency
- ✅ Relay server is stateless and scalable
- ❌ Players can cheat by modifying client code
- ❌ Not suitable for untrusted/competitive play

**For Untrusted Environments:**
Would need to add:
- Server-side game state
- Server validates all actions
- Server broadcasts authoritative state
- Client becomes "view only"

## � Testing Strategy

**Unit Tests (Domain Layer)**
- Test game rules in isolation
- Pure functions, easy to test
- No mocking needed
- Example: `scoring-and-endgame.test.ts`

**Integration Tests (Full Stack)**
- Test user flows end-to-end
- Mock multiplayer service
- Test component interactions
- Example: `full-game-playthrough.test.ts`

**Multiplayer Tests**
- Test event synchronization
- Test state consistency
- Mock network events
- Example: `multiplayer-sync.test.ts`

## 🎓 Learning Path for New Contributors

1. **Read game rules** → Understand what you're building
2. **Explore domain layer** → See pure game logic
3. **Check ReactiveGameStore** → Understand state management
4. **Review orchestrators** → See action coordination
5. **Study +page.svelte** → See how it all connects
6. **Run tests** → Verify understanding
7. **Make small change** → Test workflow

## 📊 Logging

**Always use standardized logging:**

```typescript
// Import context-specific logger
import { loggers } from '$lib/utils/logger';

// Domain layer
const log = loggers.domain.gameState;
log('startNewRound() called', { phase: 'auction', deckLength: 12 });

// Multiplayer
loggers.multiplayer.orchestrator('Broadcasting bid', { playerId: 'player-1', amount: 5000 });

// UI components
const componentLog = loggers.ui.component('AuctionPanel');
componentLog('Rendering auction', { cardName: 'Savoir Faire' });
```

**Log levels:**
- `DEBUG` - Development detail (default in dev)
- `INFO` - Important state changes
- `WARN` - Warnings (default in production)
- `ERROR` - Failures only

**Configuration:**
- Client: Set `VITE_LOG_LEVEL=DEBUG` in `.env`
- Server: `LOG_LEVEL=debug node relay-server.js`

**Never use `console.log` directly** - always use the logger.

See [docs/LOGGING.md](../docs/LOGGING.md) for complete documentation.

**Last Updated:** November 2025  
**Maintainer:** See CONTRIBUTING.md  
**Questions?** Check TROUBLESHOOTING.md first, then open an issue

---

## 📜 Historical Context

**November 2025 Refactoring:**
- Reduced `+page.svelte` from 2,846 → 822 lines (71% reduction)
- Created ReactiveGameStore, GameOrchestrator, MultiplayerOrchestrator
- Unified feedback system (audio + haptics)
- Generic Modal component
- Standardized logging system
- All 111 tests passing ✅

**Features Implemented:**
- Complete game rules (16 status cards, auction mechanics, scoring)
- WebSocket multiplayer (Socket.IO relay server)
- PWA (offline capable, installable)
- Turn timer (configurable auto-pass)
- Statistics tracking (localStorage)
- Settings modal (feedback preferences)

**Known Issues:**
- Client-authoritative design (trusted players only, no anti-cheat)
- No reconnection handling (Socket.IO auto-reconnects, but state must be resynced)
- No spectator mode
- No chat system

