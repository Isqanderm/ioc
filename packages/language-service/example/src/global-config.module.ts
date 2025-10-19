import { Global, NsModule } from "@nexus-ioc/core";
import { GlobalConfigService } from "./global-config.service";

/**
 * Global configuration module
 *
 * This module is marked with @Global() decorator, which means its
 * exported providers (GlobalConfigService) are available to ALL modules
 * in the application without needing to import this module explicitly.
 *
 * Use global modules for:
 * - Configuration services
 * - Logging services
 * - Authentication/authorization services
 * - Other cross-cutting concerns
 */
@Global()
@NsModule({
	providers: [GlobalConfigService],
	exports: [GlobalConfigService],
})
export class GlobalConfigModule {}
