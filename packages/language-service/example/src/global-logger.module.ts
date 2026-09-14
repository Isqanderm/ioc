import { Global, Module } from "@nexus-ioc/core";
import { GlobalLoggerService } from "./global-logger.service";

/**
 * Global logger module
 *
 * This module is marked with @Global() decorator, which means its
 * exported providers (GlobalLoggerService) are available to ALL modules
 * in the application without needing to import this module explicitly.
 */
@Global()
@Module({
	providers: [GlobalLoggerService],
	exports: [GlobalLoggerService],
})
export class GlobalLoggerModule {}
