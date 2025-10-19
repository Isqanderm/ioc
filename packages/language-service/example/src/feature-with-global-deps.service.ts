import { Inject, Injectable } from "@nexus-ioc/core";
import { GlobalConfigService } from "./global-config.service";
import { GlobalLoggerService } from "./global-logger.service";

/**
 * Feature service that uses global dependencies
 *
 * This service demonstrates how to use services from global modules.
 * Notice that:
 * - GlobalConfigService and GlobalLoggerService are injected
 * - The module containing this service does NOT need to import
 *   GlobalConfigModule or GlobalLoggerModule
 * - The language service plugin will NOT show errors for these dependencies
 *   because they are provided by global modules
 */
@Injectable()
export class FeatureWithGlobalDepsService {
	constructor(
		@Inject(GlobalConfigService) private config: GlobalConfigService,
		@Inject(GlobalLoggerService) private logger: GlobalLoggerService,
	) {
		this.logger.log("FeatureWithGlobalDepsService initialized");
	}

	async fetchData(): Promise<string> {
		const apiUrl = this.config.getApiUrl();
		const _apiKey = this.config.getApiKey();

		this.logger.log(`Fetching data from ${apiUrl}`);

		// Simulate API call
		return new Promise((resolve) => {
			setTimeout(() => {
				this.logger.log("Data fetched successfully");
				resolve(`Data from ${apiUrl} with key [REDACTED]`);
			}, 100);
		});
	}

	getConfiguration() {
		this.logger.log("Getting configuration");
		return this.config.getFullConfig();
	}
}
