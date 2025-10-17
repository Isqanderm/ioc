import "reflect-metadata";
import {
	INJECT_WATERMARK,
	PROPERTY_DEPS_METADATA,
	SELF_DECLARED_DEPS_METADATA,
	type Type,
} from "../interfaces";

/**
 * Explicitly specifies the injection token for a constructor parameter or property.
 *
 * This decorator is used when:
 * - You need to inject a provider by a string or symbol token
 * - TypeScript's reflection cannot determine the type (e.g., interfaces, circular dependencies)
 * - You want to inject a different implementation than the declared type
 *
 * @param token - The injection token (class, string, or symbol)
 * @returns A decorator that can be applied to constructor parameters or properties
 * @throws {Error} If the token is undefined (often due to circular dependencies)
 *
 * @example
 * ```typescript
 * // Constructor parameter injection
 * @Injectable()
 * class UserService {
 *   constructor(
 *     @Inject('DATABASE_CONFIG') private config: DatabaseConfig,
 *     @Inject(Logger) private logger: Logger
 *   ) {}
 * }
 *
 * // Property injection
 * @Injectable()
 * class ProductService {
 *   @Inject('CACHE_MANAGER')
 *   private cache: CacheManager;
 * }
 *
 * // Resolving circular dependencies
 * @Injectable()
 * class ServiceA {
 *   constructor(
 *     @Inject(forwardRef(() => ServiceB)) private serviceB: ServiceB
 *   ) {}
 * }
 * ```
 */
export function Inject(
	token: Type | symbol | string,
): PropertyDecorator & ParameterDecorator {
	return (
		target: object,
		propertyKey?: string | symbol,
		parameterIndex?: number,
	) => {
		Reflect.defineMetadata(INJECT_WATERMARK, true, target);

		const type =
			token ||
			Reflect.getMetadata("design:type", target, propertyKey as string);

		if (!type) {
			throw new Error(`
				Token is undefined at index: ${parameterIndex}. This often occurs due to circular dependencies.
Ensure there are no circular dependencies in your files or barrel files.`);
		}

		if (parameterIndex === undefined) {
			let properties =
				Reflect.getMetadata(PROPERTY_DEPS_METADATA, target) || [];

			properties = [...properties, { key: propertyKey, type }];
			Reflect.defineMetadata(
				PROPERTY_DEPS_METADATA,
				properties,
				target.constructor,
			);
			return;
		}

		let dependencies =
			Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, target) || [];

		dependencies = [...dependencies, { index: parameterIndex, param: type }];
		Reflect.defineMetadata(SELF_DECLARED_DEPS_METADATA, dependencies, target);
	};
}
