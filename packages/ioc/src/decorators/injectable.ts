import "reflect-metadata";
import { INJECTABLE_OPTIONS, INJECTABLE_WATERMARK, Scope } from "../interfaces";
import type { InjectableOptions } from "../interfaces";

/**
 * Marks a class as injectable, making it available for dependency injection.
 *
 * This decorator must be applied to any class that you want to use as a provider
 * in the IoC container. It configures the scope and other options for the provider.
 *
 * @param options - Configuration options for the injectable
 * @param options.scope - The lifecycle scope of the provider:
 *   - `Scope.Singleton` (default): One instance shared across the entire application
 *   - `Scope.Request`: New instance for each container.get() call
 *   - `Scope.Transient`: New instance every time, even within the same dependency tree
 * @returns A class decorator
 *
 * @example
 * ```typescript
 * // Singleton scope (default)
 * @Injectable()
 * class UserService {
 *   constructor(private db: Database) {}
 * }
 *
 * // Request scope
 * @Injectable({ scope: Scope.Request })
 * class RequestContext {
 *   requestId = Math.random();
 * }
 *
 * // Transient scope
 * @Injectable({ scope: Scope.Transient })
 * class Logger {
 *   timestamp = Date.now();
 * }
 * ```
 */
export function Injectable(
	options: InjectableOptions = { scope: Scope.Singleton },
): ClassDecorator {
	return (target) => {
		Reflect.defineMetadata(INJECTABLE_OPTIONS, options, target);
		Reflect.defineMetadata(INJECTABLE_WATERMARK, true, target);
	};
}
