/**
 * Haptic feedback utilities for mobile devices
 */

export enum HapticPattern {
	LIGHT = 'light',
	MEDIUM = 'medium',
	HEAVY = 'heavy',
	SUCCESS = 'success',
	WARNING = 'warning',
	ERROR = 'error',
	SELECTION = 'selection'
}

const patterns: Record<HapticPattern, number | number[]> = {
	[HapticPattern.LIGHT]: 10,
	[HapticPattern.MEDIUM]: 20,
	[HapticPattern.HEAVY]: 40,
	[HapticPattern.SUCCESS]: [30, 20, 30],
	[HapticPattern.WARNING]: [20, 10, 20, 10, 20],
	[HapticPattern.ERROR]: [50, 30, 50, 30, 50],
	[HapticPattern.SELECTION]: 15
};

let hapticEnabled = true;

/**
 * Trigger haptic feedback with the specified pattern
 */
export function vibrate(pattern: HapticPattern | number | number[]): void {
	if (!hapticEnabled) return;
	
	if (typeof window === 'undefined' || !navigator.vibrate) return;
	
	try {
		if (typeof pattern === 'string') {
			navigator.vibrate(patterns[pattern]);
		} else {
			navigator.vibrate(pattern);
		}
	} catch (error) {
		console.warn('Haptic feedback failed:', error);
	}
}

/**
 * Enable or disable haptic feedback
 */
export function setHapticEnabled(enabled: boolean): void {
	hapticEnabled = enabled;
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('highSociety_hapticsEnabled', JSON.stringify(enabled));
	}
}

/**
 * Check if haptics are enabled
 */
export function isHapticEnabled(): boolean {
	return hapticEnabled;
}

/**
 * Initialize haptic settings from localStorage
 */
export function initHaptics(): void {
	if (typeof localStorage !== 'undefined') {
		const stored = localStorage.getItem('highSociety_hapticsEnabled');
		if (stored !== null) {
			hapticEnabled = JSON.parse(stored);
		}
	}
}

/**
 * Check if device supports haptic feedback
 */
export function isHapticSupported(): boolean {
	return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}
