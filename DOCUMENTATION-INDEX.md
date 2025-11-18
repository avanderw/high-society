# Documentation Index

## Quick Start

**New to the project?**
1. [README.md](./README.md) - Overview, features, installation
2. [QUICKSTART-MULTIPLAYER.md](./QUICKSTART-MULTIPLAYER.md) - Play multiplayer locally
3. [AI-CONTEXT.md](./AI-CONTEXT.md) - AI assistant development guide

## Core Documentation

### For Players
| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Game overview, features, how to play |
| [QUICKSTART-MULTIPLAYER.md](./QUICKSTART-MULTIPLAYER.md) | Step-by-step multiplayer setup |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions |

### For Developers
| Document | Purpose |
|----------|---------|
| [AI-CONTEXT.md](./AI-CONTEXT.md) | **Essential** - Patterns, architecture, anti-patterns for AI coding |
| [PROJECT-STRUCTURE.md](./PROJECT-STRUCTURE.md) | File organization and architecture layers |
| [MULTIPLAYER-ARCHITECTURE.md](./MULTIPLAYER-ARCHITECTURE.md) | Event-driven multiplayer design |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development setup and contribution guidelines |
| [CHANGELOG.md](./CHANGELOG.md) | Version history and changes |

### For Deployment
| Document | Purpose |
|----------|---------|
| [DEPLOY-RELAY-SERVER.md](./DEPLOY-RELAY-SERVER.md) | Production relay server deployment guide |

### Game Design Reference
| Document | Purpose |
|----------|---------|
| [20251001T142857_high-society-rules_*.md](./20251001T142857_high-society-rules_0b8224f9.md) | Official game rules |
| [20251001T141917_high-society-coding-specification_*.md](./20251001T141917_high-society-coding-specification_1a93b170.md) | Implementation specification |

## By Use Case

### "I want to play the game"
1. Install: `npm install`
2. For local play: `npm run dev` → open browser
3. For multiplayer: [QUICKSTART-MULTIPLAYER.md](./QUICKSTART-MULTIPLAYER.md)

### "I want to understand the code"
1. Read: [AI-CONTEXT.md](./AI-CONTEXT.md) - Architecture patterns
2. Review: [PROJECT-STRUCTURE.md](./PROJECT-STRUCTURE.md) - File organization
3. Explore: `src/lib/domain/` - Pure game logic (start here)

### "I want to contribute"
1. Read: [CONTRIBUTING.md](./CONTRIBUTING.md) - Development setup
2. Read: [AI-CONTEXT.md](./AI-CONTEXT.md) - Coding patterns
3. Run tests: `npm test`
4. Make changes and submit PR

### "I want to deploy"
1. Client: `npm run build` → deploy `build/` folder to static host
2. Server: Follow [DEPLOY-RELAY-SERVER.md](./DEPLOY-RELAY-SERVER.md)

### "Something's broken"
1. Check: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Run: `npm test` to verify
3. Check: GitHub issues

## Development Commands

```powershell
# Installation
npm install

# Development (2 terminals required for multiplayer)
node relay-server.js    # Terminal 1: Relay server (port 3000)
npm run dev             # Terminal 2: Dev server (port 5173)

# Testing
npm test                # Run all tests
npm test -- --watch     # Watch mode
npm test -- <file>      # Specific test file

# Production
npm run build           # Build optimized bundle
npm run preview         # Preview production build
```

## Documentation Philosophy

This project maintains **focused, relevant documentation**:

- **AI-CONTEXT.md** - Single source of truth for AI-assisted development
- **README.md** - Entry point for humans
- **Specialized docs** - Deep dives on specific topics (multiplayer, deployment, etc.)
- **No meta-docs** - Documentation about documentation is deleted
- **No historical artifacts** - Old refactoring plans/summaries are removed

All critical architecture information is preserved in AI-CONTEXT.md.
