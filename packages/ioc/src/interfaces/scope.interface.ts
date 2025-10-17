/**
 * Defines the lifecycle scope of a provider.
 *
 * The scope determines how instances are created and cached:
 *
 * - **Singleton**: One instance is created and shared across the entire application.
 *   The instance is cached globally and reused for all requests.
 *
 * - **Request**: A new instance is created for each `container.get()` call, but
 *   the same instance is reused within that call's dependency tree. This is useful
 *   for request-scoped data in web applications.
 *
 * - **Transient**: A new instance is created every time the provider is injected,
 *   even within the same dependency tree. No caching is performed.
 *
 * @example
 * ```typescript
 * // Singleton - shared across the application
 * @Injectable({ scope: Scope.Singleton })
 * class DatabaseConnection {
 *   // Only one instance exists
 * }
 *
 * // Request - new instance per request
 * @Injectable({ scope: Scope.Request })
 * class RequestContext {
 *   requestId = Math.random();
 *   // Different requestId for each container.get() call
 * }
 *
 * // Transient - new instance every time
 * @Injectable({ scope: Scope.Transient })
 * class Logger {
 *   timestamp = Date.now();
 *   // Different timestamp for each injection
 * }
 * ```
 */
export enum Scope {
	/**
	 * Singleton scope - one instance shared across the entire application.
	 * This is the default scope.
	 */
	Singleton = 0,

	/**
	 * Request scope - new instance for each container.get() call,
	 * but shared within that call's dependency tree.
	 */
	Request = 1,

	/**
	 * Transient scope - new instance every time, no caching.
	 */
	Transient = 2,
}
