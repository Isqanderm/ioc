import "reflect-metadata";
import {
	OPTIONAL_WATERMARK,
	PROPERTY_OPTIONAL_DEPS_METADATA,
	SELF_DECLARED_OPTIONAL_DEPS_METADATA,
} from "../interfaces";

/**
 * Marks a dependency as optional.
 *
 * When a dependency is marked as optional, the container will not throw an error
 * if the provider is not found. Instead, it will inject `undefined`.
 *
 * This is useful for:
 * - Optional features that may not be available in all configurations
 * - Graceful degradation when certain services are not registered
 * - Testing scenarios where you want to omit certain dependencies
 *
 * @returns A decorator that can be applied to constructor parameters or properties
 *
 * @example
 * ```typescript
 * // Optional constructor parameter
 * @Injectable()
 * class UserService {
 *   constructor(
 *     private db: Database,
 *     @Optional() private cache?: CacheService
 *   ) {
 *     // cache will be undefined if CacheService is not registered
 *   }
 * }
 *
 * // Optional property injection
 * @Injectable()
 * class ProductService {
 *   @Optional()
 *   @Inject('ANALYTICS')
 *   private analytics?: AnalyticsService;
 *
 *   trackEvent(event: string) {
 *     // Only track if analytics service is available
 *     this.analytics?.track(event);
 *   }
 * }
 * ```
 */
export function Optional(): PropertyDecorator & ParameterDecorator {
	return (
		target: object,
		propertyKey?: string | symbol,
		parameterIndex?: number,
	) => {
		Reflect.defineMetadata(OPTIONAL_WATERMARK, true, target);

		if (parameterIndex === undefined) {
			let properties =
				Reflect.getMetadata(PROPERTY_OPTIONAL_DEPS_METADATA, target) || [];

			properties = [...properties, { key: propertyKey }];
			Reflect.defineMetadata(
				PROPERTY_OPTIONAL_DEPS_METADATA,
				properties,
				target.constructor,
			);
			return;
		}

		let properties =
			Reflect.getMetadata(SELF_DECLARED_OPTIONAL_DEPS_METADATA, target) || [];

		properties = [...properties, { index: parameterIndex }];
		Reflect.defineMetadata(
			SELF_DECLARED_OPTIONAL_DEPS_METADATA,
			properties,
			target,
		);
	};
}
