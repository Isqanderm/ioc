import { Injectable } from "@nexus-ioc/core";

/**
 * Global logger service
 *
 * This service is provided by a global module and is available
 * to all modules in the application without explicit imports.
 */
@Injectable()
export class GlobalLoggerService {
	private logs: string[] = [];

	log(message: string): void {
		const timestamp = new Date().toISOString();
		const logEntry = `[${timestamp}] ${message}`;
		this.logs.push(logEntry);
		console.log(logEntry);
	}

	error(message: string): void {
		const timestamp = new Date().toISOString();
		const logEntry = `[${timestamp}] ERROR: ${message}`;
		this.logs.push(logEntry);
		console.error(logEntry);
	}

	warn(message: string): void {
		const timestamp = new Date().toISOString();
		const logEntry = `[${timestamp}] WARN: ${message}`;
		this.logs.push(logEntry);
		console.warn(logEntry);
	}

	getLogs(): string[] {
		return [...this.logs];
	}

	clearLogs(): void {
		this.logs = [];
	}
}
