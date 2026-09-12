/**
 * Minimal logger interface for type-checker package
 *
 * This interface allows the type-checker to be framework-agnostic
 * while still supporting optional logging for debugging.
 *
 * Implementations can provide their own logging mechanisms
 * (file logging, console logging, remote logging, etc.)
 */
export interface ILogger {
	/**
	 * Log a message
	 * @param message - The message to log
	 */
	log(message: string): void;
}

/**
 * No-op logger implementation for when logging is not needed
 *
 * This is useful for:
 * - Production environments where logging overhead is not desired
 * - Testing scenarios where log output is not relevant
 * - Contexts where a logger is required but not used
 *
 * @example
 * ```typescript
 * import { InjectParser, NoOpLogger } from '@nexus-ioc/type-checker';
 *
 * const logger = new NoOpLogger();
 * const params = InjectParser.execute(classDeclaration, logger);
 * ```
 */
export class NoOpLogger implements ILogger {
	/**
	 * No-op log method - does nothing
	 * @param _message - The message to log (ignored)
	 */
	log(_message: string): void {
		// Intentionally empty - no logging performed
	}
}
