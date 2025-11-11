# Contributing to High Society

## Development Setup

### Prerequisites
- Node.js v18 or higher
- npm (comes with Node.js)

### Installation
```powershell
# Clone the repository
git clone <repository-url>
cd high-society

# Install dependencies
npm install
npm install socket.io
```

### Running Locally

**Two terminals required for multiplayer:**

```powershell
# Terminal 1: Start relay server
node relay-server.js

# Terminal 2: Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

## Project Structure

See [PROJECT-STRUCTURE.md](./PROJECT-STRUCTURE.md) for detailed codebase organization.

**Quick overview:**
- `src/lib/domain/` - Game logic (pure TypeScript)
- `src/lib/multiplayer/` - Networking layer
- `src/lib/components/` - UI components (Svelte)
- `src/routes/` - Pages
- `relay-server.js` - WebSocket relay server

## Architecture

The project follows clean architecture principles:

1. **Domain Layer**: Pure game logic, no UI dependencies
2. **Multiplayer Layer**: WebSocket networking, state serialization
3. **UI Layer**: Svelte components with Pico CSS

See [MULTIPLAYER-ARCHITECTURE.md](./MULTIPLAYER-ARCHITECTURE.md) for details.

## Making Changes

### Adding Features

1. **Game Logic**: Add to `src/lib/domain/`
2. **Multiplayer Events**: Update `src/lib/multiplayer/events.ts`
3. **UI**: Create/modify components in `src/lib/components/`
4. **Pages**: Edit `src/routes/+page.svelte`

### Code Style

- **TypeScript**: Use strict typing, no `any`
- **Svelte 5**: Use runes (`$state`, `$derived`, `$effect`)
- **Formatting**: Follow existing code style
- **Comments**: Add for complex logic

### Testing

```powershell
# Test relay server
node test-relay.js

# Build (checks for TypeScript errors)
npm run build

# Preview production build
npm run preview
```

## Pull Request Process

1. Create a feature branch
2. Make your changes
3. Test locally (both local and multiplayer modes)
4. Ensure `npm run build` succeeds
5. Update documentation if needed
6. Submit pull request with clear description

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues.

## Questions?

Check the [DOCUMENTATION-INDEX.md](./DOCUMENTATION-INDEX.md) for all available documentation.
