# Logging System Documentation

## Overview

The project uses a standardized logging utility (`src/lib/utils/logger.ts`) to provide consistent, structured logging across the application.

## Log Levels

```typescript
enum LogLevel {
  DEBUG = 0,  // Detailed debug information
  INFO = 1,   // General informational messages
  WARN = 2,   // Warning messages
  ERROR = 3,  // Error messages
  NONE = 4    // Disable all logging
}
```

## Configuration

### Client-Side (Browser)

Set log level via environment variable in `.env`:
```env
VITE_LOG_LEVEL=DEBUG  # or INFO, WARN, ERROR, NONE
```

**Default behavior:**
- Development: `DEBUG` (all logs shown)
- Production: `WARN` (only warnings and errors)

### Server-Side (Relay Server)

Set log level via environment variable:
```bash
LOG_LEVEL=info node relay-server.js
```

Options: `debug`, `info`, `warn`, `error`

**Default:** `info`

## Usage

### Using Context-Specific Loggers

```typescript
import { loggers } from '$lib/utils/logger';

// Domain layer
loggers.domain.gameState('Starting new round', { 
  phase: 'auction', 
  playerCount: 3 
});

// Multiplayer
loggers.multiplayer.orchestrator('Broadcasting bid', { 
  playerId: 'player-1', 
  amount: 5000 
});

// UI components
const log = loggers.ui.component('AuctionPanel');
log('Rendering auction UI', { cardName: 'Savoir Faire' });
```

### Using Direct Logger

```typescript
import { logger } from '$lib/utils/logger';

logger.debug('GameState', 'Processing bid', { amount: 1000 });
logger.info('UI', 'Game started', { players: ['Alice', 'Bob'] });
logger.warn('Multiplayer', 'Reconnection required');
logger.error('API', 'Connection failed', new Error('Timeout'));
```

### Grouped Logs

```typescript
logger.group('Auction Complete', () => {
  logger.debug('Auction', 'Winner determined', { winnerId: 'player-1' });
  logger.debug('Auction', 'Money discarded', { amount: 3000 });
  logger.debug('Auction', 'Card awarded', { card: 'Prestige' });
});
```

## Log Format

All logs follow this format:
```
[HH:MM:SS] [Context] Message {data}
```

**Example:**
```
[14:32:15] [GameState] startNewRound() called { phase: 'auction', deckLength: 12 }
[14:32:15] [MultiplayerOrchestrator] Broadcasting bid { playerId: 'player-1', amount: 5000 }
```

## Available Context Loggers

### Domain Layer
- `loggers.domain.gameState` - GameState operations
- `loggers.domain.auction` - Auction mechanics
- `loggers.domain.player` - Player actions
- `loggers.domain.scoring` - Scoring calculations

### Multiplayer Layer
- `loggers.multiplayer.service` - WebSocket service
- `loggers.multiplayer.orchestrator` - Event synchronization
- `loggers.multiplayer.serialization` - State serialization

### UI Layer
- `loggers.ui.page` - Main page component
- `loggers.ui.component(name)` - Specific components

### Relay Server
- `log.debug(msg, data)` - Debug information
- `log.info(msg, data)` - General information
- `log.warn(msg, data)` - Warnings
- `log.error(msg, error)` - Errors

## Best Practices

### ✅ DO

```typescript
// Use structured data objects
log('Player action', { playerId: 'player-1', action: 'bid', amount: 1000 });

// Log at appropriate levels
logger.debug('Context', 'Detailed debug info');  // Development only
logger.info('Context', 'Important state change');  // Production-worthy
logger.warn('Context', 'Unexpected but handled');  // Potential issues
logger.error('Context', 'Operation failed', error);  // Failures

// Use context-specific loggers
loggers.domain.gameState('Operation', data);  // Clear context
```

### ❌ DON'T

```typescript
// Don't use console.log directly
console.log('Player bid');  // ❌ Use logger instead

// Don't log sensitive data
log('User data', { password: '12345' });  // ❌ Security risk

// Don't use string concatenation
log('Player ' + playerId + ' bid ' + amount);  // ❌ Use structured data

// Don't over-log in tight loops
for (let i = 0; i < 10000; i++) {
  log('Processing item', i);  // ❌ Performance impact
}
```

## Debugging Tips

### Enable Debug Logs in Production

Temporarily enable debug logging in browser console:
```javascript
// In browser console
import { logger } from './utils/logger';
logger.setLevel('DEBUG');
```

### Filter Logs by Context

Use browser console filtering:
```
[GameState]      # Show only GameState logs
[Multiplayer     # Show all multiplayer logs
```

### Capture Logs for Bug Reports

```javascript
// Collect logs for support
const logs = [];
const originalLog = console.log;
console.log = (...args) => {
  logs.push(args);
  originalLog.apply(console, args);
};

// Reproduce issue, then:
copy(logs);  // Copy to clipboard
```

## Migration from Old Logging

Old pattern:
```typescript
console.log('[GameState.startNewRound] CALLED - phase:', this.phase);
```

New pattern:
```typescript
import { loggers } from '$lib/utils/logger';
const log = loggers.domain.gameState;

log('startNewRound() called', { phase: this.phase });
```

## Performance Considerations

- **Production builds**: Automatically reduce to WARN level
- **Structured data**: Objects are only stringified if log level permits
- **Conditional logging**: Checks log level before expensive operations
- **No-op in production**: DEBUG logs are completely skipped

## Testing

Logs can be captured in tests:
```typescript
import { logger } from '$lib/utils/logger';

test('should log important events', () => {
  const logs = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    logs.push(args);
  });
  
  // Run test...
  
  expect(logs).toContainEqual(
    expect.arrayContaining(['[GameState]', 'Game ended'])
  );
  
  spy.mockRestore();
});
```

## Relay Server Logging

The relay server uses a simplified version:

```javascript
// Set log level
LOG_LEVEL=debug node relay-server.js

// Available methods
log.debug(msg, data);   // Detailed trace information
log.info(msg, data);    // General events (default)
log.warn(msg, data);    // Warnings
log.error(msg, error);  // Errors
```

**Common log messages:**
- `Client connected: ${socketId}`
- `Room created: ${roomId}`
- `Player joined: ${playerName}`
- `Player left: ${playerName}`
- `Room deleted: ${roomId}`

## Future Enhancements

Potential improvements:
- Remote log aggregation (e.g., Sentry, LogRocket)
- Log persistence in browser localStorage
- Performance metrics tracking
- User session correlation
- Log export functionality
