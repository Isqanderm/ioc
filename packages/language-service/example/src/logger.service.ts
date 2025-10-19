import { Injectable } from "@nexus-ioc/core";

/**
 * Logger service for application logging
 */
@Injectable()
export class LoggerService {
	log(message: string): void {
		console.log(`[LOG] ${new Date().toISOString()} - ${message}`);
	}

	error(message: string, error?: Error): void {
		console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
	}

	warn(message: string): void {
		console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
	}

	debug(message: string): void {
		console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`);
	}
}
