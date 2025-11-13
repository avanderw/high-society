# Quick Start Guide - Multiplayer High Society

This guide will help you get the multiplayer version of High Society up and running in minutes.

## Prerequisites

- Node.js installed (v18 or higher)
- A web browser
- Basic terminal/command line knowledge

## Step 1: Install Dependencies

```powershell
# Install all project dependencies (including socket.io for the relay server)
npm install
npm install socket.io
```

## Step 2: Start the Relay Server

Open a **new terminal window** and run:

```powershell
node relay-server.js
```

You should see:
```
🎮 High Society Relay Server started on port 3000
📡 CORS enabled for: *
```

Keep this terminal open - the server needs to run while you play.

## Step 3: Start the Game Client

In your **original terminal** (or a new one), run:

```powershell
npm run dev
```

The game will start at `http://localhost:5173`

## Step 4: Test Multiplayer Locally

### Option A: Multiple Browser Windows

1. Open `http://localhost:5173` in your browser
2. Click "Online Multiplayer" → "Create Room"
3. Enter your name (e.g., "Alice") → Click "Create Room"
4. **Copy the room code** that appears

5. Open a **new private/incognito window** (Ctrl+Shift+N in Chrome)
6. Go to `http://localhost:5173`
7. Click "Online Multiplayer" → "Join Room"
8. Enter a different name (e.g., "Bob") and paste the room code
9. Click "Join Room"

10. Back in the first window, click **"Start Game"** (host controls this)

11. Play! Each player can only act on their turn 🎯

### Option B: Multiple Devices on Same Network

1. Find your computer's local IP address:
   ```powershell
   ipconfig
   ```
   Look for "IPv4 Address" (something like `192.168.1.100`)

2. On your computer, create a room at `http://localhost:5173`

3. On another device (phone, tablet, another computer):
   - Go to `http://<YOUR-IP>:5173` (e.g., `http://192.168.1.100:5173`)
   - Join the room using the room code

4. Start playing!

## Understanding the UI

### Main Menu
- **🏠 Local Game**: Traditional pass-and-play on one device
- **🌐 Online Multiplayer**: Play with friends online

### Multiplayer Lobby
- **Room Code**: Share this with friends to let them join
- **Connected Players**: Shows who's in the room
- **Start Game**: Only the host (room creator) can start

### During Game
- **🌐 Multiplayer badge**: Shows you're in an online game
- **Room: [code]**: The current room code
- **🎯 Your Turn!**: Appears when it's your turn to act
- Only the current player can bid, pass, or discard

## Game Controls

### Your Turn
- **Select money cards** from your hand by clicking them
- **Bid**: Place your bid with selected cards
- **Pass**: Skip this auction (careful - can't undo!)

### Not Your Turn
- Watch other players' actions
- Your screen updates automatically as they play
- Can't select cards or make actions

## Troubleshooting

### "Failed to connect to server"
- Make sure the relay server is running (`node relay-server.js`)
- Check that port 3000 isn't being used by another program
- The client automatically detects the relay server URL:
  - On `localhost`: uses `http://localhost:3000`
  - On `avanderw.co.za`: uses `https://high-society.avanderw.co.za`
- You can override this by setting `VITE_SOCKET_SERVER_URL` in `.env`

### "Room not found"
- Double-check the room code (case-sensitive)
- Make sure the host hasn't left the room
- Room codes are only valid while at least one player is connected

### "Not your turn!"
- You can only act when it's your turn
- Wait for the **🎯 Your Turn!** badge to appear
- Check that you're the current player shown in the auction panel

### Player disconnected
- If a player closes their browser, they'll leave the game
- Room automatically cleans up when all players leave
- Currently, no reconnection support (coming soon!)

### Cards not syncing
- Refresh the page and rejoin the room
- Make sure all players are using the latest version
- Check browser console (F12) for errors

## Playing with Friends Over Internet

For playing with friends not on your local network, you'll need to:

1. **Deploy the relay server** to a cloud service:
   - Heroku, Railway, Fly.io, or any Node.js hosting
   - Or use ngrok for temporary testing: `ngrok http 3000`

2. **Configure the client** (if needed):
   - The client automatically detects relay servers:
     - `localhost` → `http://localhost:3000`
     - `avanderw.co.za` → `https://high-society.avanderw.co.za`
   - For custom domains, edit `.env`: `VITE_SOCKET_SERVER_URL=https://your-server.com`
   - Restart the dev server (`npm run dev`)

3. **Share your game URL** with friends:
   - They go to your deployed site or your ngrok URL
   - Create/join rooms as normal

## Production Deployment

### Deploy Relay Server

Example for Railway/Heroku:

```json
// package.json
{
  "scripts": {
    "start": "node relay-server.js"
  }
}
```

Set environment variable:
- `PORT`: Server will use this port (default: 3000)
- `CORS_ORIGIN`: Your game's URL (e.g., https://yourgame.com)

### Deploy Game Client

```powershell
# Build for production
npm run build

# Deploy the 'build' folder to:
# - GitHub Pages
# - Netlify
# - Vercel
# - Any static hosting
```

The client automatically detects relay server URLs based on hostname:
- `localhost` → `http://localhost:3000`
- `avanderw.co.za` → `https://high-society.avanderw.co.za`

For custom domains, set `.env` before building:
```env
VITE_SOCKET_SERVER_URL=https://your-relay-server.com
```

## Architecture Notes

- **Client-side game logic**: Each player runs the full game in their browser
- **Relay server**: Only broadcasts events, doesn't validate moves
- **Trust model**: Assumes players aren't cheating (suitable for friends)
- **State sync**: All clients replay the same actions to stay in sync

For untrusted environments, consider adding server-side validation (see `MULTIPLAYER-ARCHITECTURE.md`).

## Next Steps

- Read `MULTIPLAYER-ARCHITECTURE.md` for technical details
- Check `relay-server.js` to customize server behavior
- Modify `src/lib/multiplayer/` to add features
- Deploy to production to play with remote friends!

## Getting Help

- Check browser console (F12) for detailed logs
- Server logs show all events and connections
- Look for `[Multiplayer]` prefixed messages in console

Enjoy playing High Society with friends! 🎩💎🥂
