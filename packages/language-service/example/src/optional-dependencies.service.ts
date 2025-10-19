import { Inject, Injectable, Optional } from '@nexus-ioc/core';
import { LoggerService } from './logger.service';
import { CacheService } from './cache.service';
import { ConfigService } from './config.service';

/**
 * Example service demonstrating the use of @Optional() decorator
 * 
 * This service has both required and optional dependencies:
 * - ConfigService is REQUIRED - will cause an error if not provided
 * - LoggerService is OPTIONAL - no error if not provided
 * - CacheService is OPTIONAL - no error if not provided
 * 
 * The @Optional() decorator tells the IoC container that these dependencies
 * may or may not be available, and the service should handle their absence gracefully.
 */
@Injectable()
export class OptionalDependenciesService {
  constructor(
    // Required dependency - MUST be provided in the module
    @Inject(ConfigService)
    private readonly config: ConfigService,

    // Optional dependency - may be undefined
    @Inject(LoggerService)
    @Optional()
    private readonly logger?: LoggerService,

    // Optional dependency with string token - may be undefined
    @Inject('CACHE_SERVICE')
    @Optional()
    private readonly cache?: CacheService,
  ) {
    this.initialize();
  }

  private initialize(): void {
    // Always safe to use required dependencies
    const apiKey = this.config.getApiKey();

    // Check if optional dependencies are available before using them
    if (this.logger) {
      this.logger.log(`Initializing with API key: ${apiKey.substring(0, 10)}...`);
    } else {
      console.log(`Initializing without logger`);
    }

    if (this.cache) {
      console.log('Cache service is available');
    } else {
      console.log('Cache service is not available - using in-memory fallback');
    }
  }

  public performOperation(data: string): void {
    // Use optional logger if available
    this.logger?.log(`Performing operation with data: ${data}`);

    // Use optional cache if available
    if (this.cache) {
      this.cache.set('last-operation', data);
    }

    // Required config is always available
    const dbConfig = this.config.getDatabaseConfig();
    console.log(`Database host: ${dbConfig.host}`);
  }

  public getStatus(): string {
    const hasLogger = this.logger ? 'enabled' : 'disabled';
    const hasCache = this.cache ? 'enabled' : 'disabled';
    
    return `Logger: ${hasLogger}, Cache: ${hasCache}`;
  }
}

