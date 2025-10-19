import { NsModule } from "@nexus-ioc/core";
import { DatabaseService } from "./database.service";
import { LoggerService } from "./logger.service";
import { CacheService } from "./cache.service";
import { PropertyInjectionService } from "./property-injection.service";
import { OptionalPropertyInjectionService } from "./optional-property-injection.service";

/**
 * Module demonstrating property injection features
 * 
 * This module provides:
 * - PropertyInjectionService (uses property injection)
 * - OptionalPropertyInjectionService (uses optional property injection)
 * - All required dependencies
 * 
 * Try:
 * 1. Remove DatabaseService from providers - should show error in PropertyInjectionService
 * 2. Remove CacheService from providers - should NOT show error (it's optional)
 * 3. Add/remove services to see how property injection diagnostics work
 */
@NsModule({
	providers: [
		DatabaseService,
		LoggerService,
		// CacheService is intentionally commented out to demonstrate optional dependencies
		// CacheService,
		PropertyInjectionService,
		OptionalPropertyInjectionService,
		{ provide: "API_KEY", useValue: "test-api-key-123" },
	],
})
export class PropertyInjectionModule {}

