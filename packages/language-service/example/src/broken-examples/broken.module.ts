import { NsModule } from "@nexus-ioc/core";
import { LoggerService } from "../logger.service";
import { MissingDependencyService } from "./missing-dependency.service";
import { TypeMismatchService } from "./type-mismatch.service";

/**
 * Module for broken examples
 *
 * This module intentionally includes services with errors
 * to demonstrate the plugin's diagnostic capabilities.
 *
 * Note: OrphanService is NOT included here - that's the point!
 */
@NsModule({
	providers: [
		MissingDependencyService,
		TypeMismatchService,
		LoggerService, // Provided so TypeMismatchService can inject it (but with wrong type)
	],
})
export class BrokenModule {}
