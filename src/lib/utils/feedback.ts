/**
 * Unified feedback system - combines audio and haptic feedback
 * Simplified version using HTML5 audio instead of Web Audio API
 */

export enum FeedbackType {
	CARD_DEAL = 'cardDeal',
	CARD_SELECT = 'cardSelect',
	BID = 'bid',
	PASS = 'pass',
	TURN_CHANGE = 'turnChange',
	AUCTION_WIN = 'auctionWin',
	GAME_END = 'gameEnd',
	ERROR = 'error'
}

interface FeedbackSettings {
	soundEnabled: boolean;
	hapticEnabled: boolean;
	soundVolume: number;
}

// Audio frequency/duration mappings for simple beeps
const soundParams: Record<FeedbackType, { freq: number; duration: number; type?: OscillatorType }> = {
	[FeedbackType.CARD_DEAL]: { freq: 440, duration: 100 },
	[FeedbackType.CARD_SELECT]: { freq: 523, duration: 50 },
	[FeedbackType.BID]: { freq: 659, duration: 150 },
	[FeedbackType.PASS]: { freq: 392, duration: 100 },
	[FeedbackType.TURN_CHANGE]: { freq: 523, duration: 80 },
	[FeedbackType.AUCTION_WIN]: { freq: 784, duration: 200 },
	[FeedbackType.GAME_END]: { freq: 880, duration: 300 },
	[FeedbackType.ERROR]: { freq: 220, duration: 200, type: 'sawtooth' }
};

// Haptic patterns (milliseconds)
const hapticPatterns: Record<FeedbackType, number | number[]> = {
	[FeedbackType.CARD_DEAL]: 15,
	[FeedbackType.CARD_SELECT]: 10,
	[FeedbackType.BID]: 30,
	[FeedbackType.PASS]: 20,
	[FeedbackType.TURN_CHANGE]: 15,
	[FeedbackType.AUCTION_WIN]: [30, 20, 30],
	[FeedbackType.GAME_END]: [40, 30, 40, 30, 40],
	[FeedbackType.ERROR]: [50, 30, 50]
};

class FeedbackManager {
	private settings: FeedbackSettings;
	private audioContext: AudioContext | null = null;

	constructor() {
		this.settings = this.loadSettings();
		if (typeof window !== 'undefined' && 'AudioContext' in window) {
			this.audioContext = new AudioContext();
		}
	}

	private loadSettings(): FeedbackSettings {
		const defaults = { soundEnabled: true, hapticEnabled: true, soundVolume: 0.3 };
		
		if (typeof localStorage === 'undefined') return defaults;

		try {
			const soundEnabled = localStorage.getItem('highSociety_soundEnabled');
			const hapticEnabled = localStorage.getItem('highSociety_hapticsEnabled');
			const soundVolume = localStorage.getItem('highSociety_soundVolume');

			return {
				soundEnabled: soundEnabled ? JSON.parse(soundEnabled) : defaults.soundEnabled,
				hapticEnabled: hapticEnabled ? JSON.parse(hapticEnabled) : defaults.hapticEnabled,
				soundVolume: soundVolume ? parseFloat(soundVolume) : defaults.soundVolume
			};
		} catch {
			return defaults;
		}
	}

	private saveSettings(): void {
		if (typeof localStorage === 'undefined') return;
		
		localStorage.setItem('highSociety_soundEnabled', JSON.stringify(this.settings.soundEnabled));
		localStorage.setItem('highSociety_hapticsEnabled', JSON.stringify(this.settings.hapticEnabled));
		localStorage.setItem('highSociety_soundVolume', this.settings.soundVolume.toString());
	}

	play(type: FeedbackType): void {
		if (this.settings.soundEnabled) {
			this.playSound(type);
		}
		if (this.settings.hapticEnabled) {
			this.playHaptic(type);
		}
	}

	private playSound(type: FeedbackType): void {
		if (!this.audioContext) return;

		try {
			// Resume context if suspended (browser autoplay policy)
			if (this.audioContext.state === 'suspended') {
				this.audioContext.resume();
			}

			const params = soundParams[type];
			const oscillator = this.audioContext.createOscillator();
			const gainNode = this.audioContext.createGain();

			oscillator.connect(gainNode);
			gainNode.connect(this.audioContext.destination);

			oscillator.type = params.type || 'sine';
			oscillator.frequency.value = params.freq;
			
			gainNode.gain.setValueAtTime(this.settings.soundVolume, this.audioContext.currentTime);
			gainNode.gain.exponentialRampToValueAtTime(
				0.01,
				this.audioContext.currentTime + params.duration / 1000
			);

			oscillator.start();
			oscillator.stop(this.audioContext.currentTime + params.duration / 1000);
		} catch (error) {
			console.warn('Sound playback failed:', error);
		}
	}

	private playHaptic(type: FeedbackType): void {
		if (typeof navigator === 'undefined' || !navigator.vibrate) return;

		try {
			navigator.vibrate(hapticPatterns[type]);
		} catch (error) {
			console.warn('Haptic feedback failed:', error);
		}
	}

	setSoundEnabled(enabled: boolean): void {
		this.settings.soundEnabled = enabled;
		this.saveSettings();
	}

	setHapticEnabled(enabled: boolean): void {
		this.settings.hapticEnabled = enabled;
		this.saveSettings();
	}

	setSoundVolume(volume: number): void {
		this.settings.soundVolume = Math.max(0, Math.min(1, volume));
		this.saveSettings();
	}

	getSettings(): Readonly<FeedbackSettings> {
		return { ...this.settings };
	}
}

// Singleton instance
export const feedback = new FeedbackManager();
