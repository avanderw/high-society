<script lang="ts">
	import { getMultiplayerService } from '$lib/multiplayer/service';
	import { GameEventType, type GameEvent } from '$lib/multiplayer/events';
	
	type Props = {
		onRoomReady: (roomId: string, playerId: string, playerName: string, isHost: boolean, players: Array<{ playerId: string; playerName: string }>) => void;
	};
	
	let { onRoomReady }: Props = $props();
	
	let mode = $state<'menu' | 'create' | 'join'>('menu');
	let playerName = $state('');
	let roomCode = $state('');
	let isConnecting = $state(false);
	let errorMessage = $state('');
	let connectedPlayers = $state<Array<{ playerId: string; playerName: string }>>([]);
	let currentRoomId = $state('');
	let currentPlayerId = $state('');
	let isHost = $state(false);
	let placeholderName = $state('');

	const multiplayerService = getMultiplayerService();

	// Random name generator
	const randomNames = [
		'Baron von Bling', 'Duchess Diamond', 'Count Cashmore', 'Lady Luxe',
		'Sir Spendwell', 'Princess Prestige', 'Duke Dapper', 'Madame Moneybags',
		'Lord Lavish', 'Baroness Bling', 'Captain Cash', 'Miss Fortune',
		'Earl Elegant', 'Countess Couture', 'Sir Status', 'Lady Lush',
		'Baron Bountiful', 'Duchess Decadent', 'Lord Luxury', 'Miss Magnificent'
	];

	function generateRandomPlaceholder() {
		const randomIndex = Math.floor(Math.random() * randomNames.length);
		placeholderName = randomNames[randomIndex];
	}

	// Generate initial placeholder name
	generateRandomPlaceholder();

	async function createRoom() {
		// Use placeholder if no name entered
		const finalName = playerName.trim() || placeholderName;
		
		if (!finalName) {
			errorMessage = 'Please enter your name';
			return;
		}

		isConnecting = true;
		errorMessage = '';

		try {
			await multiplayerService.connect();
			
			// Listen for player events BEFORE creating the room
			multiplayerService.on('room:joined', handlePlayerJoined);
			multiplayerService.on('room:left', handlePlayerLeft);
			
			// Listen for game start event (for when we transition to game)
			multiplayerService.on(GameEventType.GAME_STARTED, handleGameStarted);
			
			const { roomId, playerId } = await multiplayerService.createRoom(finalName);
			
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
		// Use placeholder if no name entered
		const finalName = playerName.trim() || placeholderName;
		
		if (!finalName) {
			errorMessage = 'Please enter your name';
			return;
		}
		
		if (!roomCode.trim()) {
			errorMessage = 'Please enter a room code';
			return;
		}

		isConnecting = true;
		errorMessage = '';

		try {
			await multiplayerService.connect();
			
			// Listen for player events BEFORE joining the room
			multiplayerService.on('room:joined', handlePlayerJoined);
			multiplayerService.on('room:left', handlePlayerLeft);
			
			// Listen for game start event (critical for clients)
			multiplayerService.on(GameEventType.GAME_STARTED, handleGameStarted);
			
			const result = await multiplayerService.joinRoom(roomCode.trim(), finalName);
			
			currentRoomId = result.roomId;
			currentPlayerId = result.playerId;
			isHost = false;
			// Set initial player list from response, but room:joined events will keep it updated
			connectedPlayers = result.players || [];
			
			mode = 'join';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to join room';
			isConnecting = false;
			return;
		}
		
		isConnecting = false;
	}

	function handlePlayerJoined(event: any) {
		console.log('[MultiplayerSetup] Player joined event received:', event);
		console.log('[MultiplayerSetup] My current player ID:', currentPlayerId);
		console.log('[MultiplayerSetup] Event player ID:', event.data?.playerId);
		if (event.data && event.data.players) {
			console.log('[MultiplayerSetup] Updating player list:', event.data.players);
			connectedPlayers = event.data.players;
		} else {
			console.warn('[MultiplayerSetup] Event missing data.players:', event);
		}
	}

	function handlePlayerLeft(event: any) {
		connectedPlayers = connectedPlayers.filter(p => p.playerId !== event.data.playerId);
	}

	function handleGameStarted(event: GameEvent) {
		console.log('[MultiplayerSetup] GAME_STARTED event received, transitioning to game');
		console.log('[MultiplayerSetup] Event data:', event.data);
		console.log('[MultiplayerSetup] I am host:', isHost);
		
		// CRITICAL: Don't call onRoomReady here, as it may trigger startGame again
		// Just transition to the game view - the +page.svelte listener will handle the game state
		if (!isHost) {
			// For clients only, call onRoomReady to transition
			const finalName = playerName.trim() || placeholderName;
			onRoomReady(currentRoomId, currentPlayerId, finalName, isHost, connectedPlayers);
		}
		// For host, onRoomReady was already called when they clicked "Start Game"
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

		const finalName = playerName.trim() || placeholderName;
		onRoomReady(currentRoomId, currentPlayerId, finalName, isHost, connectedPlayers);
	}

	function leaveRoom() {
		multiplayerService.leaveRoom();
		multiplayerService.off('room:joined', handlePlayerJoined);
		multiplayerService.off('room:left', handlePlayerLeft);
		multiplayerService.off(GameEventType.GAME_STARTED, handleGameStarted);
		
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
		</div>
	{:else if mode === 'create' && !currentRoomId}
		<div>
			<label>
				Your Name
				<div class="name-input-group">
					<input 
						type="text" 
						bind:value={playerName}
						placeholder={placeholderName}
						disabled={isConnecting}
					/>
					<button 
						type="button"
						onclick={generateRandomPlaceholder}
						class="secondary random-button"
						disabled={isConnecting}
						title="Generate random name"
					>
						🎲
					</button>
				</div>
			</label>

			<div class="button-group">
				<button 
					onclick={createRoom}
					disabled={isConnecting}
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
					<code class="room-code">{currentRoomId}</code>
					<button 
						onclick={copyRoomCode}
						class="secondary copy-button"
						title="Copy to clipboard"
					>
						📋
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
				<div class="name-input-group">
					<input 
						type="text" 
						bind:value={playerName}
						placeholder={placeholderName}
						disabled={isConnecting}
					/>
					<button 
						type="button"
						onclick={generateRandomPlaceholder}
						class="secondary random-button"
						disabled={isConnecting}
						title="Generate random name"
					>
						🎲
					</button>
				</div>
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
					disabled={isConnecting || !roomCode.trim()}
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

	.name-input-group {
		display: flex;
		gap: 0.5rem;
		align-items: stretch;
	}

	.name-input-group input {
		flex: 1;
		margin: 0;
	}

	.random-button {
		margin: 0;
		padding: 0.5rem 1rem;
		font-size: 1.2rem;
		min-width: auto;
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
		align-items: stretch;
		justify-content: center;
		gap: 0.5rem;
		margin: 1rem 0;
		flex-wrap: wrap;
	}

	.code-box .room-code {
		font-size: clamp(1.5rem, 5vw, 2rem);
		font-weight: bold;
		padding: 1rem;
		background-color: var(--pico-code-background-color);
		border-radius: var(--pico-border-radius);
		letter-spacing: 0.2em;
		flex: 1;
		min-width: 200px;
		display: flex;
		align-items: center;
		justify-content: center;
		word-break: break-all;
		user-select: all;
	}

	.copy-button {
		margin: 0;
		padding: 1rem;
		font-size: 1.5rem;
		min-width: auto;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Mobile optimization */
	@media (max-width: 576px) {
		.code-box {
			flex-direction: column;
		}

		.code-box .room-code {
			font-size: 1.75rem;
			padding: 1.25rem;
		}

		.copy-button {
			width: 100%;
		}
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
