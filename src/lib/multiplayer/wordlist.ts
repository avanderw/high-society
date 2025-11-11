// Word list for generating memorable room codes
// Using 100 words gives us 100^3 = 1,000,000 possible combinations

export const WORD_LIST = [
	'apple', 'banana', 'cherry', 'dragon', 'eagle', 'falcon', 'guitar', 'hammer', 'island', 'jungle',
	'kitten', 'lemon', 'mango', 'ninja', 'ocean', 'panda', 'queen', 'rabbit', 'sunset', 'tiger',
	'umbrella', 'violet', 'walrus', 'xylophone', 'yellow', 'zebra', 'anchor', 'bridge', 'castle', 'diamond',
	'engine', 'forest', 'garden', 'harbor', 'igloo', 'jacket', 'kettle', 'laptop', 'marble', 'nugget',
	'orange', 'pencil', 'quartz', 'rocket', 'silver', 'temple', 'unicorn', 'valley', 'winter', 'wizard',
	'arctic', 'bronze', 'canyon', 'desert', 'empire', 'flame', 'glacier', 'horizon', 'iron', 'jasper',
	'knight', 'lunar', 'meteor', 'nebula', 'opal', 'phoenix', 'quantum', 'river', 'storm', 'thunder',
	'unity', 'vortex', 'wave', 'xenon', 'youth', 'zephyr', 'amber', 'blaze', 'coral', 'dawn',
	'ember', 'frost', 'golden', 'haven', 'iris', 'jade', 'karma', 'lotus', 'mystic', 'nova',
	'orchid', 'prism', 'quest', 'raven', 'sage', 'terra', 'urban', 'viper', 'willow', 'zenith'
];

/**
 * Generate a three-word room code
 * Returns a string like "apple-banana-cherry"
 */
export function generateRoomCode(): string {
	const word1 = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
	const word2 = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
	const word3 = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
	return `${word1}-${word2}-${word3}`;
}

/**
 * Validate a room code format
 * Returns true if the code is in the format "word-word-word"
 */
export function isValidRoomCode(code: string): boolean {
	const parts = code.toLowerCase().split('-');
	if (parts.length !== 3) return false;
	return parts.every(word => WORD_LIST.includes(word));
}

/**
 * Normalize a room code to lowercase with hyphens
 */
export function normalizeRoomCode(code: string): string {
	return code.toLowerCase().trim().replace(/\s+/g, '-');
}
