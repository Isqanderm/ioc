import { Injectable, Inject } from "@nexus-ioc/core";

/**
 * Configuration service that uses string token injection
 * 
 * This demonstrates:
 * - Injecting string tokens
 * - Auto-completion should suggest 'API_KEY' and 'DATABASE_CONFIG'
 * - Go-to-definition should work on string tokens
 */
@Injectable()
export class ConfigService {
	constructor(
		@Inject("API_KEY") private apiKey: string,
		@Inject("DATABASE_CONFIG") private dbConfig: DatabaseConfig,
	) {}

	getApiKey(): string {
		return this.apiKey;
	}

	getDatabaseConfig(): DatabaseConfig {
		return this.dbConfig;
	}
}

export interface DatabaseConfig {
	host: string;
	port: number;
	database: string;
	username: string;
	password: string;
}

