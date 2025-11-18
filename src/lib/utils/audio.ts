/**
 * Audio feedback utilities for game events
 */

export enum SoundEffect {
	CARD_DEAL = 'cardDeal',
	CARD_SELECT = 'cardSelect',
	BID_PLACE = 'bidPlace',
	PASS = 'pass',
	TURN_CHANGE = 'turnChange',
	AUCTION_WIN = 'auctionWin',
	GAME_END = 'gameEnd',
	ERROR = 'error'
}

// Simple procedural audio generation using Web Audio API
class AudioManager {
	private context: AudioContext | null = null;
	private enabled = true;
	private volume = 0.3;

	constructor() {
		if (typeof window !== 'undefined' && 'AudioContext' in window) {
			this.context = new AudioContext();
		}
		this.loadSettings();
	}

	private loadSettings(): void {
		if (typeof localStorage !== 'undefined') {
			const enabled = localStorage.getItem('highSociety_soundEnabled');
			if (enabled !== null) {
				this.enabled = JSON.parse(enabled);
			}
			const volume = localStorage.getItem('highSociety_soundVolume');
			if (volume !== null) {
				this.volume = parseFloat(volume);
			}
		}
	}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('highSociety_soundEnabled', JSON.stringify(enabled));
		}
	}

	setVolume(volume: number): void {
		this.volume = Math.max(0, Math.min(1, volume));
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('highSociety_soundVolume', this.volume.toString());
		}
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	getVolume(): number {
		return this.volume;
	}

	play(effect: SoundEffect): void {
		if (!this.enabled || !this.context) return;

		// Resume context if needed (for user interaction requirement)
		if (this.context.state === 'suspended') {
			this.context.resume();
		}

		try {
			switch (effect) {
				case SoundEffect.CARD_DEAL:
					this.playCardDeal();
					break;
				case SoundEffect.CARD_SELECT:
					this.playCardSelect();
					break;
				case SoundEffect.BID_PLACE:
					this.playBidPlace();
					break;
				case SoundEffect.PASS:
					this.playPass();
					break;
				case SoundEffect.TURN_CHANGE:
					this.playTurnChange();
					break;
				case SoundEffect.AUCTION_WIN:
					this.playAuctionWin();
					break;
				case SoundEffect.GAME_END:
					this.playGameEnd();
					break;
				case SoundEffect.ERROR:
					this.playError();
					break;
			}
		} catch (error) {
			console.warn('Audio playback failed:', error);
		}
	}

	private playCardDeal(): void {
		if (!this.context) return;
		const now = this.context.currentTime;
		const osc = this.context.createOscillator();
		const gain = this.context.createGain();

		osc.connect(gain);
		gain.connect(this.context.destination);

		osc.frequency.setValueAtTime(400, now);
		osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
		gain.gain.setValueAtTime(this.volume * 0.2, now);
		gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

		osc.start(now);
		osc.stop(now + 0.05);
	}

	private playCardSelect(): void {
		if (!this.context) return;
		const now = this.context.currentTime;
		const osc = this.context.createOscillator();
		const gain = this.context.createGain();

		osc.connect(gain);
		gain.connect(this.context.destination);

		osc.frequency.setValueAtTime(600, now);
		gain.gain.setValueAtTime(this.volume * 0.15, now);
		gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

		osc.start(now);
		osc.stop(now + 0.04);
	}

	private playBidPlace(): void {
		if (!this.context) return;
		const now = this.context.currentTime;
		const osc = this.context.createOscillator();
		const gain = this.context.createGain();

		osc.connect(gain);
		gain.connect(this.context.destination);

		osc.frequency.setValueAtTime(440, now);
		osc.frequency.setValueAtTime(550, now + 0.05);
		gain.gain.setValueAtTime(this.volume * 0.25, now);
		gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

		osc.start(now);
		osc.stop(now + 0.1);
	}

	private playPass(): void {
		if (!this.context) return;
		const now = this.context.currentTime;
		const osc = this.context.createOscillator();
		const gain = this.context.createGain();

		osc.connect(gain);
		gain.connect(this.context.destination);

		osc.frequency.setValueAtTime(300, now);
		osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
		gain.gain.setValueAtTime(this.volume * 0.2, now);
		gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

		osc.start(now);
		osc.stop(now + 0.15);
	}

	private playTurnChange(): void {
		if (!this.context) return;
		const now = this.context.currentTime;
		const osc = this.context.createOscillator();
		const gain = this.context.createGain();

		osc.connect(gain);
		gain.connect(this.context.destination);

		osc.frequency.setValueAtTime(523.25, now); // C5
		osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
		gain.gain.setValueAtTime(this.volume * 0.2, now);
		gain.gain.setValueAtTime(this.volume * 0.2, now + 0.08);
		gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

		osc.start(now);
		osc.stop(now + 0.16);
	}

	private playAuctionWin(): void {
		if (!this.context) return;
		const now = this.context.currentTime;
		const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
		
		notes.forEach((freq, i) => {
			const osc = this.context!.createOscillator();
			const gain = this.context!.createGain();

			osc.connect(gain);
			gain.connect(this.context!.destination);

			const startTime = now + i * 0.1;
			osc.frequency.setValueAtTime(freq, startTime);
			gain.gain.setValueAtTime(this.volume * 0.25, startTime);
			gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

			osc.start(startTime);
			osc.stop(startTime + 0.2);
		});
	}

	private playGameEnd(): void {
		if (!this.context) return;
		const now = this.context.currentTime;
		const melody = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
		
		melody.forEach((freq, i) => {
			const osc = this.context!.createOscillator();
			const gain = this.context!.createGain();

			osc.connect(gain);
			gain.connect(this.context!.destination);

			const startTime = now + i * 0.15;
			osc.frequency.setValueAtTime(freq, startTime);
			gain.gain.setValueAtTime(this.volume * 0.3, startTime);
			gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

			osc.start(startTime);
			osc.stop(startTime + 0.3);
		});
	}

	private playError(): void {
		if (!this.context) return;
		const now = this.context.currentTime;
		const osc = this.context.createOscillator();
		const gain = this.context.createGain();

		osc.connect(gain);
		gain.connect(this.context.destination);

		osc.frequency.setValueAtTime(200, now);
		osc.frequency.setValueAtTime(150, now + 0.1);
		gain.gain.setValueAtTime(this.volume * 0.25, now);
		gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

		osc.start(now);
		osc.stop(now + 0.2);
	}
}

// Singleton instance
let audioManager: AudioManager | null = null;

export function getAudioManager(): AudioManager {
	if (!audioManager) {
		audioManager = new AudioManager();
	}
	return audioManager;
}

export function playSound(effect: SoundEffect): void {
	getAudioManager().play(effect);
}

export function setSoundEnabled(enabled: boolean): void {
	getAudioManager().setEnabled(enabled);
}

export function setSoundVolume(volume: number): void {
	getAudioManager().setVolume(volume);
}

export function isSoundEnabled(): boolean {
	return getAudioManager().isEnabled();
}

export function getSoundVolume(): number {
	return getAudioManager().getVolume();
}
