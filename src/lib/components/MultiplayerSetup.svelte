<script lang="ts">
	import { getMultiplayerService } from '$lib/multiplayer/service';
	
	type Props = {
		onRoomReady: (roomId: string, playerId: string, playerName: string, isHost: boolean, players: Array<{ playerId: string; playerName: string }>) => void;
	};
	
	let { onRoomReady }: Props = $props();
	
	let mode = $state<'menu' | 'create' | 'join' | 'connecting'>('menu');
	let playerName = $state('');
	let roomCode = $state('');
	let isConnecting = $state(false);
	let errorMessage = $state('');
	let connectedPlayers = $state<Array<{ playerId: string; playerName: string }>>([]);
	let currentRoomId = $state('');
	let currentPlayerId = $state('');
	let isHost = $state(false);
	let connectionStatus = $state<'checking' | 'connected' | 'failed' | 'unknown'>('unknown');

	const multiplayerService = getMultiplayerService();

	async function checkConnection() {
		connectionStatus = 'checking';
		errorMessage = '';
		
		try {
			const isConnected = await multiplayerService.testConnection();
			connectionStatus = isConnected ? 'connected' : 'failed';
			
			if (!isConnected) {
				errorMessage = 'Cannot connect to multiplayer server. Please check that the server is running.';
			}
		} catch (error) {
			connectionStatus = 'failed';
			errorMessage = error instanceof Error ? error.message : 'Failed to connect to multiplayer server';
		}
	}

	// Check connection when component loads
	$effect(() => {
		if (mode === 'menu' && connectionStatus === 'unknown') {
			checkConnection();
		}
	});

	async function createRoom() {
		if (!playerName.trim()) {
			errorMessage = 'Please enter your name';
			return;
		}

		if (connectionStatus !== 'connected') {
			errorMessage = 'Not connected to multiplayer server';
			return;
		}

		isConnecting = true;
		errorMessage = '';

		try {
			// Connection should already be established from checkConnection
			if (!multiplayerService.isConnected()) {
				await multiplayerService.connect();
			}
			
			// Listen for player events BEFORE creating the room
			multiplayerService.on('room:joined', handlePlayerJoined);
			multiplayerService.on('room:left', handlePlayerLeft);
			
			const { roomId, playerId } = await multiplayerService.createRoom(playerName.trim());
			
			currentRoomId = roomId;
			currentPlayerId = playerId;
			isHost = true;
			// Don't set connectedPlayers manually - let the room:joined event handle it
			
			mode = 'create';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to create room';
		} finally {
			isConnecting = false;
		}
	}

	async function joinRoom() {
		if (!playerName.trim()) {
			errorMessage = 'Please enter your name';
			return;
		}
		
		if (!roomCode.trim()) {
			errorMessage = 'Please enter a room code';
			return;
		}

		if (connectionStatus !== 'connected') {
			errorMessage = 'Not connected to multiplayer server';
			return;
		}

		isConnecting = true;
		errorMessage = '';

		try {
			// Connection should already be established from checkConnection
			if (!multiplayerService.isConnected()) {
				await multiplayerService.connect();
			}
			
			// Listen for player events BEFORE joining the room
			multiplayerService.on('room:joined', handlePlayerJoined);
			multiplayerService.on('room:left', handlePlayerLeft);
			
			const result = await multiplayerService.joinRoom(roomCode.trim(), playerName.trim());
			
			currentRoomId = result.roomId;
			currentPlayerId = result.playerId;
			isHost = false;
			// Set initial player list from response, but room:joined events will keep it updated
			connectedPlayers = result.players || [];
			
			mode = 'join';
			
			// Notify parent that we're ready (this will setup game event listeners)
			onRoomReady(currentRoomId, currentPlayerId, playerName.trim(), false, connectedPlayers);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to join room';
			isConnecting = false;
			return;
		}
		
		isConnecting = false;
	}

	function handlePlayerJoined(event: any) {
		console.log('[MultiplayerSetup] ====== PLAYER JOINED EVENT ======');
		console.log('[MultiplayerSetup] Full event:', JSON.stringify(event, null, 2));
		console.log('[MultiplayerSetup] My current player ID:', currentPlayerId);
		console.log('[MultiplayerSetup] Event type:', event.type);
		console.log('[MultiplayerSetup] Event data:', event.data);
		console.log('[MultiplayerSetup] Event player ID:', event.data?.playerId);
		
		if (event.data && event.data.players) {
			console.log('[MultiplayerSetup] Updating player list from:', connectedPlayers);
			console.log('[MultiplayerSetup] Updating player list to:', event.data.players);
			connectedPlayers = event.data.players;
			console.log('[MultiplayerSetup] Player list updated!');
		} else {
			console.warn('[MultiplayerSetup] Event missing data.players:', event);
		}
	}

	function handlePlayerLeft(event: any) {
		connectedPlayers = connectedPlayers.filter(p => p.playerId !== event.data.playerId);
	}

	function startGame() {
		if (connectedPlayers.length < 2) {
			errorMessage = 'Need at least 2 players to start';
			return;
		}
		
		if (connectedPlayers.length > 5) {
			errorMessage = 'Maximum 5 players allowed';
			return;
		}

		onRoomReady(currentRoomId, currentPlayerId, playerName.trim(), isHost, connectedPlayers);
	}

	function leaveRoom() {
		multiplayerService.leaveRoom();
		multiplayerService.off('room:joined', handlePlayerJoined);
		multiplayerService.off('room:left', handlePlayerLeft);
		
		// Reset state
		mode = 'menu';
		currentRoomId = '';
		currentPlayerId = '';
		isHost = false;
		connectedPlayers = [];
		roomCode = '';
		errorMessage = '';
	}

	function copyRoomCode() {
		navigator.clipboard.writeText(currentRoomId);
	}
</script>

<article>
	<header>
		<h2>Multiplayer Setup</h2>
	</header>

	{#if errorMessage}
		<div role="alert" style="background-color: var(--pico-del-color); padding: 1rem; margin-bottom: 1rem; border-radius: var(--pico-border-radius);">
			<strong>Error:</strong> {errorMessage}
		</div>
	{/if}

	{#if mode === 'menu'}
		<div class="menu-container">
			{#if connectionStatus === 'checking'}
				<div class="connection-status checking">
					<div class="spinner"></div>
					<p>Checking multiplayer server connection...</p>
				</div>
			{:else if connectionStatus === 'failed'}
				<div class="connection-status failed">
					<p>❌ Multiplayer server is offline</p>
					<p class="help-text">
						To play online, you need to start the relay server:
						<br><code>node relay-server.js</code>
					</p>
					<button onclick={checkConnection} class="secondary">
						🔄 Retry Connection
					</button>
				</div>
			{:else if connectionStatus === 'connected'}
				<div class="connection-status connected">
					<p>✅ Connected to multiplayer server</p>
				</div>
				
				<p>Choose how to play:</p>
				
				<div class="button-group">
					<button 
						onclick={() => mode = 'create'} 
						disabled={isConnecting}
					>
						Create Room
					</button>
					
					<button 
						onclick={() => mode = 'join'}
						class="secondary"
						disabled={isConnecting}
					>
						Join Room
					</button>
				</div>
			{/if}
		</div>
	{:else if mode === 'create' && !currentRoomId}
		<div>
			<label>
				Your Name
				<input 
					type="text" 
					bind:value={playerName}
					placeholder="Enter your name"
					disabled={isConnecting}
				/>
			</label>

			<div class="button-group">
				<button 
					onclick={createRoom}
					disabled={isConnecting || !playerName.trim()}
				>
					{isConnecting ? 'Creating...' : 'Create Room'}
				</button>
				
				<button 
					onclick={() => mode = 'menu'}
					class="secondary"
					disabled={isConnecting}
				>
					Back
				</button>
			</div>
		</div>
	{:else if mode === 'create' && currentRoomId}
		<div class="room-lobby">
			<div class="room-code-display">
				<h3>Room Code</h3>
				<div class="code-box">
					<code>{currentRoomId}</code>
					<button 
						onclick={copyRoomCode}
						class="secondary"
						title="Copy to clipboard"
					>
						📋 Copy
					</button>
				</div>
				<p class="help-text">Share this code with other players</p>
			</div>

			<div class="player-list">
				<h4>Connected Players ({connectedPlayers.length}/5)</h4>
				<ul>
					{#each connectedPlayers as player}
						<li>
							{player.playerName}
							{#if player.playerId === currentPlayerId}
								<span class="badge">You</span>
							{/if}
						</li>
					{/each}
				</ul>
			</div>

			<div class="button-group">
				<button 
					onclick={startGame}
					disabled={connectedPlayers.length < 2 || connectedPlayers.length > 5}
				>
					Start Game ({connectedPlayers.length} players)
				</button>
				
				<button 
					onclick={leaveRoom}
					class="secondary"
				>
					Leave Room
				</button>
			</div>

			{#if connectedPlayers.length < 2}
				<p class="help-text">Waiting for at least 1 more player...</p>
			{/if}
		</div>
	{:else if mode === 'join' && !currentRoomId}
		<div>
			<label>
				Your Name
				<input 
					type="text" 
					bind:value={playerName}
					placeholder="Enter your name"
					disabled={isConnecting}
				/>
			</label>

			<label>
				Room Code
				<input 
					type="text" 
					bind:value={roomCode}
					placeholder="Enter room code"
					disabled={isConnecting}
				/>
			</label>

			<div class="button-group">
				<button 
					onclick={joinRoom}
					disabled={isConnecting || !playerName.trim() || !roomCode.trim()}
				>
					{isConnecting ? 'Joining...' : 'Join Room'}
				</button>
				
				<button 
					onclick={() => mode = 'menu'}
					class="secondary"
					disabled={isConnecting}
				>
					Back
				</button>
			</div>
		</div>
	{:else if mode === 'join' && currentRoomId}
		<div class="room-lobby">
			<div class="room-info">
				<h3>Room: {currentRoomId}</h3>
				<p class="help-text">Waiting for host to start the game...</p>
			</div>

			<div class="player-list">
				<h4>Connected Players ({connectedPlayers.length}/5)</h4>
				<ul>
					{#each connectedPlayers as player}
						<li>
							{player.playerName}
							{#if player.playerId === currentPlayerId}
								<span class="badge">You</span>
							{/if}
						</li>
					{/each}
				</ul>
			</div>

			<button 
				onclick={leaveRoom}
				class="secondary"
			>
				Leave Room
			</button>
		</div>
	{/if}
</article>

<style>
	.menu-container {
		text-align: center;
	}

	.connection-status {
		padding: 1rem;
		margin-bottom: 1.5rem;
		border-radius: var(--pico-border-radius);
		text-align: center;
	}

	.connection-status.checking {
		background-color: var(--pico-card-background-color);
		border: 1px solid var(--pico-muted-border-color);
	}

	.connection-status.connected {
		background-color: var(--pico-ins-color);
		color: var(--pico-contrast);
	}

	.connection-status.failed {
		background-color: var(--pico-del-color);
		color: var(--pico-contrast);
	}

	.connection-status .help-text {
		font-size: 0.9rem;
		margin-top: 0.5rem;
	}

	.connection-status code {
		background-color: rgba(0, 0, 0, 0.2);
		padding: 0.25rem 0.5rem;
		border-radius: var(--pico-border-radius);
		font-family: var(--pico-font-family-monospace);
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--pico-muted-color);
		border-top: 2px solid var(--pico-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 0.5rem;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.button-group {
		display: flex;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.button-group button {
		flex: 1;
	}

	.room-lobby {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.room-code-display {
		text-align: center;
	}

	.room-code-display h3 {
		margin-bottom: 0.5rem;
	}

	.code-box {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin: 1rem 0;
	}

	.code-box code {
		font-size: 2rem;
		font-weight: bold;
		padding: 0.5rem 1rem;
		background-color: var(--pico-code-background-color);
		border-radius: var(--pico-border-radius);
		letter-spacing: 0.2em;
	}

	.code-box button {
		margin: 0;
		padding: 0.5rem 1rem;
	}

	.help-text {
		color: var(--pico-muted-color);
		font-size: 0.9rem;
		margin-top: 0.5rem;
	}

	.player-list {
		background-color: var(--pico-card-background-color);
		padding: 1rem;
		border-radius: var(--pico-border-radius);
	}

	.player-list h4 {
		margin-bottom: 0.75rem;
	}

	.player-list ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.player-list li {
		padding: 0.5rem;
		margin-bottom: 0.25rem;
		background-color: var(--pico-background-color);
		border-radius: var(--pico-border-radius);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background-color: var(--pico-primary);
		color: var(--pico-primary-inverse);
		border-radius: var(--pico-border-radius);
		font-size: 0.8rem;
		font-weight: bold;
	}

	.room-info {
		text-align: center;
	}

	.room-info h3 {
		margin-bottom: 0.5rem;
	}
</style>
