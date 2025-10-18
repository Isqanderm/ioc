import { Injectable, Inject } from 'nexus-ioc';
import { ConfigService } from '../../core/config/config.service';
import { LoggerService } from '../../core/logger/logger.service';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
}

@Injectable()
export class CacheService {
  private cache: Map<string, { value: unknown; expiresAt: number }> = new Map();

  constructor(
    @Inject(ConfigService) private configService: ConfigService,
    @Inject(LoggerService) private logger: LoggerService
  ) {
    const redisConfig = this.configService.get('redis');
    this.logger.info(`Cache service initialized (Redis: ${redisConfig.host}:${redisConfig.port})`, 'CacheService');
  }

  async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    
    if (!cached) {
      this.logger.debug(`Cache miss for key: ${key}`, 'CacheService');
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      this.logger.debug(`Cache expired for key: ${key}`, 'CacheService');
      return null;
    }

    this.logger.debug(`Cache hit for key: ${key}`, 'CacheService');
    return cached.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || 3600; // Default 1 hour
    const expiresAt = Date.now() + ttl * 1000;

    this.cache.set(key, { value, expiresAt });
    this.logger.debug(`Cache set for key: ${key} (TTL: ${ttl}s)`, 'CacheService');
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.logger.debug(`Cache deleted for key: ${key}`, 'CacheService');
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.info('Cache cleared', 'CacheService');
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }
}

