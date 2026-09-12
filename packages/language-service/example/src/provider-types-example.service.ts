import { Inject, Injectable } from "@nexus-ioc/core";

/**
 * Example demonstrating different provider types in Nexus IoC
 *
 * This file shows how to use:
 * - Class providers (shorthand)
 * - useClass providers
 * - useValue providers
 * - useFactory providers with inject dependencies
 */

// ============================================================================
// Service Definitions
// ============================================================================

@Injectable()
export class DatabaseService {
	connect() {
		return "Connected to real database";
	}
}

@Injectable()
export class MockDatabaseService {
	connect() {
		return "Connected to mock database";
	}
}

@Injectable()
export class ConfigService {
	getConfig() {
		return {
			apiUrl: "https://api.example.com",
			timeout: 5000,
		};
	}
}

@Injectable()
export class LoggerService {
	log(message: string) {
		console.log(`[LOG] ${message}`);
	}
}

// ============================================================================
// Services Using Different Provider Types
// ============================================================================

/**
 * Example 1: Using class provider (shorthand)
 * The service is provided directly in the module's providers array
 */
@Injectable()
export class ServiceUsingClassProvider {
	constructor(private database: DatabaseService) {}

	doWork() {
		return this.database.connect();
	}
}

/**
 * Example 2: Using useClass provider
 * Provides a different implementation for a token
 */
@Injectable()
export class ServiceUsingUseClassProvider {
	constructor(@Inject("DB_SERVICE") private database: MockDatabaseService) {}

	doWork() {
		return this.database.connect();
	}
}

/**
 * Example 3: Using useValue provider (string)
 * Injects a static string value
 */
@Injectable()
export class ServiceUsingUseValueString {
	constructor(@Inject("API_KEY") private apiKey: string) {}

	getApiKey() {
		return this.apiKey;
	}
}

/**
 * Example 4: Using useValue provider (number)
 * Injects a static number value
 */
@Injectable()
export class ServiceUsingUseValueNumber {
	constructor(@Inject("PORT") private port: number) {}

	getPort() {
		return this.port;
	}
}

/**
 * Example 5: Using useValue provider (object)
 * Injects a static configuration object
 */
@Injectable()
export class ServiceUsingUseValueObject {
	constructor(
		@Inject("CONFIG") private config: { debug: boolean; timeout: number },
	) {}

	getConfig() {
		return this.config;
	}
}

/**
 * Example 6: Using useFactory provider without inject
 * Factory function with no dependencies
 */
@Injectable()
export class ServiceUsingUseFactoryNoInject {
	constructor(@Inject("TIMESTAMP") private timestamp: number) {}

	getTimestamp() {
		return this.timestamp;
	}
}

/**
 * Example 7: Using useFactory provider with string token inject
 * Factory function that depends on other string token providers
 */
@Injectable()
export class ServiceUsingUseFactoryStringInject {
	constructor(
		@Inject("DATABASE_CONNECTION")
		private connection: { apiKey: string; port: number; connected: boolean },
	) {}

	getConnection() {
		return this.connection;
	}
}

/**
 * Example 8: Using useFactory provider with class token inject
 * Factory function that depends on other class providers
 */
@Injectable()
export class ServiceUsingUseFactoryClassInject {
	constructor(
		@Inject("LOGGER_WITH_CONFIG")
		private loggerWithConfig: { config: ConfigService; logger: LoggerService },
	) {}

	logMessage(message: string) {
		this.loggerWithConfig.logger.log(message);
		return this.loggerWithConfig.config.getConfig();
	}
}

/**
 * Example 9: Using useFactory provider with mixed inject
 * Factory function that depends on both string tokens and class providers
 */
@Injectable()
export class ServiceUsingUseFactoryMixedInject {
	constructor(
		@Inject("MIXED_FACTORY")
		private mixed: { apiKey: string; db: DatabaseService },
	) {}

	getMixed() {
		return this.mixed;
	}
}
