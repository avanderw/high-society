/**
 * Standardized Logging Utility
 * 
 * Provides consistent logging across the application with:
 * - Contextual prefixes
 * - Log levels (debug, info, warn, error)
 * - Environment-aware logging (can disable in production)
 * - Structured output format
 */

export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
	NONE = 4
}

class Logger {
	private level: LogLevel = LogLevel.DEBUG;
	private enabled: boolean = true;

	constructor() {
		// Disable logging in production builds
		if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
			this.level = LogLevel.WARN;
		}
		
		// Allow override via environment
		const envLevel = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_LOG_LEVEL : undefined;
		if (envLevel) {
			this.setLevel(envLevel as keyof typeof LogLevel);
		}
	}

	setLevel(level: keyof typeof LogLevel): void {
		this.level = LogLevel[level];
	}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	private shouldLog(level: LogLevel): boolean {
		return this.enabled && level >= this.level;
	}

	private formatMessage(context: string, message: string, data?: unknown): unknown[] {
		const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
		const prefix = `[${timestamp}] [${context}]`;
		
		if (data !== undefined) {
			return [prefix, message, data];
		}
		return [prefix, message];
	}

	debug(context: string, message: string, data?: unknown): void {
		if (this.shouldLog(LogLevel.DEBUG)) {
			console.log(...this.formatMessage(context, message, data));
		}
	}

	info(context: string, message: string, data?: unknown): void {
		if (this.shouldLog(LogLevel.INFO)) {
			console.info(...this.formatMessage(context, message, data));
		}
	}

	warn(context: string, message: string, data?: unknown): void {
		if (this.shouldLog(LogLevel.WARN)) {
			console.warn(...this.formatMessage(context, message, data));
		}
	}

	error(context: string, message: string, error?: unknown): void {
		if (this.shouldLog(LogLevel.ERROR)) {
			const args = this.formatMessage(context, message, error);
			console.error(...args);
			
			// Log stack trace if available
			if (error instanceof Error && error.stack) {
				console.error(error.stack);
			}
		}
	}

	/**
	 * Group related logs together (useful for complex operations)
	 */
	group(label: string, fn: () => void): void {
		if (this.shouldLog(LogLevel.DEBUG)) {
			console.group(label);
			try {
				fn();
			} finally {
				console.groupEnd();
			}
		} else {
			fn();
		}
	}
}

// Singleton instance
export const logger = new Logger();

/**
 * Context-specific loggers for different parts of the application
 */
export const loggers = {
	domain: {
		gameState: (msg: string, data?: unknown) => logger.debug('GameState', msg, data),
		auction: (msg: string, data?: unknown) => logger.debug('Auction', msg, data),
		player: (msg: string, data?: unknown) => logger.debug('Player', msg, data),
		scoring: (msg: string, data?: unknown) => logger.debug('Scoring', msg, data),
	},
	multiplayer: {
		service: (msg: string, data?: unknown) => logger.debug('MultiplayerService', msg, data),
		orchestrator: (msg: string, data?: unknown) => logger.debug('MultiplayerOrchestrator', msg, data),
		serialization: (msg: string, data?: unknown) => logger.debug('Serialization', msg, data),
	},
	ui: {
		page: (msg: string, data?: unknown) => logger.debug('UI:Page', msg, data),
		component: (name: string) => (msg: string, data?: unknown) => logger.debug(`UI:${name}`, msg, data),
	},
	relay: {
		server: (msg: string, data?: unknown) => logger.info('RelayServer', msg, data),
		connection: (msg: string, data?: unknown) => logger.debug('RelayServer:Connection', msg, data),
		room: (msg: string, data?: unknown) => logger.debug('RelayServer:Room', msg, data),
	}
};
