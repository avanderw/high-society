// Game State Serialization for Multiplayer Sync
import { GameState, GamePhase } from '$lib/domain/gameState';
import { Player } from '$lib/domain/player';
import { 
	type StatusCard, 
	type MoneyCard,
	LuxuryCard, 
	PrestigeCard, 
	DisgraceFauxPas, 
	DisgracePassé, 
	DisgraceScandale,
	MoneyCard as MoneyCardClass,
	PlayerColor
} from '$lib/domain/cards';
import { RegularAuction, DisgraceAuction, type Auction } from '$lib/domain/auction';

// Serializable versions of game objects
export interface SerializedMoneyCard {
	id: string;
	value: number;
}

export interface SerializedStatusCard {
	id: string;
	name: string;
	isGameEndTrigger: boolean;
	type: 'luxury' | 'prestige' | 'disgrace_faux_pas' | 'disgrace_passe' | 'disgrace_scandale';
	value?: number; // For luxury cards
}

export interface SerializedPlayer {
	id: string;
	name: string;
	color: PlayerColor;
	moneyHand: SerializedMoneyCard[];
	playedMoney: SerializedMoneyCard[];
	statusCards: SerializedStatusCard[];
	luxuryCards: SerializedStatusCard[];
	prestigeCards: SerializedStatusCard[];
	disgraceCards: SerializedStatusCard[];
	pendingLuxuryDiscard: boolean;
}

export interface SerializedAuction {
	type: 'regular' | 'disgrace';
	card: SerializedStatusCard;
	activePlayers: string[];
	currentHighestBid: number;
	winnerId: string | null;
}

export interface SerializedGameState {
	gameId: string;
	players: SerializedPlayer[];
	statusDeck: SerializedStatusCard[];
	revealedCards: SerializedStatusCard[];
	currentAuction: SerializedAuction | null;
	gameEndTriggerCount: number;
	remainingStatusCards: number;
	phase: GamePhase;
	currentPlayerIndex: number;
	turnTimerSeconds: number;
}

// Serialization functions
export function serializeMoneyCard(card: MoneyCard): SerializedMoneyCard {
	return {
		id: card.id,
		value: card.value
	};
}

export function serializeStatusCard(card: StatusCard): SerializedStatusCard {
	let type: SerializedStatusCard['type'];
	let value: number | undefined;

	if (card instanceof LuxuryCard) {
		type = 'luxury';
		value = card.value;
	} else if (card instanceof PrestigeCard) {
		type = 'prestige';
	} else if (card instanceof DisgraceFauxPas) {
		type = 'disgrace_faux_pas';
	} else if (card instanceof DisgracePassé) {
		type = 'disgrace_passe';
	} else if (card instanceof DisgraceScandale) {
		type = 'disgrace_scandale';
	} else {
		type = 'luxury'; // Default fallback
	}

	return {
		id: card.id,
		name: card.name,
		isGameEndTrigger: card.isGameEndTrigger,
		type,
		value
	};
}

export function serializePlayer(player: Player): SerializedPlayer {
	return {
		id: player.id,
		name: player.name,
		color: player.color,
		moneyHand: player.getMoneyHand().map(serializeMoneyCard),
		playedMoney: player.getPlayedMoney().map(serializeMoneyCard),
		statusCards: player.getStatusCards().map(serializeStatusCard),
		luxuryCards: player.getLuxuryCards().map(serializeStatusCard),
		prestigeCards: player.getPrestigeCards().map(serializeStatusCard),
		disgraceCards: player.getStatusCards().filter(card => 
			card instanceof DisgraceFauxPas || card instanceof DisgracePassé || card instanceof DisgraceScandale
		).map(serializeStatusCard),
		pendingLuxuryDiscard: player.getPendingLuxuryDiscard()
	};
}

export function serializeAuction(auction: Auction): SerializedAuction {
	return {
		type: auction instanceof RegularAuction ? 'regular' : 'disgrace',
		card: serializeStatusCard(auction.getCard()),
		activePlayers: Array.from(auction.getActivePlayers()),
		currentHighestBid: auction.getCurrentHighestBid(),
		winnerId: auction.getWinner()?.id || null
	};
}

export function serializeGameState(gameState: GameState): SerializedGameState {
	const currentAuction = gameState.getCurrentAuction();
	const publicState = gameState.getPublicState();
	
	return {
		gameId: gameState.gameId,
		players: gameState.getPlayers().map(serializePlayer),
		statusDeck: [], // Don't serialize the deck to prevent cheating
		revealedCards: [], // Don't need to sync revealed cards
		currentAuction: currentAuction ? serializeAuction(currentAuction) : null,
		gameEndTriggerCount: publicState.gameEndTriggerCount,
		remainingStatusCards: publicState.remainingStatusCards,
		phase: gameState.getCurrentPhase(),
		currentPlayerIndex: gameState.getCurrentPlayerIndex(),
		turnTimerSeconds: gameState.getTurnTimerSeconds()
	};
}

// Deserialization functions
export function deserializeMoneyCard(data: SerializedMoneyCard): MoneyCard {
	return new MoneyCardClass(data.id, data.value, PlayerColor.RED); // Color doesn't matter for sync
}

export function deserializeStatusCard(data: SerializedStatusCard): StatusCard {
	switch (data.type) {
		case 'luxury':
			return new LuxuryCard(data.id, data.name, data.value || 0);
		case 'prestige':
			return new PrestigeCard(data.id, data.name);
		case 'disgrace_faux_pas':
			return new DisgraceFauxPas();
		case 'disgrace_passe':
			return new DisgracePassé();
		case 'disgrace_scandale':
			return new DisgraceScandale();
		default:
			throw new Error(`Unknown card type: ${data.type}`);
	}
}

export function deserializePlayer(data: SerializedPlayer): Player {
	const player = new Player(data.id, data.name, data.color);
	
	// Restore money cards
	const moneyHand = data.moneyHand.map(deserializeMoneyCard);
	const playedMoney = data.playedMoney.map(deserializeMoneyCard);
	
	// Restore status cards
	const statusCards = data.statusCards.map(deserializeStatusCard);
	
	// Set internal state using private property access (needs to be done carefully)
	// This is a workaround - ideally Player class would have restoration methods
	(player as any).moneyHand = moneyHand;
	(player as any).playedMoney = playedMoney;
	statusCards.forEach(card => (player as any).statusCards.push(card));
	(player as any).pendingLuxuryDiscard = data.pendingLuxuryDiscard;
	
	return player;
}

export function deserializeAuction(data: SerializedAuction, players: Player[]): Auction {
	const card = deserializeStatusCard(data.card);
	const auction = data.type === 'regular' 
		? new RegularAuction(card, players)
		: new DisgraceAuction(card, players);
	
	// Restore auction state
	const activePlayersSet = new Set(data.activePlayers);
	(auction as any).activePlayers = activePlayersSet;
	(auction as any).currentHighestBid = data.currentHighestBid;
	
	if (data.winnerId) {
		const winner = players.find(p => p.id === data.winnerId);
		if (winner) {
			(auction as any).currentWinner = winner;
		}
	}
	
	return auction;
}

export function deserializeGameState(data: SerializedGameState, originalGameState?: GameState): GameState {
	// Always create a new GameState to ensure Svelte reactivity triggers
	// Reusing the original game state prevents reactivity updates
	const gameState = new GameState(data.gameId, undefined, data.turnTimerSeconds);
	
	// Restore players
	const players = data.players.map(deserializePlayer);
	(gameState as any).players = players;
	
	// Restore auction if exists
	if (data.currentAuction) {
		const auction = deserializeAuction(data.currentAuction, players);
		(gameState as any).currentAuction = auction;
	} else {
		(gameState as any).currentAuction = null;
	}
	
	// Restore game state
	(gameState as any).gameEndTriggerCount = data.gameEndTriggerCount;
	(gameState as any).phase = data.phase;
	(gameState as any).currentPlayerIndex = data.currentPlayerIndex;
	
	// Restore deck state - we don't have the actual cards but we need the count
	// Create a dummy deck with the correct length to maintain the remainingStatusCards count
	if (data.remainingStatusCards !== undefined) {
		const dummyDeck = new Array(data.remainingStatusCards).fill(null);
		(gameState as any).statusDeck = dummyDeck;
	}
	
	return gameState;
}

/**
 * Apply a partial state update (for optimization)
 * Only updates the fields that have changed
 */
export function applyPartialStateUpdate(
	currentState: GameState,
	updates: Partial<SerializedGameState>
): GameState {
	if (updates.players) {
		(currentState as any).players = updates.players.map(deserializePlayer);
	}
	
	if (updates.currentAuction !== undefined) {
		if (updates.currentAuction === null) {
			(currentState as any).currentAuction = null;
		} else {
			const players = currentState.getPlayers();
			(currentState as any).currentAuction = deserializeAuction(updates.currentAuction, players);
		}
	}
	
	if (updates.phase !== undefined) {
		(currentState as any).phase = updates.phase;
	}
	
	if (updates.currentPlayerIndex !== undefined) {
		(currentState as any).currentPlayerIndex = updates.currentPlayerIndex;
	}
	
	if (updates.gameEndTriggerCount !== undefined) {
		(currentState as any).gameEndTriggerCount = updates.gameEndTriggerCount;
	}
	
	if (updates.remainingStatusCards !== undefined) {
		// Update the dummy deck length to reflect the correct remaining cards count
		const dummyDeck = new Array(updates.remainingStatusCards).fill(null);
		(currentState as any).statusDeck = dummyDeck;
	}
	
	return currentState;
}
