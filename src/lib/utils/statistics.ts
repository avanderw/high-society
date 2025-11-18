/**
 * Game statistics tracking
 */

export interface GameStats {
	gamesPlayed: number;
	gamesWon: number;
	totalStatusEarned: number;
	totalMoneySpent: number;
	highestScore: number;
	timesCastOut: number;
	luxuryCardsWon: Record<string, number>; // Card name -> count
	prestigeCardsWon: number;
	disgraceCardsReceived: number;
	averageFinalMoney: number;
	lastPlayed: string; // ISO date
}

const STATS_KEY = 'highSociety_stats';

function getDefaultStats(): GameStats {
	return {
		gamesPlayed: 0,
		gamesWon: 0,
		totalStatusEarned: 0,
		totalMoneySpent: 0,
		highestScore: 0,
		timesCastOut: 0,
		luxuryCardsWon: {},
		prestigeCardsWon: 0,
		disgraceCardsReceived: 0,
		averageFinalMoney: 0,
		lastPlayed: new Date().toISOString()
	};
}

export function loadStats(): GameStats {
	if (typeof localStorage === 'undefined') {
		return getDefaultStats();
	}

	try {
		const stored = localStorage.getItem(STATS_KEY);
		if (!stored) {
			return getDefaultStats();
		}
		return { ...getDefaultStats(), ...JSON.parse(stored) };
	} catch (error) {
		console.warn('Failed to load stats:', error);
		return getDefaultStats();
	}
}

export function saveStats(stats: GameStats): void {
	if (typeof localStorage === 'undefined') return;

	try {
		localStorage.setItem(STATS_KEY, JSON.stringify(stats));
	} catch (error) {
		console.error('Failed to save stats:', error);
	}
}

export function updateStatsAfterGame(
	won: boolean,
	finalStatus: number,
	moneySpent: number,
	finalMoney: number,
	castOut: boolean,
	luxuryCards: string[],
	prestigeCount: number,
	disgraceCount: number
): GameStats {
	const stats = loadStats();

	stats.gamesPlayed++;
	if (won) stats.gamesWon++;
	stats.totalStatusEarned += finalStatus;
	stats.totalMoneySpent += moneySpent;
	if (finalStatus > stats.highestScore) stats.highestScore = finalStatus;
	if (castOut) stats.timesCastOut++;
	stats.prestigeCardsWon += prestigeCount;
	stats.disgraceCardsReceived += disgraceCount;

	// Update luxury cards won
	luxuryCards.forEach(cardName => {
		stats.luxuryCardsWon[cardName] = (stats.luxuryCardsWon[cardName] || 0) + 1;
	});

	// Update average final money
	const totalGames = stats.gamesPlayed;
	const prevTotal = stats.averageFinalMoney * (totalGames - 1);
	stats.averageFinalMoney = (prevTotal + finalMoney) / totalGames;

	stats.lastPlayed = new Date().toISOString();

	saveStats(stats);
	return stats;
}

export function resetStats(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(STATS_KEY);
}

export function getWinRate(stats: GameStats): number {
	if (stats.gamesPlayed === 0) return 0;
	return (stats.gamesWon / stats.gamesPlayed) * 100;
}

export function getAverageScore(stats: GameStats): number {
	if (stats.gamesPlayed === 0) return 0;
	return stats.totalStatusEarned / stats.gamesPlayed;
}

export function getAverageMoneySpent(stats: GameStats): number {
	if (stats.gamesPlayed === 0) return 0;
	return stats.totalMoneySpent / stats.gamesPlayed;
}

export function getMostWonLuxuryCard(stats: GameStats): { name: string; count: number } | null {
	const entries = Object.entries(stats.luxuryCardsWon);
	if (entries.length === 0) return null;

	let max = entries[0];
	for (const entry of entries) {
		if (entry[1] > max[1]) {
			max = entry;
		}
	}

	return { name: max[0], count: max[1] };
}
