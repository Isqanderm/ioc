import { Injectable, Inject, Optional } from "@nexus-ioc/core";
import { CacheService } from "./cache.service";
import { GlobalLoggerService } from "./global-logger.service";

/**
 * Service demonstrating optional property injection
 * 
 * This demonstrates:
 * - Optional property injection using @Optional() decorator
 * - Properties that may or may not be provided
 * - No errors should be shown for missing optional property dependencies
 */
@Injectable()
export class OptionalPropertyInjectionService {
	/**
	 * Optional property injection
	 * Try:
	 * 1. Remove CacheService from module providers - should NOT show error
	 * 2. The service should still work without cache
	 */
	@Inject(CacheService)
	@Optional()
	private cache?: CacheService;

	/**
	 * Another optional property injection
	 * This one is provided by a global module, so it will be available
	 */
	@Inject(GlobalLoggerService)
	@Optional()
	private logger?: GlobalLoggerService;

	async processData(key: string, value: string): Promise<string> {
		// Try to get from cache first
		if (this.cache) {
			const cached = this.cache.get(key);
			if (cached) {
				this.logger?.log(`Cache hit for key: ${key}`);
				return cached;
			}
		}

		// Process the data
		const result = `Processed: ${value}`;

		// Store in cache if available
		if (this.cache) {
			this.cache.set(key, result);
			this.logger?.log(`Cached result for key: ${key}`);
		} else {
			this.logger?.warn("Cache not available, skipping caching");
		}

		return result;
	}

	getStatus(): string {
		return `
			Optional Property Injection Service:
			- Cache: ${this.cache ? "available" : "not available"}
			- Logger: ${this.logger ? "available" : "not available"}
		`;
	}
}

