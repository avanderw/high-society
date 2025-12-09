<script lang="ts">
	import { getMultiplayerService } from '$lib/multiplayer/service';
	import { GameEventType, type GameEvent } from '$lib/multiplayer/events';
	import { normalizeRoomCode, isValidRoomCode } from '$lib/multiplayer/wordlist';
	import { logger } from '$lib/utils/logger';
	import LoadingSpinner from './LoadingSpinner.svelte';
	
	const ctx = 'MultiplayerSetup';
	
	type Props = {
		onRoomReady: (roomId: string, playerId: string, playerName: string, isHost: boolean, players: Array<{ playerId: string; playerName: string }>, turnTimerSeconds: number) => void;
		initialRoomCode?: string;
		onModeChange?: (mode: 'menu' | 'create' | 'join') => void;
	};
	
	let { onRoomReady, initialRoomCode = '', onModeChange }: Props = $props();
	
	let mode = $state<'menu' | 'create' | 'join'>(initialRoomCode ? 'join' : 'menu');
	let playerName = $state('');
	let roomCode = $state(initialRoomCode);
	let isConnecting = $state(false);
	let errorMessage = $state('');
	let connectedPlayers = $state<Array<{ playerId: string; playerName: string }>>([]);
	let currentRoomId = $state('');
	let currentPlayerId = $state('');
	let isHost = $state(false);
	let placeholderName = $state('');
	let copiedToClipboard = $state(false);
	let turnTimerSeconds = $state(45); // Default 45 seconds per turn

	const multiplayerService = getMultiplayerService();

	// Random name generator - expanded list to reduce collision rates
	const randomNames = [
		// Aristocratic titles
		'Baron von Bling', 'Duchess Diamond', 'Count Cashmore', 'Lady Luxe',
		'Sir Spendwell', 'Princess Prestige', 'Duke Dapper', 'Madame Moneybags',
		'Lord Lavish', 'Baroness Bling', 'Captain Cash', 'Miss Fortune',
		'Earl Elegant', 'Countess Couture', 'Sir Status', 'Lady Lush',
		'Baron Bountiful', 'Duchess Decadent', 'Lord Luxury', 'Miss Magnificent',
		
		// More aristocrats
		'Viscount Velvet', 'Marquis Marble', 'Lady Sapphire', 'Duke Gilded',
		'Baroness Brilliant', 'Earl Opulent', 'Countess Crystal', 'Lord Sterling',
		'Dame Desire', 'Sir Sovereign', 'Princess Pearl', 'Baron Baroque',
		'Lady Majestic', 'Count Cavalier', 'Duchess Divine', 'Marquis Magnificent',
		
		// Wealthy personas
		'Tycoon Topaz', 'Mogul Milano', 'Heiress Harper', 'Magnate Maxwell',
		'Socialite Sinclair', 'Billionaire Blake', 'Patron Pembroke', 'Elite Ellis',
		'VIP Valencia', 'Grande Greenwich', 'Premier Parker', 'Noble Nash',
		
		// Glamorous names
		'Gatsby Gold', 'Vanderbilt Vogue', 'Rockefeller Ruby', 'Carnegie Charm',
		'Astor Amethyst', 'Whitney Wonder', 'Morgan Majesty', 'Rothschild Rose',
		'Windsor Wealth', 'Habsburg Haute', 'Medici Magnificence', 'Tudor Treasure',
		
		// Luxurious descriptors
		'Platinum Prince', 'Golden Grace', 'Silver Sage', 'Bronze Beauty',
		'Ivory Icon', 'Emerald Empress', 'Amber Admiral', 'Jade Justice',
		'Scarlet Supreme', 'Violet Virtue', 'Azure Ace', 'Crimson Crown',
		
		// Fancy locations
		'Monaco Marcel', 'Beverly Beaumont', 'Mayfair Maximilian', 'Riviera Reginald',
		'Geneva Genevieve', 'Versailles Victor', 'Capri Catherine', 'Tuscany Theodore',
		'Monaco Margot', 'Portofino Philip', 'Santorini Sophia', 'Biarritz Benedict',
		
		// Opulent terms
		'Sovereign Sinclair', 'Regal Remington', 'Imperial Irving', 'Royal Rosalind',
		'Noble Nathaniel', 'Kingly Kingston', 'Queenly Quincy', 'Princely Preston',
		'Majestic Montgomery', 'Splendid Spencer', 'Grand Grayson', 'Stately Sterling',
		
		// More creative combinations
		'Champagne Charlie', 'Caviar Caroline', 'Truffle Tristan', 'Saffron Sabrina',
		'Velvet Vivian', 'Cashmere Cassidy', 'Silk Sebastian', 'Satin Samantha',
		'Brocade Benjamin', 'Damask Delilah', 'Taffeta Timothy', 'Chiffon Charlotte'
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
			onModeChange?.(mode);
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
		
		const normalizedRoomCode = normalizeRoomCode(roomCode);
		if (!normalizedRoomCode) {
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
			
			const result = await multiplayerService.joinRoom(normalizedRoomCode, finalName);
			
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
		logger.debug(ctx, 'Player joined event received', { 
			event, 
			myPlayerId: currentPlayerId, 
			eventPlayerId: event.data?.playerId 
		});
		if (event.data && event.data.players) {
			logger.debug(ctx, 'Updating player list', { players: event.data.players });
			connectedPlayers = event.data.players;
		} else {
			logger.warn(ctx, 'Event missing data.players', { event });
		}
	}

	function handlePlayerLeft(event: any) {
		connectedPlayers = connectedPlayers.filter(p => p.playerId !== event.data.playerId);
	}

	function handleGameStarted(event: GameEvent) {
		logger.info(ctx, 'GAME_STARTED event received, transitioning to game', { 
			eventData: event.data, 
			isHost 
		});
		
		// CRITICAL: Don't call onRoomReady here, as it may trigger startGame again
		// Just transition to the game view - the +page.svelte listener will handle the game state
		if (!isHost) {
			// For clients only, call onRoomReady to transition
			const finalName = playerName.trim() || placeholderName;
			onRoomReady(currentRoomId, currentPlayerId, finalName, isHost, connectedPlayers, turnTimerSeconds);
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
		onRoomReady(currentRoomId, currentPlayerId, finalName, isHost, connectedPlayers, turnTimerSeconds);
	}

	function leaveRoom() {
		multiplayerService.leaveRoom();
		multiplayerService.off('room:joined', handlePlayerJoined);
		multiplayerService.off('room:left', handlePlayerLeft);
		multiplayerService.off(GameEventType.GAME_STARTED, handleGameStarted);
		
		// Reset state
		mode = 'menu';
		onModeChange?.(mode);
		currentRoomId = '';
		currentPlayerId = '';
		isHost = false;
		connectedPlayers = [];
		roomCode = '';
		errorMessage = '';
	}

	function copyRoomCode() {
		const shareUrl = `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;
		navigator.clipboard.writeText(shareUrl).then(() => {
			copiedToClipboard = true;
			setTimeout(() => {
				copiedToClipboard = false;
			}, 2000);
		});
	}

	async function shareRoomCode() {
		const shareUrl = `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;
		const shareData = {
			title: 'Join my High Society game!',
			text: `Join my High Society game!`,
			url: shareUrl
		};

		try {
			if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
				await navigator.share(shareData);
			} else {
				// Fallback to copy
				await navigator.clipboard.writeText(shareUrl);
				copiedToClipboard = true;
				setTimeout(() => {
					copiedToClipboard = false;
				}, 2000);
			}
		} catch (err) {
			logger.debug(ctx, 'Error sharing', err);
			// Fallback to copy
			try {
				await navigator.clipboard.writeText(shareUrl);
				copiedToClipboard = true;
				setTimeout(() => {
					copiedToClipboard = false;
				}, 2000);
			} catch (copyErr) {
				logger.error(ctx, 'Failed to copy', copyErr);
			}
		}
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

	{#if isConnecting}
		<div class="connecting-overlay">
			<LoadingSpinner message={mode === 'create' ? 'Creating room...' : 'Joining room...'} />
		</div>
	{/if}

	{#if mode === 'menu'}
		<div class="menu-container">
			<p>Choose how to play:</p>
			
			<div class="button-group">
			<button 
				onclick={() => {
					mode = 'create';
					onModeChange?.(mode);
				}} 
				disabled={isConnecting}
			>
				Create Room
			</button>				<button 
					onclick={() => {
						mode = 'join';
						onModeChange?.(mode);
					}}
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
					onclick={() => {
						mode = 'menu';
						onModeChange?.(mode);
					}}
					class="secondary"
					disabled={isConnecting}
				>
					Back
				</button>
			</div>
		</div>
	{:else if mode === 'create' && currentRoomId}
		<!-- Host lobby - cleaner, more focused on actions -->
		<div class="room-lobby host-lobby">
			<div class="room-code-display">
				{#if copiedToClipboard}
					<div class="copied-notification" role="alert">
						✓ Copied to clipboard!
					</div>
				{/if}
				<div class="code-box">
					<code class="room-code">{currentRoomId}</code>
				</div>
				<div class="code-actions">
					<button 
						onclick={copyRoomCode}
						class="secondary"
						title="Copy to clipboard"
					>
						📋 Copy
					</button>
					<button 
						onclick={shareRoomCode}
						class="secondary"
						title="Share room code"
					>
						📤 Share
					</button>
				</div>
			</div>

			<div class="player-list">
				<h4>Players ({connectedPlayers.length}/5)</h4>
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

			<div class="game-settings">
				<label for="turn-timer">
					Turn Timer: {turnTimerSeconds}s
					<input
						id="turn-timer"
						type="range"
						min="15"
						max="120"
						step="5"
						bind:value={turnTimerSeconds}
					/>
				</label>
			</div>

			<div class="button-group">
				<button 
					onclick={startGame}
					disabled={connectedPlayers.length < 2 || connectedPlayers.length > 5}
				>
					Start Game
				</button>
				
				<button 
					onclick={leaveRoom}
					class="secondary"
				>
					Cancel
				</button>
			</div>
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
					placeholder="apple-banana-cherry"
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
					onclick={() => {
						mode = 'menu';
						onModeChange?.(mode);
					}}
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

	/* Host lobby - more compact and action-focused */
	.host-lobby {
		gap: 1rem;
	}

	.host-lobby .room-code-display {
		text-align: center;
	}

	.host-lobby .code-box {
		margin: 0.5rem 0;
	}

	.host-lobby .code-box .room-code {
		font-size: clamp(1.5rem, 5vw, 2rem);
		padding: 0.75rem 1.25rem;
	}

	.host-lobby .game-settings {
		padding: 0.75rem 1rem;
	}

	.host-lobby .game-settings label {
		font-size: 0.95rem;
	}

	.host-lobby .player-list {
		padding: 0.75rem 1rem;
	}

	.room-code-display {
		text-align: center;
	}

	.room-code-display h3 {
		margin-bottom: 0.5rem;
	}

	.copied-notification {
		background-color: var(--pico-ins-color);
		color: var(--pico-contrast);
		padding: 0.5rem 1rem;
		border-radius: var(--pico-border-radius);
		margin-bottom: 0.5rem;
		font-weight: 600;
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.code-box {
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 1rem 0;
	}

	.code-box .room-code {
		font-size: clamp(1.25rem, 4vw, 1.75rem);
		font-weight: bold;
		padding: 1rem 1.5rem;
		background-color: var(--pico-code-background-color);
		border-radius: var(--pico-border-radius);
		letter-spacing: 0.05em;
		word-break: break-word;
		user-select: all;
		text-align: center;
		flex: 1;
		max-width: 100%;
	}

	.code-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
		margin-bottom: 0.5rem;
		flex-wrap: wrap;
	}

	.code-actions button {
		margin: 0;
		padding: 0.5rem 1rem;
		flex: 1;
		min-width: 120px;
		max-width: 200px;
	}

	/* Mobile optimization */
	@media (max-width: 576px) {
		.code-box .room-code {
			font-size: 1.25rem;
			padding: 1rem;
			letter-spacing: 0.05em;
		}

		.code-actions button {
			flex: 1 1 100%;
			max-width: 100%;
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

	.game-settings {
		background-color: var(--pico-card-background-color);
		padding: 1rem;
		border-radius: var(--pico-border-radius);
	}

	.game-settings h4 {
		margin-bottom: 0.75rem;
	}

	.game-settings label {
		margin-bottom: 0;
	}

	.game-settings small {
		display: block;
		margin-top: 0.5rem;
		color: var(--pico-muted-color);
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

	.connecting-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}
</style>
