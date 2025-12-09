<script lang="ts">
	import { page } from '$app/stores';
	import { GamePhase } from '$lib/domain/gameState';
	import { GameScoringService } from '$lib/domain/scoring';
	import type { Player } from '$lib/domain/player';
	import type { StatusCard } from '$lib/domain/cards';
	
	import MultiplayerSetup from '$lib/components/MultiplayerSetup.svelte';
	import GameBoard from '$lib/components/GameBoard.svelte';
	import AuctionPanel from '$lib/components/AuctionPanel.svelte';
	import PlayerHand from '$lib/components/PlayerHand.svelte';
	import StatusDisplay from '$lib/components/StatusDisplay.svelte';
	import ScoreBoard from '$lib/components/ScoreBoard.svelte';
	import LuxuryDiscardModal from '$lib/components/LuxuryDiscardModal.svelte';
	import AuctionResultModal from '$lib/components/AuctionResultModal.svelte';
	import UpdatePrompt from '$lib/components/UpdatePrompt.svelte';
	import ErrorToast from '$lib/components/ErrorToast.svelte';
	import TurnTimer from '$lib/components/TurnTimer.svelte';
	import StatisticsModal from '$lib/components/StatisticsModal.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	
	import { Target, BarChart3, Settings, Wifi, WifiOff } from 'lucide-svelte';
	
	import { getMultiplayerService } from '$lib/multiplayer/service';
	import { serializeGameState, deserializeGameState } from '$lib/multiplayer/serialization';
	import { GameEventType } from '$lib/multiplayer/events';
	import { shouldExecuteGameLogic } from '$lib/multiplayer/hostGuard';
	import { updateStatsAfterGame } from '$lib/utils/statistics';
	import { feedback, FeedbackType } from '$lib/utils/feedback';
	import { reactiveGameStore } from '$lib/stores/reactiveGameStore.svelte';
	import { MultiplayerOrchestrator } from '$lib/orchestrators/MultiplayerOrchestrator';
	
	// Multiplayer service
	const multiplayerService = getMultiplayerService();
	const store = reactiveGameStore;
	let multiplayerOrchestrator: MultiplayerOrchestrator | null = null;
	
	// Multiplayer state
	let roomId = $state('');
	let myPlayerName = $state('');
	let hostPlayerId = $state('');
	let isHost = $state(false);
	let inLobby = $state(true);
	let lobbyPlayers = $state<Array<{ playerId: string; playerName: string }>>([]);
	let turnTimerSeconds = $state(45);
	let turnTimeRemaining = $state(0); // Seconds remaining in current turn
	let showGameIntro = $state(true); // Show intro until user creates/joins a room
	
	// UI Modal state
	let showLuxuryDiscard = $state(false);
	let showAuctionResult = $state(false);
	let auctionResultData = $state<{
		winner: Player;
		card: StatusCard;
		winningBid: number;
		isDisgrace?: boolean;
		losersInfo?: Array<{ player: Player; bidAmount: number }>;
	} | null>(null);
	let showStatistics = $state(false);
	let showSettings = $state(false);
	let showConfirmDialog = $state(false);
	let confirmDialogData = $state<{
		title: string;
		message: string;
		onConfirm: () => void;
		type?: 'warning' | 'danger' | 'info';
	} | null>(null);
	let toastMessage = $state('');
	let toastType = $state<'error' | 'warning' | 'info' | 'success'>('error');
	let showToast = $state(false);
	
	// Mobile tabs state
	type MobileTab = 'game' | 'players';
	let activeMobileTab = $state<MobileTab>('game');
	
	// Auto-switch to game tab when it's the player's turn (mobile only)
	$effect(() => {
		if (store.isMyTurn && window.innerWidth < 768) {
			activeMobileTab = 'game';
		}
	});
	
	// Derived connected players
	const connectedPlayerIds = $derived.by(() => {
		return new Set(lobbyPlayers.map(p => p.playerId));
	});

	// Banner values need explicit derived numbers so host UI updates when auction mutates
	const bannerHighBid = $derived.by(() => {
		const _ = store.updateCounter;
		return store.currentAuction?.getCurrentHighestBid() ?? 0;
	});

	const bannerLocalBid = $derived.by(() => {
		const _ = store.updateCounter;
		return store.localPlayer?.getCurrentBidAmount() ?? 0;
	});
	
	// Helper to show toast messages
	function showToastMessage(message: string, type: 'error' | 'warning' | 'info' | 'success' = 'error') {
		toastMessage = message;
		toastType = type;
		showToast = true;
	}
	
	// === GAME INITIALIZATION ===
	
	function handleMultiplayerRoomReady(
		roomIdParam: string,
		playerIdParam: string,
		playerNameParam: string,
		isHostParam: boolean,
		players: Array<{ playerId: string; playerName: string }>,
		turnTimerSecondsParam: number
	) {
		roomId = roomIdParam;
		store.myPlayerId = playerIdParam;
		myPlayerName = playerNameParam;
		isHost = isHostParam;
		lobbyPlayers = players;
		inLobby = true;
		turnTimerSeconds = turnTimerSecondsParam;
		showGameIntro = false; // Hide intro once room is created/joined
		
		hostPlayerId = players[0]?.playerId ?? '';
		
		// Setup multiplayer orchestrator
		multiplayerOrchestrator = new MultiplayerOrchestrator(multiplayerService, store);
		multiplayerOrchestrator.setupEventListeners();
		
		// Set callback for when auction completes (for non-acting players)
		multiplayerOrchestrator.setOnAuctionComplete((gameState, auctionResultData) => {
			console.log('[AuctionComplete Callback] Received auction result:', auctionResultData);
			
			// If we're the host and already showing the modal, skip (we already handled it locally)
			if (multiplayerService.isHost() && showAuctionResult) {
				console.log('[AuctionComplete Callback] Host already showing modal, skipping callback');
				return;
			}
			
			// Reconstruct the full auction result data from the serialized info
			const winner = gameState.getPlayer(auctionResultData.winnerId);
			if (!winner) {
				console.log('[AuctionComplete Callback] Could not find winner:', auctionResultData.winnerId);
				return;
			}
			
			// Find the status card from the winner's cards
			const card = winner.getStatusCards().find(c => c.id === auctionResultData.card.id);
			if (!card) {
				console.log('[AuctionComplete Callback] Could not find card:', auctionResultData.card.id);
				return;
			}
			
			// Reconstruct losers info if present
			const losersInfo = auctionResultData.losersInfo?.map(info => ({
				player: gameState.getPlayer(info.playerId)!,
				bidAmount: info.bidAmount
			}));
			
			console.log('[AuctionComplete Callback] Showing auction result modal');
			// Show the modal
			showAuctionResultModal({
				winner,
				card,
				winningBid: auctionResultData.winningBid,
				isDisgrace: auctionResultData.isDisgrace,
				losersInfo
			});
		});
		
		// Add game started event listener
		multiplayerService.on(GameEventType.GAME_STARTED, handleGameStarted);
		
		// If host, start the game immediately
		if (isHostParam) {
			const playerNames = players.map(p => p.playerName);
			startGameAsHost(playerNames);
		}
	}
	
	function startGameAsHost(playerNames: string[]) {
		// Create player ID to game index mapping
		const playerMapping = new Map<string, number>();
		lobbyPlayers.forEach((lobbyPlayer, lobbyIndex) => {
			playerMapping.set(lobbyPlayer.playerId, lobbyIndex);
		});
		
		// Initialize game
		store.initialize(playerNames, Date.now(), turnTimerSeconds);
		store.setMultiplayerContext(store.myPlayerId, playerMapping);
		
		// Broadcast to clients
		multiplayerOrchestrator?.broadcastGameStart(playerNames, Array.from({ length: playerNames.length }, (_, i) => i));
		
		inLobby = false;
		feedback.play(FeedbackType.CARD_DEAL);
	}
	
	function handleGameStarted(event: any) {
		if (isHost) {
			console.log('[+page.handleGameStarted] Skipping - host already initialized game locally');
			return; // Host already started
		}
		
		const { playerNames, seed } = event.data;
		
		// Create player ID to game index mapping
		const playerMapping = new Map<string, number>();
		lobbyPlayers.forEach((lobbyPlayer, lobbyIndex) => {
			playerMapping.set(lobbyPlayer.playerId, lobbyIndex);
		});
		
		// Initialize game with same seed as host
		store.initialize(playerNames, seed, turnTimerSeconds);
		store.setMultiplayerContext(store.myPlayerId, playerMapping);
		
		inLobby = false;
		feedback.play(FeedbackType.CARD_DEAL);
	}
	
	// === GAME ACTIONS ===
	
	function toggleMoneyCard(cardId: string) {
		const selected = store.selectedMoneyCards;
		if (selected.includes(cardId)) {
			store.selectedMoneyCards = selected.filter(id => id !== cardId);
		} else {
			store.selectedMoneyCards = [...selected, cardId];
		}
	}
	
	function placeBid() {
		console.log('[UI BEFORE placeBid] localPlayer:', store.localPlayer?.id, 'currentPlayerIndex:', store.gameState?.getCurrentPlayerIndex(), 'currentAuctionExists:', !!store.currentAuction, 'currentAuctionActivePlayers:', store.currentAuction ? Array.from(store.currentAuction.getActivePlayers()) : null);
		
		// Check if this player should execute game logic
		const guard = shouldExecuteGameLogic(multiplayerOrchestrator ? multiplayerService : null);
		
		if (!guard.shouldExecute) {
			console.log(`[placeBid] ${guard.reason.toUpperCase()} - Broadcasting bid, waiting for host response`);
			multiplayerOrchestrator!.broadcastBid(store.selectedMoneyCards);
			store.selectedMoneyCards = [];
			feedback.play(FeedbackType.BID);
			return;
		}
		
		// Host or single-player executes game logic
		console.log(`[placeBid] ${guard.reason.toUpperCase()} - Executing game logic locally`);
		const result = store.placeBid(store.selectedMoneyCards);
		
		console.log('[placeBid] Result:', result);
		
		if (result.success) {
			feedback.play(FeedbackType.BID);
			
			// Handle auction completion
			if (result.auctionComplete) {
				console.log('[placeBid] Auction complete, starting new round');
				
				// Show modal locally (only if there's a winner)
				if (result.auctionResultData) {
					showAuctionResultModal(result.auctionResultData);
				}
				
				if (result.needsLuxuryDiscard) {
					showLuxuryDiscard = true;
				}
				
				// Start new round immediately (unless luxury discard needed)
				if (!result.needsLuxuryDiscard) {
					const newRoundResult = store.startNewRound();
					if (newRoundResult.success) {
						console.log('[placeBid] New round started');
						// Broadcast in multiplayer
						if (multiplayerOrchestrator) {
							multiplayerOrchestrator.broadcastAuctionComplete(result.auctionResultData);
							multiplayerOrchestrator.broadcastStateSync();
						}
					} else {
						// Game over
						feedback.play(FeedbackType.GAME_END);
						trackGameStatistics();
						if (multiplayerOrchestrator) {
							multiplayerOrchestrator.broadcastAuctionComplete(result.auctionResultData);
						}
					}
				} else {
					// Will start new round after luxury discard
					if (multiplayerOrchestrator && result.auctionResultData) {
						multiplayerOrchestrator.broadcastAuctionComplete(result.auctionResultData);
					}
				}
			} else {
				// Auction not complete, sync state in multiplayer
				if (multiplayerOrchestrator) {
					// We already broadcast the exact card IDs when the client placed the bid.
					// Here, just sync the updated game state.
					multiplayerOrchestrator.broadcastStateSync();
				}
			}
		} else {
			feedback.play(FeedbackType.ERROR);
			showToastMessage(result.error ?? 'Failed to place bid', 'error');
		}
	}	function requestPass() {
		const currentPlayer = store.currentPlayer;
		const auction = store.currentAuction;
		
		if (!currentPlayer || !auction) return;
		
		// Check if player has bid - confirm before passing
		const highestBid = auction.getCurrentHighestBid();
		const playerBid = currentPlayer.getCurrentBidAmount();
		
		if (highestBid > 0 && playerBid === highestBid) {
			confirmDialogData = {
				title: 'Pass with Highest Bid?',
				message: `You currently have the highest bid (${highestBid.toLocaleString()} Francs). Are you sure you want to pass?`,
				onConfirm: () => {
					showConfirmDialog = false;
					pass();
				},
				type: 'warning'
			};
			showConfirmDialog = true;
		} else {
			pass();
		}
	}
	
	function pass() {
		console.log('[UI BEFORE pass] localPlayer:', store.localPlayer?.id, 'currentPlayerIndex:', store.gameState?.getCurrentPlayerIndex(), 'currentAuctionExists:', !!store.currentAuction, 'currentAuctionActivePlayers:', store.currentAuction ? Array.from(store.currentAuction.getActivePlayers()) : null);
		
		// Capture current player index BEFORE executing pass (it will change after)
		const passingPlayerIndex = store.currentPlayerIndex;
		
		// Check if this player should execute game logic
		const guard = shouldExecuteGameLogic(multiplayerOrchestrator ? multiplayerService : null);
		console.log('[pass] Guard result:', guard);
		
		if (!guard.shouldExecute) {
			console.log(`[pass] ${guard.reason.toUpperCase()} - Broadcasting pass, waiting for host response`);
			multiplayerOrchestrator!.broadcastPass();
			store.selectedMoneyCards = [];
			feedback.play(FeedbackType.PASS);
			return;
		}
		
		// Host or single-player executes game logic
		console.log(`[pass] ${guard.reason.toUpperCase()} - Executing game logic locally`);
		const result = store.pass();
		
		console.log('[pass] Result:', result);
		
		if (result.success) {
			feedback.play(FeedbackType.PASS);
			
			// Handle auction completion
			if (result.auctionComplete && result.auctionResultData) {
				console.log('[pass] Auction complete, starting new round');
				
				// Show modal locally
				showAuctionResultModal(result.auctionResultData);
				
				if (result.needsLuxuryDiscard) {
					showLuxuryDiscard = true;
				}
				
				// Start new round immediately (unless luxury discard needed)
				if (!result.needsLuxuryDiscard) {
					console.log('[pass] Calling startNewRound...');
					const newRoundResult = store.startNewRound();
					console.log('[pass] startNewRound result:', newRoundResult);
					if (newRoundResult.success) {
						console.log('[pass] New round started successfully');
						// Broadcast in multiplayer
						if (multiplayerOrchestrator) {
							multiplayerOrchestrator.broadcastAuctionComplete(result.auctionResultData);
							multiplayerOrchestrator.broadcastStateSync();
						}
					} else {
						console.log('[pass] startNewRound failed, treating as game over');
						// Game over
						feedback.play(FeedbackType.GAME_END);
						trackGameStatistics();
						if (multiplayerOrchestrator) {
							multiplayerOrchestrator.broadcastAuctionComplete(result.auctionResultData);
						}
					}
				} else {
					// Will start new round after luxury discard
					if (multiplayerOrchestrator && result.auctionResultData) {
						multiplayerOrchestrator.broadcastAuctionComplete(result.auctionResultData);
					}
				}
		} else {
			// Auction not complete, sync state in multiplayer
			if (multiplayerOrchestrator) {
				multiplayerOrchestrator.broadcastPass(passingPlayerIndex);
				multiplayerOrchestrator.broadcastStateSync();
			}
		}
	} else {
		feedback.play(FeedbackType.ERROR);
		showToastMessage(result.error ?? 'Failed to pass', 'error');
	}
}	function handleLuxuryDiscard(cardId: string) {
		// In multiplayer, only host executes game logic
		if (multiplayerOrchestrator && !multiplayerService.isHost()) {
			console.log('[handleLuxuryDiscard CLIENT] Broadcasting discard, waiting for host response');
			multiplayerOrchestrator.broadcastLuxuryDiscard(cardId);
			showLuxuryDiscard = false;
			feedback.play(FeedbackType.CARD_SELECT);
			return;
		}
		
		// Host (or single-player) executes locally
		const result = store.handleLuxuryDiscard(cardId);
		
		if (result.success) {
			showLuxuryDiscard = false;
			feedback.play(FeedbackType.CARD_SELECT);
			
			// Start new round after luxury discard
			console.log('[handleLuxuryDiscard] Starting new round after luxury discard');
			const newRoundResult = store.startNewRound();
			if (newRoundResult.success) {
				console.log('[handleLuxuryDiscard] New round started');
				// Broadcast in multiplayer
				if (multiplayerOrchestrator) {
					multiplayerOrchestrator.broadcastLuxuryDiscard(cardId);
					multiplayerOrchestrator.broadcastStateSync();
				}
			} else {
				// Game over
				feedback.play(FeedbackType.GAME_END);
				trackGameStatistics();
			}
		} else {
			showToastMessage(result.error ?? 'Failed to discard', 'error');
		}
	}
	
	function handleTurnTimeout() {
		// Don't auto-pass if modal is showing or not our turn
		if (!store.isMyTurn || showAuctionResult || showLuxuryDiscard) {
			console.log('Turn timeout ignored - modal showing or not our turn');
			return;
		}
		
		console.log('Turn timeout - auto-passing');
		pass();
	}
	
	function closeAuctionResult() {
		console.log('[closeAuctionResult] Closing auction result modal');
		showAuctionResult = false;
		auctionResultData = null;
	}
	
	function showAuctionResultModal(data: typeof auctionResultData) {
		auctionResultData = data;
		showAuctionResult = true;
		
		const isLocalPlayerWinner = data?.winner.id === store.localPlayer?.id;
		feedback.play(isLocalPlayerWinner ? FeedbackType.AUCTION_WIN : FeedbackType.PASS);
	}
	
	// === STATISTICS ===
	
	function trackGameStatistics() {
		const localPlayer = store.localPlayer;
		if (!localPlayer || store.currentPhase !== GamePhase.FINISHED) return;
		
		const scoringService = new GameScoringService();
		const rankings = scoringService.calculateFinalRankings(store.players);
		const myRanking = rankings.find(r => r.player.id === localPlayer.id);
		
		if (myRanking) {
			const won = myRanking.rank === 1 && !myRanking.isCastOut;
			const luxuryCards = localPlayer.getStatusCards()
				.filter(c => c.name !== 'Prestige' && c.name !== 'Faux Pas' && c.name !== 'Passé' && c.name !== 'Scandale')
				.map(c => c.name);
			const prestigeCount = localPlayer.getStatusCards().filter(c => c.name === 'Prestige').length;
			const disgraceCount = localPlayer.getStatusCards().filter(c =>
				c.name === 'Faux Pas' || c.name === 'Passé' || c.name === 'Scandale'
			).length;
			
			const STARTING_MONEY = 106000;
			const moneySpent = STARTING_MONEY - myRanking.remainingMoney;
			
			updateStatsAfterGame(
				won,
				myRanking.finalStatus,
				moneySpent,
				myRanking.remainingMoney,
				myRanking.isCastOut ?? false,
				luxuryCards,
				prestigeCount,
				disgraceCount
			);
		}
	}
	
	// === NEW GAME ===
	
	function newGame() {
		confirmDialogData = {
			title: 'Start New Game?',
			message: 'This will end the current game and return to the lobby. Are you sure?',
			onConfirm: () => {
				showConfirmDialog = false;
				startNewGamePermanently();
			},
			type: 'warning'
		};
		showConfirmDialog = true;
	}
	
	function startNewGamePermanently() {
		store.reset();
		inLobby = true;
		// Clients will need to disconnect and rejoin
	}
</script>

<svelte:head>
	<title>High Society - Luxury Auction Card Game</title>
</svelte:head>

<UpdatePrompt />

{#if inLobby}
	<div class="multiplayer-lobby">
		<MultiplayerSetup
			onRoomReady={handleMultiplayerRoomReady}
			initialRoomCode={$page.url.searchParams.get('room') || ''}
			onModeChange={(mode) => showGameIntro = mode === 'menu'}
		/>
		<!-- Game Introduction -->
		{#if showGameIntro}
		<article class="game-intro">
			<header>
				<h2>Welcome to High Society</h2>
			</header>
			<section>
				<p>
					<strong>High Society</strong> is an auction card game designed by Reiner Knizia where you play as wealthy socialites 
					competing to acquire the most luxurious items and prestigious status symbols.
				</p>
				<p>
					<strong>The catch?</strong> You must avoid going broke! At the end of the game, the player with the least money 
					is cast out of high society and cannot win — no matter how many luxury items they've acquired.
				</p>
				<p>
					<strong>Gameplay:</strong> Each round, a status card is revealed. Players bid using their money cards to win luxury items 
					and prestige multipliers, while avoiding disgrace cards. The game ends when the 4th special trigger card appears.
				</p>
				<div class="rules-link">
					<small>
						Learn the full rules in the 
						<a href="https://github.com/avanderw/high-society/blob/main/20251001T142857_high-society-rules_0b8224f9.md" target="_blank" rel="noopener noreferrer">
							game documentation
						</a>
					</small>
				</div>
			</section>
		</article>
		{/if}
		
	</div>
{:else}
	<main class="game-container">
		<!-- Header -->
		<header class="game-header">
			<div class="header-left">
				<h1>
					<Target size={24} strokeWidth={2.5} />
					High Society
				</h1>
				{#if store.localPlayer}
					<p class="player-name-subtitle">{store.localPlayer.name}</p>
				{/if}
			</div>
			
			<!-- Turn Timer in Header -->
			{#if store.currentPhase !== GamePhase.SETUP && store.currentPhase !== GamePhase.FINISHED && store.currentPhase !== GamePhase.SCORING}
				<div class="header-timer">
					{#key store.currentPlayerIndex}
						<TurnTimer
							duration={turnTimerSeconds}
							onExpired={handleTurnTimeout}
							compact={true}
						/>
					{/key}
				</div>
			{/if}
			
			<div class="header-right">
				{#if multiplayerService.isConnected()}
					<span class="connection-status connected" title="Connected">
						<Wifi size={18} />
					</span>
				{:else}
					<span class="connection-status disconnected" title="Disconnected">
						<WifiOff size={18} />
					</span>
				{/if}
				
				<button class="icon-button" onclick={() => showStatistics = true} title="Statistics">
					<BarChart3 size={20} />
				</button>
				
				<button class="icon-button" onclick={() => showSettings = true} title="Settings">
					<Settings size={20} />
				</button>
			</div>
		</header>

		{#if store.currentAuction && store.localPlayer}
			<section class="auction-info-banner">
				<div class="money-chip">
					<span class="money-chip-label">High Bid</span>
					<span class="money-amount">{bannerHighBid.toLocaleString()}F</span>
				</div>
				<div class="money-chip secondary">
					<span class="money-chip-label">Your Bid</span>
					<span class="money-amount">{bannerLocalBid.toLocaleString()}F</span>
				</div>
			</section>
		{/if}
		
		<!-- Game Grid Layout -->
		<div class="game-grid">
			
			<!-- Current Card Display -->
			{#if store.gameState && store.currentCard}
				<div class="grid-card-area" class:tab-hidden={activeMobileTab !== 'game'}>
					<GameBoard
						gameState={store.gameState}
						updateKey={store.updateCounter}
					/>
				</div>
			{/if}
			
			<!-- Auction Panel (shows player status during active gameplay) -->
			{#if store.currentAuction && store.currentPlayer && store.gameState}
				<div class="grid-players-area" class:tab-hidden={activeMobileTab !== 'players'}>
					<AuctionPanel
						auction={store.currentAuction}
						currentPlayer={store.currentPlayer}
						currentPlayerIndex={store.gameState.getCurrentPlayerIndex()}
						allPlayers={store.gameState.getPlayers()}
						updateKey={store.updateCounter}
						connectedPlayerIds={connectedPlayerIds}
						playerIdToGameIndex={new Map(lobbyPlayers.map((p, idx) => [p.playerId, idx]))}
						turnTimeRemaining={turnTimeRemaining}
						turnTimerSeconds={turnTimerSeconds}
					/>
				</div>
			{/if}
			
			<!-- Player Hand -->
			{#if store.localPlayer && store.currentAuction}
				<div class="grid-hand-area" class:tab-hidden={activeMobileTab !== 'game'}>
					<PlayerHand
						player={store.localPlayer}
						selectedCards={store.selectedMoneyCards}
						onToggleCard={toggleMoneyCard}
						isMyTurn={store.isMyTurn}
						auction={store.currentAuction}
						onBid={placeBid}
						onPass={requestPass}
						isMultiplayer={roomId !== ''}
						remainingStatusCards={store.remainingStatusCards}
						updateKey={store.updateCounter}
						currentPlayerName={store.currentPlayer?.name ?? ''}
					/>
				</div>
			{/if}
			
			<!-- Score Board -->
			{#if store.currentPhase === GamePhase.FINISHED}
				<ScoreBoard
					scoringService={new GameScoringService()}
					players={store.players}
					onPlayAgain={() => {}}
					onNewGame={newGame}
					isHost={isHost}
				/>
			{/if}
		</div>
		
		<!-- Mobile Tab Navigation (Bottom) -->
		{#if store.currentPhase !== GamePhase.SETUP && store.currentPhase !== GamePhase.FINISHED && store.currentPhase !== GamePhase.SCORING}
			<nav class="mobile-tabs-bottom">
				<button
					class="tab-button"
					class:active={activeMobileTab === 'game'}
					onclick={() => activeMobileTab = 'game'}
				>
					<span class="tab-label">Game</span>
					{#if store.isMyTurn && activeMobileTab !== 'game'}
						<span class="tab-badge">!</span>
					{/if}
				</button>
				<button
					class="tab-button"
					class:active={activeMobileTab === 'players'}
					onclick={() => activeMobileTab = 'players'}
				>
					<span class="tab-label">Players</span>
				</button>
			</nav>
		{/if}
	</main>
{/if}

<!-- Modals -->

{#if showLuxuryDiscard && store.localPlayer}
	<LuxuryDiscardModal
		player={store.localPlayer}
		onDiscard={handleLuxuryDiscard}
		onClose={() => {}}
	/>
{/if}

{#if showAuctionResult && auctionResultData}
	<AuctionResultModal
		winner={auctionResultData.winner}
		card={auctionResultData.card}
		winningBid={auctionResultData.winningBid}
		isDisgrace={auctionResultData.isDisgrace ?? false}
		losersInfo={auctionResultData.losersInfo}
		onClose={closeAuctionResult}
	/>
{/if}

{#if showConfirmDialog && confirmDialogData}
	<ConfirmDialog
		title={confirmDialogData.title}
		message={confirmDialogData.message}
		onConfirm={confirmDialogData.onConfirm}
		onCancel={() => showConfirmDialog = false}
		type={confirmDialogData.type}
	/>
{/if}

{#if showStatistics}
	<StatisticsModal
		onClose={() => showStatistics = false}
	/>
{/if}

{#if showSettings}
	<SettingsModal
		onClose={() => showSettings = false}
		turnTimerSeconds={turnTimerSeconds}
		onTurnTimerChange={(val: number) => turnTimerSeconds = val}
	/>
{/if}

{#if showToast}
	<ErrorToast
		message={toastMessage}
		type={toastType}
		onDismiss={() => showToast = false}
		duration={5000}
	/>
{/if}

<style>
	/* Global overflow prevention */
	:global(body) {
		overflow-x: hidden;
	}

	:global(article) {
		max-width: 100%;
		box-sizing: border-box;
	}

	:global(*) {
		box-sizing: border-box;
	}

	.game-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0.25rem;
		overflow-x: hidden;
		width: 100%;
		box-sizing: border-box;
	}

	@media (min-width: 768px) {
		.game-container {
			padding: 1rem;
		}
	}

	.game-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
		padding: 0.5rem;
		background-color: var(--pico-card-background-color);
		border-radius: var(--pico-border-radius);
		width: 100%;
		box-sizing: border-box;
		overflow: hidden;
	}

	@media (min-width: 768px) {
		.game-header {
			margin-bottom: 1rem;
			padding: 0.75rem;
		}
	}

	.header-left h1 {
		margin: 0;
		font-size: clamp(1rem, 4vw, 1.75rem);
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--pico-primary);
	}

	.player-name-subtitle {
		margin: 0;
		font-size: clamp(0.85rem, 2.5vw, 1rem);
		color: var(--pico-muted-color);
		font-weight: 500;
		margin-top: 0.25rem;
	}

	.header-timer {
		flex-shrink: 0;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.connection-status {
		display: flex;
		align-items: center;
		padding: 0.25rem 0.5rem;
		border-radius: var(--pico-border-radius);
	}

	.connection-status.connected {
		color: var(--pico-ins-color);
	}

	.connection-status.disconnected {
		color: var(--pico-del-color);
	}

	.icon-button {
		padding: 0.5rem;
		min-width: auto;
		border: none;
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--pico-primary);
		transition: background-color 0.2s ease;
	}

	.icon-button:hover {
		background-color: var(--pico-secondary-hover);
	}

	.auction-info-banner {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: stretch;
		margin: 0.25rem 0 0.75rem;
	}

	.money-chip {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.75rem;
		border-radius: var(--pico-border-radius);
		background: linear-gradient(135deg, rgba(255, 215, 0, 0.08) 0%, var(--pico-card-background-color) 100%);
		border: 2px solid var(--pico-ins-color);
		color: var(--pico-ins-color);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
		min-width: 150px;
		flex: 1 1 160px;
	}

	.money-chip.secondary {
		border-style: dashed;
		opacity: 0.9;
	}

	.money-chip-label {
		font-size: 0.85rem;
		color: var(--pico-muted-color);
		font-weight: 600;
	}

	.money-amount {
		font-weight: 800;
		font-size: clamp(1rem, 3vw, 1.2rem);
		color: var(--pico-ins-color);
		letter-spacing: 0.01em;
	}

	/* Mobile Tabs at Bottom */
	.mobile-tabs-bottom {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		width: 100%;
		display: flex;
		gap: 0;
		background-color: var(--pico-card-background-color);
		border-top: 2px solid var(--pico-muted-border-color);
		padding: 0;
		z-index: 1000;
		box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
		box-sizing: border-box;
		overflow: hidden;
	}

	.mobile-tabs-bottom .tab-button {
		flex: 1;
		padding: 0.875rem 1rem;
		border: none;
		background: transparent;
		color: var(--pico-muted-color);
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 600;
		transition: all 0.2s ease;
		border-top: 3px solid transparent;
		min-width: auto;
		margin: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		position: relative;
	}

	.mobile-tabs-bottom .tab-button:hover {
		background-color: var(--pico-secondary-hover);
		color: var(--pico-color);
	}

	.mobile-tabs-bottom .tab-button.active {
		background-color: rgba(var(--pico-primary-rgb, 128, 128, 255), 0.15);
		color: var(--pico-primary);
		border-top-color: var(--pico-primary);
	}

	.tab-label {
		display: block;
	}

	.tab-badge {
		position: absolute;
		top: 0.5rem;
		right: 25%;
		display: inline-block;
		width: 1.125rem;
		height: 1.125rem;
		line-height: 1.125rem;
		text-align: center;
		background-color: var(--pico-primary);
		color: var(--pico-primary-inverse);
		border-radius: 50%;
		font-size: 0.7rem;
		font-weight: bold;
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.7;
			transform: scale(1.1);
		}
	}

	/* Hide tabs on larger screens */
	@media (min-width: 768px) {
		.mobile-tabs-bottom {
			display: none;
		}
	}

	/* Add bottom padding to game container on mobile to account for fixed tabs and player name section */
	@media (max-width: 767px) {
		.game-container {
			padding-bottom: 5rem;
		}
	}

	/* Tab hiding for mobile */
	.tab-hidden {
		display: none;
	}

	/* On larger screens, always show all tabs */
	@media (min-width: 768px) {
		.tab-hidden {
			display: block;
		}
	}

	.game-grid {
		display: grid;
		gap: 0.35rem;
		grid-template-columns: 1fr;
		grid-template-areas:
			"card"
			"players"
			"hand";
		overflow-x: hidden;
		width: 100%;
		max-width: 100vw;
	}

	@media (min-width: 768px) {
		.game-grid {
			gap: 0.75rem;
			grid-template-columns: 1fr 1fr;
			grid-template-areas:
				"card players"
				"hand hand";
		}
	}

	@media (min-width: 1024px) {
		.game-grid {
			grid-template-columns: 300px 1fr 300px;
			grid-template-areas:
				"card players hand";
		}
	}

	.grid-card-area {
		grid-area: card;
		overflow-x: hidden;
		min-width: 0;
	}

	.grid-players-area {
		grid-area: players;
		overflow-x: hidden;
		min-width: 0;
	}

	.grid-hand-area {
		grid-area: hand;
		overflow-x: hidden;
		min-width: 0;
	}

	.multiplayer-lobby {
		max-width: 600px;
		width: 100%;
		margin: 0 auto;
		padding: 0 0.5rem;
		box-sizing: border-box;
	}

	.game-intro {
		max-width: 700px;
		width: 100%;
		margin: 0 auto 2rem auto;
		background: linear-gradient(135deg, var(--pico-card-background-color) 0%, rgba(var(--pico-primary-rgb, 128, 128, 255), 0.05) 100%);
		border: 2px solid var(--pico-primary);
		box-sizing: border-box;
	}

	.game-intro p {
		margin-bottom: 1rem;
		line-height: 1.6;
	}

	.game-intro strong {
		color: var(--pico-primary);
	}

	.rules-link {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--pico-muted-border-color);
		text-align: center;
	}

	.rules-link a {
		color: var(--pico-primary);
		text-decoration: underline;
		font-weight: 500;
	}

	.rules-link a:hover {
		color: var(--pico-primary-hover);
	}
</style>
