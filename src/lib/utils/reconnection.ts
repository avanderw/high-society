/**
 * Reconnection utility with exponential backoff
 */

export interface ReconnectionConfig {
	maxAttempts?: number;
	initialDelay?: number; // ms
	maxDelay?: number; // ms
	backoffFactor?: number;
}

export class ReconnectionManager {
	private attempts = 0;
	private reconnecting = false;
	private reconnectTimeout: number | null = null;
	private config: Required<ReconnectionConfig>;
	
	private onReconnectCallback?: (attempt: number) => Promise<void>;
	private onSuccessCallback?: () => void;
	private onFailureCallback?: (error: Error) => void;
	private onMaxAttemptsCallback?: () => void;

	constructor(config: ReconnectionConfig = {}) {
		this.config = {
			maxAttempts: config.maxAttempts ?? 10,
			initialDelay: config.initialDelay ?? 1000,
			maxDelay: config.maxDelay ?? 30000,
			backoffFactor: config.backoffFactor ?? 2
		};
	}

	onReconnect(callback: (attempt: number) => Promise<void>): this {
		this.onReconnectCallback = callback;
		return this;
	}

	onSuccess(callback: () => void): this {
		this.onSuccessCallback = callback;
		return this;
	}

	onFailure(callback: (error: Error) => void): this {
		this.onFailureCallback = callback;
		return this;
	}

	onMaxAttempts(callback: () => void): this {
		this.onMaxAttemptsCallback = callback;
		return this;
	}

	async start(): Promise<void> {
		if (this.reconnecting) return;
		
		this.reconnecting = true;
		this.attempts = 0;
		await this.attemptReconnect();
	}

	private async attemptReconnect(): Promise<void> {
		if (!this.reconnecting) return;
		
		this.attempts++;
		
		if (this.attempts > this.config.maxAttempts) {
			this.reconnecting = false;
			if (this.onMaxAttemptsCallback) {
				this.onMaxAttemptsCallback();
			}
			return;
		}

		try {
			if (this.onReconnectCallback) {
				await this.onReconnectCallback(this.attempts);
			}
			
			// Success
			this.reconnecting = false;
			this.attempts = 0;
			if (this.onSuccessCallback) {
				this.onSuccessCallback();
			}
		} catch (error) {
			if (this.onFailureCallback) {
				this.onFailureCallback(error instanceof Error ? error : new Error('Unknown error'));
			}
			
			// Schedule next attempt with exponential backoff
			const delay = Math.min(
				this.config.initialDelay * Math.pow(this.config.backoffFactor, this.attempts - 1),
				this.config.maxDelay
			);
			
			this.reconnectTimeout = window.setTimeout(() => {
				this.attemptReconnect();
			}, delay);
		}
	}

	stop(): void {
		this.reconnecting = false;
		if (this.reconnectTimeout !== null) {
			window.clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
	}

	isReconnecting(): boolean {
		return this.reconnecting;
	}

	getAttempts(): number {
		return this.attempts;
	}

	getNextDelay(): number {
		return Math.min(
			this.config.initialDelay * Math.pow(this.config.backoffFactor, this.attempts),
			this.config.maxDelay
		);
	}
}
