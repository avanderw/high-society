# High Society - Card Game

A digital implementation of Reiner Knizia's High Society auction card game, built with SvelteKit 5 and Pico CSS.

## Game Overview

High Society is an auction-based card game for 2-5 players where socialites bid on luxury items, prestige, and try to avoid disgrace while managing their money carefully. The goal is to accumulate the highest status without being cast out for having the least money.

## Features

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

## Credits

- Game Design: Dr. Reiner Knizia
- Digital Implementation: Built with ❤️ using SvelteKit and Pico CSS
