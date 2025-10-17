/**
 * Lifecycle hook interface for module initialization.
 *
 * Implement this interface to execute custom logic when a provider is initialized.
 * The `onModuleInit()` method is called after the provider instance is created
 * and all its dependencies are injected.
 *
 * This is useful for:
 * - Establishing database connections
 * - Loading configuration
 * - Initializing caches
 * - Setting up event listeners
 * - Any other initialization logic
 *
 * The method can be synchronous or asynchronous. If it returns a Promise,
 * the container will wait for it to resolve before considering the provider
 * fully initialized.
 *
 * @example
 * ```typescript
 * @Injectable()
 * class DatabaseService implements OnModuleInit {
 *   private connection: Connection;
 *
 *   async onModuleInit() {
 *     // Called after DatabaseService is instantiated
 *     this.connection = await createConnection({
 *       host: 'localhost',
 *       database: 'myapp'
 *     });
 *     console.log('Database connected');
 *   }
 * }
 *
 * @Injectable()
 * class CacheService implements OnModuleInit {
 *   onModuleInit() {
 *     // Synchronous initialization
 *     this.warmUpCache();
 *   }
 * }
 * ```
 */
export interface OnModuleInit {
	/**
	 * Called after the provider is instantiated and dependencies are injected.
	 *
	 * @returns void or a Promise that resolves when initialization is complete
	 */
	onModuleInit(): void | Promise<void>;
}
