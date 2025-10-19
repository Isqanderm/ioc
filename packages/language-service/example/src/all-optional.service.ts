import { Inject, Injectable, Optional } from '@nexus-ioc/core';
import { LoggerService } from './logger.service';
import { CacheService } from './cache.service';

/**
 * Example service where ALL dependencies are optional
 * 
 * This demonstrates a service that can work with or without any dependencies.
 * This is useful for:
 * - Plugin systems where features are optional
 * - Services that have fallback implementations
 * - Cross-cutting concerns like logging, caching, monitoring
 * 
 * The Language Service Plugin will NOT show any errors for this service
 * even if it's not included in any module, because all dependencies are optional.
 */
@Injectable()
export class AllOptionalService {
  constructor(
    @Inject(LoggerService)
    @Optional()
    private readonly logger?: LoggerService,

    @Inject(CacheService)
    @Optional()
    private readonly cache?: CacheService,
  ) {}

  public doWork(data: string): void {
    // Gracefully handle missing dependencies
    this.logger?.log(`Processing: ${data}`);
    
    if (this.cache) {
      this.cache.set('last-work', data);
    } else {
      // Fallback behavior when cache is not available
      console.log('Cache not available, skipping cache operation');
    }
  }

  public getCapabilities(): string[] {
    const capabilities: string[] = ['basic-processing'];
    
    if (this.logger) {
      capabilities.push('logging');
    }
    
    if (this.cache) {
      capabilities.push('caching');
    }
    
    return capabilities;
  }
}

