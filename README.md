# High Society - Digital Card Game

A multiplayer digital implementation of Reiner Knizia's High Society auction card game.

**📖 [Documentation](./DOCUMENTATION-INDEX.md)** | **🚀 [Multiplayer Setup](./QUICKSTART-MULTIPLAYER.md)** | **🐛 [Troubleshooting](./TROUBLESHOOTING.md)** | **🤖 [AI Context](./AI-CONTEXT.md)**

## What is High Society?

An auction-based card game for 2-5 players where socialites bid on luxury items and prestige while avoiding disgrace. Accumulate the highest status without being cast out for having the least money.

## Features

✅ **Online Multiplayer** - WebSocket-based real-time play via Socket.IO  
✅ **Progressive Web App** - Install on desktop and mobile  
✅ **Complete Implementation** - 16 status cards, full auction mechanics, proper scoring  
✅ **Turn Timer** - Configurable auto-pass for idle players  
✅ **Clean Architecture** - Domain-driven design, fully type-safe  
✅ **Modern UI** - Pico CSS semantic styling  

## Quick Start

### Local Play
```powershell
npm install
npm run dev
```
Open `http://localhost:5173`

### Multiplayer
```powershell
# Terminal 1: Start relay server
node relay-server.js

# Terminal 2: Start game
npm run dev
```

Open multiple browser windows to `localhost:5173` and create/join the same room.

See [QUICKSTART-MULTIPLAYER.md](./QUICKSTART-MULTIPLAYER.md) for detailed instructions.

## How to Play

### Setup
- 2-5 players enter names
- Each player receives 11 money cards (values 1-12, minus one 6)
- 16 status cards are shuffled

### Gameplay
1. **Reveal Card** - New status card is revealed
2. **Auction** - Players bid using money cards OR pass
3. **Winner** - Highest bidder gets the card (or first to pass in disgrace auctions)
4. **Repeat** - Continue until 4 game-end trigger cards revealed

### Scoring
1. Calculate status: luxury total + prestige multipliers - passé - scandale divider
2. **Cast out** players with least money
3. **Winner** is remaining player with highest status
4. Tie-breaker: most money → highest luxury card

### Card Types

| Type | Effect |
|------|--------|
| **Luxury (1-10)** | Add value to status |
| **Prestige (×2, ×3)** | Multiply final status (stackable!) |
| **Faux Pas** | Discard highest luxury card |
| **Passé (-5)** | Subtract 5 from status |
| **Scandale (÷2)** | Divide final status by 2 |

**Game End Triggers:** 3× Prestige, 1× Scandale (green-bordered cards)

## Tech Stack

- **SvelteKit 5** - Svelte 5 runes (`$state`, `$derived`, `$effect`)
- **TypeScript** - Strict mode, full type safety
- **Pico CSS** - Semantic, classless styling
- **Socket.IO** - Real-time multiplayer
- **Vite** - Build tool
- **Vitest** - Testing (111 tests)

## Architecture

```
Domain Layer (Pure TypeScript)
  ↓ wrapped by
Store Layer (Svelte 5 Reactive)
  ↓ coordinated by
Orchestrator Layer (Game & Multiplayer)
  ↓ consumed by
Component Layer (UI)
```

**Key Principles:**
- Pure domain logic (no framework dependencies)
- Client-authoritative multiplayer (trusted players)
- Immutable state patterns
- Event-driven synchronization

See [PROJECT-STRUCTURE.md](./PROJECT-STRUCTURE.md) and [MULTIPLAYER-ARCHITECTURE.md](./MULTIPLAYER-ARCHITECTURE.md) for details.

## Development

```powershell
# Install dependencies
npm install

# Run tests
npm test
npm test -- --watch

# Build for production
npm run build
npm run preview
```

## Deployment

### Client (Static Site)
```powershell
npm run build  # Creates build/ folder
# Deploy build/ to any static host (Vercel, Netlify, GitHub Pages, etc.)
```

### Server (Relay)
```powershell
npm run package:relay  # Creates deployment package
# See DEPLOY-RELAY-SERVER.md for Docker deployment
```

**Auto-configuration:**
- `localhost` → `http://localhost:3000`
- `avanderw.co.za` → `https://high-society.avanderw.co.za`
- Override: Set `VITE_SOCKET_SERVER_URL` environment variable

## Documentation

| Document | Purpose |
|----------|---------|
| [AI-CONTEXT.md](./AI-CONTEXT.md) | **For AI** - Patterns, architecture, anti-patterns |
| [DOCUMENTATION-INDEX.md](./DOCUMENTATION-INDEX.md) | Documentation hub |
| [PROJECT-STRUCTURE.md](./PROJECT-STRUCTURE.md) | File organization |
| [MULTIPLAYER-ARCHITECTURE.md](./MULTIPLAYER-ARCHITECTURE.md) | Network design |
| [QUICKSTART-MULTIPLAYER.md](./QUICKSTART-MULTIPLAYER.md) | Multiplayer setup |
| [DEPLOY-RELAY-SERVER.md](./DEPLOY-RELAY-SERVER.md) | Production deployment |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development guide |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues |
| [CHANGELOG.md](./CHANGELOG.md) | Version history |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and contribution guidelines.

## Credits

**Game Design:** Dr. Reiner Knizia  
**Digital Implementation:** Built with SvelteKit 5 and Pico CSS

## License

Game design © Reiner Knizia. Digital implementation for educational purposes.
