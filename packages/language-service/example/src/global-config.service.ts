import { Injectable } from "@nexus-ioc/core";

/**
 * Global configuration service
 *
 * This service is provided by a global module and is available
 * to all modules in the application without explicit imports.
 */
@Injectable()
export class GlobalConfigService {
	private readonly config = {
		apiUrl: "https://api.example.com",
		apiKey: "global-api-key-12345",
		timeout: 5000,
		retryAttempts: 3,
	};

	getApiUrl(): string {
		return this.config.apiUrl;
	}

	getApiKey(): string {
		return this.config.apiKey;
	}

	getTimeout(): number {
		return this.config.timeout;
	}

	getRetryAttempts(): number {
		return this.config.retryAttempts;
	}

	getFullConfig() {
		return { ...this.config };
	}
}
