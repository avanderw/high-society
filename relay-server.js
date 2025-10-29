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
// Structure: Map<roomId, Set<{socketId, playerId, playerName}>>
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
      const room = new Set([{
        socketId: socket.id,
        playerId,
        playerName
      }]);
      rooms.set(roomId, room);

      console.log(`🏠 Room created: ${roomId} by ${playerName} (${playerId})`);
      
      // Emit room:joined event to the creator as well
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

      const room = rooms.get(roomId);
      
      // Check if player already in room (reconnection)
      const existingPlayer = Array.from(room).find(p => p.playerId === playerId);
      if (existingPlayer) {
        // Update socket ID for reconnection
        room.delete(existingPlayer);
        room.add({ socketId: socket.id, playerId, playerName });
        console.log(`🔄 Player reconnected: ${playerName} to room ${roomId}`);
      } else {
        // New player joining
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
   * Leave a room
   * 
   * @param {Object} data - Leave data
   * @param {string} data.roomId - Room to leave
   * @param {string} data.playerId - Player's ID
   */
  socket.on('leave_room', ({ roomId, playerId }) => {
    try {
      if (!rooms.has(roomId)) return;

      const room = rooms.get(roomId);
      const player = Array.from(room).find(p => p.playerId === playerId);
      
      if (player) {
        room.delete(player);
        socket.leave(roomId);

        console.log(`👋 Player left: ${player.playerName} from room ${roomId}`);

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

    // Find and remove player from all rooms
    rooms.forEach((room, roomId) => {
      const player = Array.from(room).find(p => p.socketId === socket.id);
      
      if (player) {
        room.delete(player);
        
        console.log(`👋 Player disconnected: ${player.playerName} from room ${roomId}`);

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

    const room = rooms.get(roomId);
    callback({
      success: true,
      roomId,
      playerCount: room.size,
      players: Array.from(room).map(p => ({
        playerId: p.playerId,
        playerName: p.playerName
      }))
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
