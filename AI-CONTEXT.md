# AI Development Context

Quick reference for AI assistants working on this High Society card game implementation.

## 🎯 Project Core

**What**: Digital multiplayer implementation of Reiner Knizia's High Society auction card game  
**Stack**: SvelteKit 5 + TypeScript + Pico CSS + Socket.IO  
**Architecture**: Clean architecture with domain-driven design

## 🏗️ Critical Architecture Rules

### Domain Layer (`src/lib/domain/`)
- **Pure TypeScript** - No Svelte, no UI dependencies
- **Immutable by default** - Create new objects, don't mutate
- **Self-contained** - Each module should work standalone
- Files: `cards.ts`, `player.ts`, `gameState.ts`, `auction.ts`, `scoring.ts`

### UI Layer (`src/lib/components/`)
- **Svelte 5 runes only** - Use `$state`, `$derived`, `$effect` (not `writable` stores)
- **Pico CSS semantic HTML** - Use `<article>`, `<section>`, proper roles
- **Props via `$props()`** - Typed destructuring, not `export let`

### Multiplayer Layer (`src/lib/multiplayer/`)
- **Client-authoritative** - No server-side game logic
- **Event-driven sync** - Broadcast actions, apply locally
- **Deterministic** - Same inputs must produce same state

## 🔑 Key Patterns

### State Management (Svelte 5)
```typescript
// ✅ Correct
let gameState = $state(new GameState());
let players = $derived(gameState.getPlayers());

// ❌ Wrong - don't use Svelte 4 stores
import { writable } from 'svelte/store';
```

### Event Broadcasting
```typescript
// 1. Apply action locally
const result = auction.processBid(player, cards);

// 2. Broadcast to others
multiplayerService.broadcastEvent(GameEventType.BID_PLACED, data);

// 3. Trigger reactivity
updateCounter++;
```

### Component Props
```typescript
// ✅ Correct
let { player, onAction } = $props<{ 
  player: Player; 
  onAction: () => void 
}>();

// ❌ Wrong
export let player: Player;
export let onAction: () => void;
```

## 🎮 Game Logic Essentials

### Card Types
- **Luxury** (1-10): Add to status
- **Prestige** (×2, ×2, ×2): Multiply status (stackable)
- **Disgrace**: Faux Pas (discard luxury), Passé (-5), Scandale (÷2)

### Game End Triggers
Game ends when **4th green-background card** revealed:
- 3 Prestige cards
- 1 Scandale card

### Scoring Order
1. Sum luxury cards
2. Apply Passé (-5)
3. Apply Prestige (multiply by 2 for each)
4. Apply Scandale (divide by 2)
5. Cast out players with least money
6. Winner: Highest status (tie-breaker: most money → highest luxury)

## 🛠️ Common Tasks

### Adding New Event Type
1. Add to `GameEventType` enum in `events.ts`
2. Define payload interface
3. Create event creator function
4. Add broadcaster in UI component
5. Add listener in `+page.svelte`

### Adding New UI Component
1. Create in `src/lib/components/`
2. Use Pico CSS classes (minimal custom CSS)
3. Accept typed props via `$props()`
4. Emit events via callback props

### Modifying Game Logic
1. Update domain layer first (`src/lib/domain/`)
2. Write/update tests if complex
3. Update UI to reflect changes
4. Update multiplayer events if needed

## 🚨 Common Pitfalls

### ❌ Don't Do
- Mutate objects directly (use spread/new instances)
- Mix UI logic in domain layer
- Use Svelte 4 patterns (`writable`, `export let`)
- Add server-side game validation (client-authoritative design)
- Forget to increment `updateCounter` after state changes
- Serialize the status deck (prevents cheating)

### ✅ Do
- Keep domain logic pure and testable
- Use semantic HTML with Pico CSS
- Follow event-driven multiplayer pattern
- Test locally with multiple browser windows
- Check `TROUBLESHOOTING.md` for known issues

## 📁 File Location Guide

| Need to... | Edit... |
|------------|---------|
| Change game rules | `src/lib/domain/*.ts` |
| Update UI | `src/lib/components/*.svelte` |
| Add multiplayer event | `src/lib/multiplayer/events.ts` |
| Modify relay server | `relay-server.js` |
| Change main game flow | `src/routes/+page.svelte` |
| Update build/deploy | `vite.config.ts`, `relay-server.js` |

## 🔍 Quick References

**Documentation Hub**: [DOCUMENTATION-INDEX.md](./DOCUMENTATION-INDEX.md)  
**Architecture Deep Dive**: [MULTIPLAYER-ARCHITECTURE.md](./MULTIPLAYER-ARCHITECTURE.md)  
**File Structure**: [PROJECT-STRUCTURE.md](./PROJECT-STRUCTURE.md)  
**Game Rules**: [20251001T142857_high-society-rules_*.md](./20251001T142857_high-society-rules_0b8224f9.md)  
**Issues & Fixes**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

## 💡 Development Commands

```powershell
# Start development (2 terminals)
node relay-server.js    # Terminal 1: Relay server (port 3000)
npm run dev             # Terminal 2: Dev server (port 5173)

# Test multiplayer locally
# Open multiple browser windows to localhost:5173

# Build production
npm run build
npm run preview
```

## 🎯 When Stuck

1. **Game logic issue?** → Check domain layer tests and game rules doc
2. **UI not updating?** → Did you increment `updateCounter`?
3. **Multiplayer sync issue?** → Check event broadcast/listener pair
4. **TypeScript error?** → Ensure using Svelte 5 patterns, not Svelte 4
5. **Styling issue?** → Use Pico CSS semantic HTML first, custom CSS last

## 🔐 Security Note

**Client-authoritative design** = suitable for trusted players only. Players can modify local state. For untrusted environments, server-side validation would be needed (not currently implemented).
