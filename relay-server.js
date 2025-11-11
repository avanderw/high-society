/**
 * High Society - WebSocket Relay Server
 * 
 * A minimal Socket.IO server that relays game events between clients.
 * This server does NOT manage game state - it only broadcasts events.
 * 
 * Usage:
 *   npm install socket.io
 *   node relay-server.js
 * 
 * Configuration:
 *   PORT - Server port (default: 3000)
 *   CORS_ORIGIN - Allowed origins (default: *)
 */

import { Server } from 'socket.io';

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Store rooms and their players
// Structure: Map<roomId, {players: Set<{socketId, playerId, playerName}>, inGame: boolean, disconnectedPlayerIds: Set<playerId>}>
const rooms = new Map();

const io = new Server(PORT, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
});

console.log(`🎮 High Society Relay Server started on port ${PORT}`);
console.log(`📡 CORS enabled for: ${CORS_ORIGIN}`);

io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  /**
   * Create a new game room
   * 
   * @param {Object} data - Room creation data
   * @param {string} data.roomId - Unique room identifier
   * @param {string} data.playerId - Player's unique ID
   * @param {string} data.playerName - Player's display name
   */
  socket.on('create_room', ({ roomId, playerId, playerName }, callback) => {
    try {
      if (rooms.has(roomId)) {
        callback({ 
          success: false, 
          error: `Room ${roomId} already exists` 
        });
        return;
      }

      // Create room and add creator
      socket.join(roomId);
      const roomData = {
        players: new Set([{
          socketId: socket.id,
          playerId,
          playerName
        }]),
        inGame: false,
        disconnectedPlayerIds: new Set()
      };
      rooms.set(roomId, roomData);

      console.log(`🏠 Room created: ${roomId} by ${playerName} (${playerId})`);
      
      // Emit room:joined event to the creator as well
      io.to(roomId).emit('room:joined', {
        type: 'PLAYER_JOINED',
        roomId,
        data: {
          playerId,
          playerName,
          players: Array.from(roomData.players).map(p => ({
            playerId: p.playerId,
            playerName: p.playerName
          }))
        }
      });
      
      callback({ 
        success: true, 
        roomId,
        playerId 
      });
    } catch (error) {
      console.error('❌ Error creating room:', error);
      callback({ 
        success: false, 
        error: error.message 
      });
    }
  });

  /**
   * Join an existing room
   * 
   * @param {Object} data - Join data
   * @param {string} data.roomId - Room to join
   * @param {string} data.playerId - Player's unique ID
   * @param {string} data.playerName - Player's display name
   */
  socket.on('join_room', ({ roomId, playerId, playerName }, callback) => {
    try {
      if (!rooms.has(roomId)) {
        callback({ 
          success: false, 
          error: `Room ${roomId} not found` 
        });
        return;
      }

      const roomData = rooms.get(roomId);
      const room = roomData.players;
      
      // Check if player already in room (reconnection)
      const existingPlayer = Array.from(room).find(p => p.playerId === playerId);
      if (existingPlayer) {
        // Update socket ID for reconnection
        room.delete(existingPlayer);
        room.add({ socketId: socket.id, playerId, playerName });
        roomData.disconnectedPlayerIds.delete(playerId);
        console.log(`🔄 Player reconnected: ${playerName} to room ${roomId}`);
      } else if (roomData.inGame && roomData.disconnectedPlayerIds.size === 0) {
        // Game is in progress and no disconnected slots available
        callback({
          success: false,
          error: 'Game is in progress with no available slots'
        });
        return;
      } else if (roomData.inGame && roomData.disconnectedPlayerIds.size > 0) {
        // Game in progress but there's a disconnected slot - take it over
        const disconnectedPlayerId = Array.from(roomData.disconnectedPlayerIds)[0];
        roomData.disconnectedPlayerIds.delete(disconnectedPlayerId);
        
        // Add new player with NEW player ID (they're taking over the slot)
        room.add({ socketId: socket.id, playerId, playerName });
        console.log(`🎮 Player taking over disconnected slot: ${playerName} in room ${roomId}`);
        
        // Note: The game logic will need to handle mapping this new player to the old game slot
      } else {
        // New player joining (lobby mode)
        if (room.size >= 5) {
          callback({
            success: false,
            error: 'Room is full (maximum 5 players)'
          });
          return;
        }
        room.add({ socketId: socket.id, playerId, playerName });
        console.log(`👋 Player joined: ${playerName} (${playerId}) → room ${roomId}`);
      }

      socket.join(roomId);

      // Notify all players in the room (including the joiner)
      io.to(roomId).emit('room:joined', {
        type: 'PLAYER_JOINED',
        roomId,
        data: {
          playerId,
          playerName,
          players: Array.from(room).map(p => ({
            playerId: p.playerId,
            playerName: p.playerName
          }))
        }
      });

      callback({ 
        success: true, 
        roomId,
        playerId,
        inGame: roomData.inGame,
        players: Array.from(room).map(p => ({
          playerId: p.playerId,
          playerName: p.playerName
        }))
      });
    } catch (error) {
      console.error('❌ Error joining room:', error);
      callback({ 
        success: false, 
        error: error.message 
      });
    }
  });

  /**
   * Rejoin a room with existing player ID (after disconnect)
   * 
   * @param {Object} data - Rejoin data
   * @param {string} data.roomId - Room to rejoin
   * @param {string} data.playerId - Player's unique ID (same as before)
   * @param {string} data.playerName - Player's display name
   */
  socket.on('rejoin_room', ({ roomId, playerId, playerName }, callback) => {
    try {
      if (!rooms.has(roomId)) {
        callback({ 
          success: false, 
          error: `Room ${roomId} not found - it may have been closed` 
        });
        return;
      }

      const roomData = rooms.get(roomId);
      const room = roomData.players;
      
      // Check if this player was in the room before
      const existingPlayer = Array.from(room).find(p => p.playerId === playerId);
      
      if (existingPlayer) {
        // Player is rejoining - update socket ID
        room.delete(existingPlayer);
        room.add({ socketId: socket.id, playerId, playerName });
        roomData.disconnectedPlayerIds.delete(playerId);
        console.log(`🔄 Player rejoined: ${playerName} (${playerId}) → room ${roomId}`);
      } else {
        // Player wasn't in this room - might have been removed
        // Add them back anyway for recovery
        room.add({ socketId: socket.id, playerId, playerName });
        roomData.disconnectedPlayerIds.delete(playerId);
        console.log(`🆕 Player rejoined (not found in room): ${playerName} → room ${roomId}`);
      }

      socket.join(roomId);

      // Notify all players in the room
      io.to(roomId).emit('room:joined', {
        type: 'PLAYER_REJOINED',
        roomId,
        data: {
          playerId,
          playerName,
          players: Array.from(room).map(p => ({
            playerId: p.playerId,
            playerName: p.playerName
          }))
        }
      });

      callback({ 
        success: true, 
        roomId,
        playerId,
        inGame: roomData.inGame,
        players: Array.from(room).map(p => ({
          playerId: p.playerId,
          playerName: p.playerName
        }))
      });
    } catch (error) {
      console.error('❌ Error rejoining room:', error);
      callback({ 
        success: false, 
        error: error.message 
      });
    }
  });

  /**
   * Leave a room
   * 
   * @param {Object} data - Leave data
   * @param {string} data.roomId - Room to leave
   * @param {string} data.playerId - Player's ID
   */
  socket.on('leave_room', ({ roomId, playerId }) => {
    try {
      if (!rooms.has(roomId)) return;

      const roomData = rooms.get(roomId);
      const room = roomData.players;
      const player = Array.from(room).find(p => p.playerId === playerId);
      
      if (player) {
        // Don't remove player from room if game is in progress - mark as disconnected
        if (roomData.inGame) {
          // Just update to remove socket, but keep player in room
          room.delete(player);
          roomData.disconnectedPlayerIds.add(playerId);
          socket.leave(roomId);
          
          console.log(`👋 Player left game (marked disconnected): ${player.playerName} from room ${roomId}`);
          
          // Notify remaining players
          io.to(roomId).emit('room:left', {
            type: 'PLAYER_LEFT',
            roomId,
            data: {
              playerId,
              playerName: player.playerName
            }
          });
        } else {
          // Game not started - remove player completely
          room.delete(player);
          socket.leave(roomId);

          console.log(`👋 Player left lobby: ${player.playerName} from room ${roomId}`);

          // If room is empty, delete it
          if (room.size === 0) {
            rooms.delete(roomId);
            console.log(`🗑️  Room deleted: ${roomId} (empty)`);
          } else {
            // Notify remaining players
            io.to(roomId).emit('room:left', {
              type: 'PLAYER_LEFT',
              roomId,
              data: {
                playerId,
                playerName: player.playerName
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Error leaving room:', error);
    }
  });

  /**
   * Broadcast a game event to all players in the room
   * 
   * @param {Object} event - Game event
   * @param {string} event.type - Event type (e.g., 'BID_PLACED')
   * @param {string} event.roomId - Target room
   * @param {Object} event.data - Event payload
   */
  socket.on('game_event', (event) => {
    try {
      if (!event.roomId || !event.type) {
        console.warn('⚠️  Invalid game event (missing roomId or type)');
        return;
      }

      if (!rooms.has(event.roomId)) {
        console.warn(`⚠️  Event for non-existent room: ${event.roomId}`);
        return;
      }

      // Mark room as in-game when GAME_STARTED event is broadcast
      if (event.type === 'game:GAME_STARTED') {
        const roomData = rooms.get(event.roomId);
        roomData.inGame = true;
        console.log(`🎮 Room ${event.roomId} is now in-game`);
      }

      // Log event (truncate large payloads)
      const dataStr = JSON.stringify(event.data);
      const truncated = dataStr.length > 100 
        ? dataStr.substring(0, 100) + '...' 
        : dataStr;
      console.log(`📤 Event: ${event.type} → room ${event.roomId} | ${truncated}`);

      // Broadcast to all players in the room (including sender)
      io.to(event.roomId).emit(event.type, event);
    } catch (error) {
      console.error('❌ Error broadcasting event:', error);
    }
  });

  /**
   * Handle client disconnect
   */
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);

    // Find and handle player disconnection from all rooms
    rooms.forEach((roomData, roomId) => {
      const room = roomData.players;
      const player = Array.from(room).find(p => p.socketId === socket.id);
      
      if (player) {
        // If game is in progress, keep player but mark as disconnected
        if (roomData.inGame) {
          room.delete(player);
          roomData.disconnectedPlayerIds.add(player.playerId);
          
          console.log(`👋 Player disconnected from game: ${player.playerName} from room ${roomId}`);
          
          // Notify remaining players
          io.to(roomId).emit('room:left', {
            type: 'PLAYER_LEFT',
            roomId,
            data: {
              playerId: player.playerId,
              playerName: player.playerName
            }
          });
        } else {
          // Lobby mode - remove player completely
          room.delete(player);
          
          console.log(`👋 Player disconnected from lobby: ${player.playerName} from room ${roomId}`);

          // If room is empty, delete it
          if (room.size === 0) {
            rooms.delete(roomId);
            console.log(`🗑️  Room deleted: ${roomId} (empty)`);
          } else {
            // Notify remaining players
            io.to(roomId).emit('room:left', {
              type: 'PLAYER_LEFT',
              roomId,
              data: {
                playerId: player.playerId,
                playerName: player.playerName
              }
            });
          }
        }
      }
    });
  });

  /**
   * Get room info (for debugging)
   */
  socket.on('get_room_info', ({ roomId }, callback) => {
    if (!rooms.has(roomId)) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    const roomData = rooms.get(roomId);
    callback({
      success: true,
      roomId,
      inGame: roomData.inGame,
      playerCount: roomData.players.size,
      disconnectedCount: roomData.disconnectedPlayerIds.size,
      players: Array.from(roomData.players).map(p => ({
        playerId: p.playerId,
        playerName: p.playerName
      })),
      disconnectedPlayerIds: Array.from(roomData.disconnectedPlayerIds)
    });
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  io.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  io.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});
