import { Injectable } from "@nexus-ioc/core";

/**
 * Simple cache service for demonstration purposes
 * This service is used as an optional dependency in examples
 */
@Injectable()
export class CacheService {
	private cache = new Map<string, unknown>();

	public set(key: string, value: unknown): void {
		this.cache.set(key, value);
		console.log(`[CacheService] Set ${key}`);
	}

	public get<T>(key: string): T | undefined {
		return this.cache.get(key) as T | undefined;
	}

	public has(key: string): boolean {
		return this.cache.has(key);
	}

	public clear(): void {
		this.cache.clear();
		console.log("[CacheService] Cache cleared");
	}
}
