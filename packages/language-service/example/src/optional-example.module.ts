import { NsModule } from '@nexus-ioc/core';
import { ConfigService } from './config.service';
import { LoggerService } from './logger.service';
import { OptionalDependenciesService } from './optional-dependencies.service';

/**
 * Example module demonstrating optional dependencies
 * 
 * This module provides:
 * - ConfigService (required by OptionalDependenciesService)
 * - LoggerService (optional dependency)
 * - OptionalDependenciesService
 * 
 * Notice that CacheService is NOT provided, but OptionalDependenciesService
 * won't show an error because it's marked as @Optional()
 * 
 * Try these experiments in VS Code:
 * 1. Remove LoggerService from providers - no error (it's optional)
 * 2. Remove ConfigService from providers - ERROR (it's required)
 * 3. Add CacheService to providers - service will use it
 */
@NsModule({
  providers: [
    ConfigService,
    LoggerService,
    // CacheService is intentionally NOT provided to demonstrate optional dependencies
    OptionalDependenciesService,
  ],
  exports: [OptionalDependenciesService],
})
export class OptionalExampleModule {}

