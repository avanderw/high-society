# High Society - Card Game

A digital implementation of Reiner Knizia's High Society auction card game, built with SvelteKit 5 and Pico CSS.

**📖 [Documentation Index](./DOCUMENTATION-INDEX.md)** | **🚀 [Quick Start Guide](./QUICKSTART-MULTIPLAYER.md)** | **🐛 [Troubleshooting](./TROUBLESHOOTING.md)**

## Game Overview

High Society is an auction-based card game for 2-5 players where socialites bid on luxury items, prestige, and try to avoid disgrace while managing their money carefully. The goal is to accumulate the highest status without being cast out for having the least money.

## Features

- **Multiplayer**: WebSocket-based multiplayer via Socket.IO relay server
- **Progressive Web App (PWA)**: Installable on desktop and mobile devices
- **Clean Architecture**: Domain-driven design with clear separation of concerns
- **Full Game Implementation**: 
  - 16 status cards (10 luxury, 3 prestige, 3 disgrace)
  - Complete auction mechanics (regular and disgrace auctions)
  - Proper game end conditions and scoring
  - Cast out mechanics for poorest players
- **Modern UI**: Built with Pico CSS for semantic, accessible styling
- **Type-Safe**: Written in TypeScript with full type safety

## Tech Stack

- **SvelteKit 5** - Modern Svelte framework with runes ($state, $derived, $effect)
- **TypeScript** - Type-safe development
- **Pico CSS** - Minimal, semantic CSS framework
- **Vite** - Fast build tool

## Getting Started

### Installation

```sh
npm install
```

### Development

```sh
# Start the development server
npm run dev

# Open in browser
npm run dev -- --open
```

The game will be available at `http://localhost:5173`

### Building

```sh
# Create a production build
npm run build

# Preview the production build
npm run preview
```

## Multiplayer Setup

### Running the Relay Server

The game requires a WebSocket relay server for multiplayer functionality:

```sh
# Install Socket.IO (first time only)
npm install socket.io

# Start the relay server
node relay-server.js
```

The server will start on port 3000 by default. You can customize it:

```sh
# Use a different port
PORT=8080 node relay-server.js

# Restrict CORS origins
CORS_ORIGIN=https://yourdomain.com node relay-server.js
```

### Deploying the Relay Server

To deploy the relay server to a Docker environment on another machine:

```sh
# Package the relay server for deployment
npm run package:relay

# Or with options
node package-relay-server.js --output ./my-package --include-env
```

This creates a deployment package with:
- All necessary files (relay-server.js, Dockerfile, docker-compose.yml, etc.)
- A compressed ZIP file for easy transfer
- README.txt with quick deployment instructions

Copy the generated ZIP file to your Docker host and see **[DEPLOY-RELAY-SERVER.md](./DEPLOY-RELAY-SERVER.md)** for complete deployment instructions.

### Configuring the Client

Create a `.env` file in the project root:

```env
VITE_SOCKET_SERVER_URL=http://localhost:3000
```

For production, update this to your deployed relay server URL.

### Playing Multiplayer

1. **Host creates a room**:
   - Click "Create Room"
   - Share the room code with other players

2. **Players join the room**:
   - Enter the room code
   - Enter your name
   - Click "Join Room"

3. **Start the game**:
   - Once all players have joined, the host clicks "Start Game"

4. **Play**:
   - Take turns bidding on cards
   - Game state automatically synchronizes across all players

See [MULTIPLAYER-ARCHITECTURE.md](./MULTIPLAYER-ARCHITECTURE.md) for detailed architecture documentation.

## How to Play

1. **Setup**: Enter player names (2-5 players)
2. **Auction Rounds**: 
   - Each round reveals a status card
   - Players bid using their money cards
   - Highest bidder wins the card (or in disgrace auctions, first to pass takes it)
3. **Game End**: After 4 game-end trigger cards are revealed
4. **Scoring**: 
   - Players with the least money are cast out
   - Remaining player with highest status wins
   - Tie-breakers: money left, then highest luxury card

### Card Types

- **Luxury Cards (1-10)**: Add to your status score
- **Prestige Cards**: Double your status (stackable!)
- **Disgrace Cards**:
  - Faux Pas: Discard a luxury card
  - Passé: -5 status
  - Scandale: Halve your final status

## Project Structure

```
src/
├── lib/
│   ├── domain/          # Domain layer (game logic)
│   │   ├── cards.ts     # Card entities and types
│   │   ├── player.ts    # Player entity
│   │   ├── gameState.ts # Game state machine
│   │   ├── auction.ts   # Auction system
│   │   └── scoring.ts   # Scoring system
│   └── components/      # UI components
│       ├── GameSetup.svelte
│       ├── GameBoard.svelte
│       ├── AuctionPanel.svelte
│       ├── PlayerHand.svelte
│       ├── StatusDisplay.svelte
│       ├── ScoreBoard.svelte
│       └── LuxuryDiscardModal.svelte
└── routes/
    ├── +layout.svelte   # Root layout with Pico CSS
    └── +page.svelte     # Main game page
```

## Architecture

The game follows clean architecture principles with clear separation between domain logic and UI:

- **Domain Layer**: Pure business logic (cards, players, game state, auctions, scoring)
- **UI Layer**: Svelte components using Pico CSS for semantic styling
- **Type Safety**: Full TypeScript support throughout

### Key Design Patterns

- **State Machine**: Game phase transitions
- **Strategy Pattern**: Regular vs disgrace auctions
- **Command Pattern**: Status effects system

## Documentation

- [DOCUMENTATION-INDEX.md](./DOCUMENTATION-INDEX.md) - Documentation hub and quick reference
- [QUICKSTART-MULTIPLAYER.md](./QUICKSTART-MULTIPLAYER.md) - Quick start guide for multiplayer
- [MULTIPLAYER-ARCHITECTURE.md](./MULTIPLAYER-ARCHITECTURE.md) - Detailed architecture documentation
- [PROJECT-STRUCTURE.md](./PROJECT-STRUCTURE.md) - Codebase organization
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions
- [IMPLEMENTATION-SUMMARY.md](./IMPLEMENTATION-SUMMARY.md) - Complete implementation summary
- [CHANGELOG.md](./CHANGELOG.md) - Version history
- Game rules and specifications in root directory

## Testing

### Test the Relay Server

```powershell
# Start relay server
node relay-server.js

# In another terminal, run test script
node test-relay.js
```

The test script will simulate two clients connecting, creating/joining a room, and exchanging events.

## Credits

- Game Design: Dr. Reiner Knizia
- Digital Implementation: Built with ❤️ using SvelteKit and Pico CSS
