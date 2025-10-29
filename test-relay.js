/**
 * Simple test script for the relay server
 * 
 * Usage:
 *   1. Start relay server: node relay-server.js
 *   2. In another terminal: node test-relay.js
 * 
 * This will simulate two players connecting and sending events.
 */

import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';

console.log('🧪 Testing relay server...\n');

// Create two test clients
const client1 = io(SERVER_URL, { transports: ['websocket'] });
const client2 = io(SERVER_URL, { transports: ['websocket'] });

let roomId = '';
const playerId1 = 'test-player-1';
const playerId2 = 'test-player-2';

// Client 1 - Create room
client1.on('connect', () => {
	console.log('✅ Client 1 connected');
	
	roomId = `test-room-${Date.now()}`;
	
	client1.emit('create_room', { 
		roomId, 
		playerId: playerId1, 
		playerName: 'Alice' 
	}, (response) => {
		if (response.success) {
			console.log(`✅ Room created: ${roomId}`);
			
			// Now connect client 2
			setTimeout(() => {
				console.log('\n📞 Client 2 joining...');
				client2.emit('join_room', { 
					roomId, 
					playerId: playerId2, 
					playerName: 'Bob' 
				}, (response) => {
					if (response.success) {
						console.log('✅ Client 2 joined room');
						
						// Test event broadcasting
						setTimeout(() => {
							console.log('\n📤 Testing event broadcast...');
							client1.emit('game_event', {
								type: 'BID_PLACED',
								roomId,
								playerId: playerId1,
								timestamp: Date.now(),
								data: {
									playerId: playerId1,
									playerName: 'Alice',
									moneyCardIds: ['card-1', 'card-2'],
									totalBid: 5
								}
							});
						}, 500);
					} else {
						console.error('❌ Failed to join room:', response.error);
						cleanup();
					}
				});
			}, 500);
		} else {
			console.error('❌ Failed to create room:', response.error);
			cleanup();
		}
	});
});

// Client 2 - Listen for room joined
client2.on('connect', () => {
	console.log('✅ Client 2 connected');
});

client2.on('room:joined', (event) => {
	console.log('📨 Client 2 received room:joined event');
	console.log('   Players:', event.data.players.map(p => p.playerName).join(', '));
});

// Both clients listen for game events
client1.on('BID_PLACED', (event) => {
	console.log('📨 Client 1 received BID_PLACED event');
	console.log('   Player:', event.data.playerName);
	console.log('   Bid:', event.data.totalBid);
});

client2.on('BID_PLACED', (event) => {
	console.log('📨 Client 2 received BID_PLACED event');
	console.log('   Player:', event.data.playerName);
	console.log('   Bid:', event.data.totalBid);
	
	// Test complete, cleanup
	setTimeout(() => {
		console.log('\n✅ All tests passed!');
		cleanup();
	}, 500);
});

// Error handling
client1.on('connect_error', (error) => {
	console.error('❌ Client 1 connection error:', error.message);
	cleanup();
});

client2.on('connect_error', (error) => {
	console.error('❌ Client 2 connection error:', error.message);
	cleanup();
});

function cleanup() {
	console.log('\n🧹 Cleaning up...');
	client1.disconnect();
	client2.disconnect();
	
	setTimeout(() => {
		console.log('👋 Done!');
		process.exit(0);
	}, 500);
}

// Timeout if test takes too long
setTimeout(() => {
	console.error('\n❌ Test timeout - relay server may not be running');
	console.log('💡 Make sure to run: node relay-server.js');
	cleanup();
}, 10000);
