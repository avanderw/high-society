# Troubleshooting Guide - High Society Multiplayer

Common issues and their solutions when running the multiplayer version of High Society.

## 🚨 Connection Issues

### "Failed to connect to server"

**Symptoms:**
- Can't create or join rooms
- Error message in browser console: `[Multiplayer] Connection error`

**Solutions:**

1. **Check relay server is running**
   ```powershell
   # You should see this in the relay server terminal:
   🎮 High Society Relay Server started on port 3000
   ```
   
   If not running:
   ```powershell
   node relay-server.js
   ```

2. **Verify server URL detection**
   The client automatically detects the relay server URL:
   - `localhost` → `http://localhost:3000`
   - `avanderw.co.za` → `https://high-society.avanderw.co.za`
   
   To override, create/edit `.env`:
   ```env
   VITE_SOCKET_SERVER_URL=http://localhost:3000
   ```
   
   After changing `.env`, restart dev server:
   ```powershell
   # Ctrl+C to stop, then:
   npm run dev
   ```

3. **Check port 3000 is available**
   ```powershell
   netstat -ano | findstr :3000
   ```
   
   If another process is using port 3000:
   - Kill the process, or
   - Change relay server port:
     ```powershell
     $env:PORT=3001; node relay-server.js
     ```
   - Update `.env`: `VITE_SOCKET_SERVER_URL=http://localhost:3001`

4. **Check firewall/antivirus**
   - Windows Firewall may block Node.js
   - Allow Node.js through firewall when prompted
   - Or temporarily disable to test

5. **Try different transport**
   - Edit `src/lib/multiplayer/service.ts` line 24:
   ```typescript
   transports: ['polling', 'websocket'],  // Try polling first
   ```

### "Connection timeout"

**Symptoms:**
- Loading indefinitely
- No error message
- Console shows reconnection attempts

**Solutions:**

1. **Restart both server and client**
   ```powershell
   # In relay server terminal: Ctrl+C
   node relay-server.js
   
   # In dev server terminal: Ctrl+C
   npm run dev
   ```

2. **Clear browser cache**
   - Hard refresh: `Ctrl+Shift+R`
   - Or clear all cache in browser settings

3. **Check network connectivity**
   ```powershell
   ping localhost
   # Should get replies
   ```

## 🏠 Room Issues

### "Room not found"

**Symptoms:**
- Error when trying to join room
- Room code appears valid

**Solutions:**

1. **Verify room code exactly**
   - Case-sensitive
   - No extra spaces
   - Use copy/paste instead of typing

2. **Check host is still connected**
   - If host closed browser, room is deleted
   - Host must stay connected until all players join

3. **Create new room**
   - Room may have expired
   - Host creates fresh room
   - All players rejoin

4. **Check relay server logs**
   ```
   🗑️  Room deleted: room-xxx (empty)
   ```
   This means room was cleaned up - create a new one

### "Room code not displaying"

**Symptoms:**
- After creating room, no code appears
- Blank code box

**Solutions:**

1. **Check browser console for errors**
   - Press F12 → Console tab
   - Look for red error messages

2. **Verify createRoom succeeded**
   - Should see in console:
   ```
   [Multiplayer] Connected to server
   [Multiplayer] Room created: room-xxx
   ```

3. **Try recreating room**
   - Leave and return to main menu
   - Create room again

## 🎮 Gameplay Issues

### "Not your turn!" error when it IS your turn

**Symptoms:**
- UI shows it's your turn
- Can't bid or pass
- Error message appears

**Solutions:**

1. **Refresh and check player IDs**
   - Press F12 → Console
   - Look for: `My Player ID: player-xxx`
   - Compare with current player in game state

2. **Restart game**
   - Host leaves room
   - All players rejoin
   - Start fresh game

3. **Check state synchronization**
   - All players should see same game state
   - If out of sync, everyone refresh

### Cards not synchronizing

**Symptoms:**
- Different players see different game state
- Bids not appearing for other players
- Cards in wrong hands

**Solutions:**

1. **Check all players on same version**
   - All must refresh to get latest code
   - `Ctrl+Shift+R` on all clients

2. **Verify relay server forwarding events**
   - Check relay server logs for event flow:
   ```
   📤 Event: BID_PLACED → room room-xxx
   ```

3. **Check browser console for errors**
   - On all clients, press F12
   - Look for JavaScript errors
   - Look for deserialization errors

4. **Test with network inspector**
   - F12 → Network tab → WS (WebSocket)
   - Should see messages flowing
   - If empty, connection issue

5. **Nuclear option - full restart**
   ```powershell
   # Stop relay server (Ctrl+C)
   # Stop dev server (Ctrl+C)
   # Start relay server
   node relay-server.js
   # Start dev server
   npm run dev
   # All players refresh browsers
   # Create new room
   ```

### Actions happening twice

**Symptoms:**
- Bid processes multiple times
- Cards disappearing unexpectedly

**Solutions:**

1. **Check for duplicate event listeners**
   - This is a bug in the code
   - Refresh browser to clear state

2. **Verify event handling skips own events**
   - Check console for duplicate events
   - Should see:
   ```
   === PLACE BID ===
   (local processing)
   ```
   But NOT also see:
   ```
   === RECEIVED BID ===
   (from same player)
   ```

## 🔧 Development Issues

### TypeScript errors after changes

**Symptoms:**
- Red squiggly lines in VSCode
- Build fails
- Type errors in console

**Solutions:**

1. **Restart TypeScript server**
   - VSCode: `Ctrl+Shift+P`
   - Type: "TypeScript: Restart TS Server"
   - Wait for initialization

2. **Check imports**
   ```typescript
   // Use correct imports
   import { GameState } from '$lib/domain/gameState';
   import { getMultiplayerService } from '$lib/multiplayer/service';
   ```

3. **Rebuild**
   ```powershell
   npm run build
   ```
   - Fix any errors shown

4. **Clean and reinstall**
   ```powershell
   rm -rf node_modules
   rm package-lock.json
   npm install
   ```

### Build fails

**Symptoms:**
- `npm run build` exits with error
- Production build doesn't work

**Solutions:**

1. **Check error message**
   - Read the specific error
   - Usually points to file and line

2. **Verify all files exist**
   ```powershell
   ls src/lib/multiplayer/
   # Should show: events.ts, service.ts, serialization.ts
   ```

3. **Check TypeScript configuration**
   - Ensure `tsconfig.json` is valid
   - No syntax errors

4. **Test in dev mode first**
   ```powershell
   npm run dev
   # If dev works but build fails, might be SSR issue
   ```

### PWA not updating

**Symptoms:**
- Made code changes
- Production build shows old version
- Service worker serving cached version

**Solutions:**

1. **Clear service worker**
   - F12 → Application tab
   - Service Workers → Unregister
   - Hard refresh: `Ctrl+Shift+R`

2. **Clear all cache**
   - F12 → Application tab
   - Clear storage → Clear site data

3. **Test in incognito**
   - Fresh session
   - No cached service worker

4. **Force update in code**
   - Edit `vite.config.ts`
   - Change version number or manifest

## 🌐 Deployment Issues

### Relay server works locally but not in production

**Symptoms:**
- Local multiplayer works fine
- Deployed version can't connect to relay server

**Solutions:**

1. **Check CORS configuration**
   - Relay server must allow your domain
   ```javascript
   // relay-server.js
   cors: {
     origin: "https://yourdomain.com",  // Not "*" in production
     methods: ["GET", "POST"]
   }
   ```

2. **Use HTTPS for production**
   - WebSocket over HTTP may be blocked
   - Deploy relay server with SSL certificate
   - The client auto-detects URLs for known domains:
     - `avanderw.co.za` → `https://high-society.avanderw.co.za`
   - For custom domains, set `.env`:
   ```env
   VITE_SOCKET_SERVER_URL=https://your-relay-server.com
   ```

3. **Check server logs**
   - Access your deployed server logs
   - Look for connection attempts
   - Look for CORS errors

4. **Verify environment variables**
   - Hosting platform may override PORT
   - Check platform documentation

### "Mixed Content" error in browser

**Symptoms:**
- Game on HTTPS can't connect to relay server
- Console shows mixed content error

**Solutions:**

1. **Use HTTPS for relay server**
   - WebSocket connection must match page protocol
   - HTTPS page → WSS (WebSocket Secure)
   - Deploy relay server with SSL

2. **Use same protocol for both**
   - Both HTTP (development only)
   - Or both HTTPS (production)

### Environment variables not working

**Symptoms:**
- `.env` changes not taking effect
- Wrong server URL used

**Solutions:**

1. **Prefix with VITE_**
   ```env
   VITE_SOCKET_SERVER_URL=http://localhost:3000  # ✅ Correct
   SOCKET_SERVER_URL=http://localhost:3000       # ❌ Won't work
   ```

2. **Restart dev server after .env changes**
   ```powershell
   # Ctrl+C then:
   npm run dev
   ```

3. **Rebuild for production**
   - `.env` is baked into build
   ```powershell
   npm run build
   ```

4. **Use platform environment variables**
   - For deployed apps, set via hosting platform:
     - Netlify: Site settings → Environment variables
     - Vercel: Project settings → Environment Variables
     - Heroku: Settings → Config Vars

## 📱 Mobile/Device Issues

### Can't join from mobile device

**Symptoms:**
- Mobile browser can't access game
- Different devices can't connect

**Solutions:**

1. **Use local network IP**
   ```powershell
   # Find your computer's IP
   ipconfig
   # Look for IPv4 Address: 192.168.x.x
   ```
   
   On mobile, navigate to:
   ```
   http://192.168.x.x:5173
   ```

2. **Ensure devices on same network**
   - Same WiFi network
   - Not separated by VLANs
   - No guest network isolation

3. **Check firewall allows incoming**
   - Windows Firewall may block
   - Allow Node.js on private networks

4. **Use dev server host option**
   ```powershell
   npm run dev -- --host
   # Shows network URL
   ```

### Touch controls not working

**Symptoms:**
- Can't select cards on mobile
- Buttons don't respond

**Solutions:**

1. **Use tap, not hold**
   - Quick tap on cards
   - Don't long-press

2. **Disable browser zoom**
   - Already disabled in app
   - Check meta viewport tag exists

3. **Update to latest browser**
   - Safari, Chrome, Firefox mobile
   - Latest versions have best support

## 🐛 General Debugging Tips

### Enable verbose logging

**Browser:**
```javascript
// In browser console (F12):
localStorage.debug = '*';
// Reload page
```

**Server:**
- Relay server already logs all events
- Check terminal where `node relay-server.js` runs

### Check WebSocket connection

**Browser Console:**
```javascript
// After connecting to multiplayer:
console.log('Socket:', multiplayerService);
console.log('Connected:', multiplayerService.isConnected());
```

### Inspect game state

**Browser Console:**
```javascript
// In +page.svelte, gameState is available
// You can inspect it in dev tools
```

### Network traffic inspection

1. Open DevTools (F12)
2. Network tab
3. Filter: WS (WebSocket)
4. Click on connection
5. See all messages sent/received

### Test relay server independently

```powershell
node test-relay.js
```

Should output:
```
✅ Client 1 connected
✅ Room created: test-room-xxx
✅ Client 2 connected
✅ Client 2 joined room
📨 Events received
✅ All tests passed!
```

## 📞 Getting Help

If none of these solutions work:

1. **Check browser console** (F12) for errors
2. **Check relay server logs** for errors
3. **Try different browser** (Chrome, Firefox, Edge)
4. **Try incognito/private mode**
5. **Restart everything** (computer, router, etc.)

### Report Issues

When reporting bugs, include:
- Browser and version
- Operating system
- Steps to reproduce
- Error messages (screenshots)
- Browser console output
- Relay server console output

## 🎯 Quick Checklist

Before asking for help, verify:

- [ ] Relay server is running
- [ ] `.env` file exists with correct URL
- [ ] Dev server is running
- [ ] Browser console has no errors
- [ ] Port 3000 is available
- [ ] Tried restarting everything
- [ ] Tried different browser
- [ ] Tried incognito mode
- [ ] All dependencies installed (`npm install`)
- [ ] Using same versions across all clients

---

Most issues are solved by restarting the relay server and clearing browser cache! 🔄
