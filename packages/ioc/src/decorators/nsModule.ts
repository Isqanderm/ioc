import "reflect-metadata";
import type { ModuleMetadata } from "../interfaces";
import {
	MODULE_METADATA,
	MODULE_WATERMARK,
	validateModuleKeys,
} from "../interfaces";

/**
 * Defines a module in the application.
 *
 * A module is a class annotated with @NsModule() decorator that organizes
 * the application structure. Modules can:
 * - Declare providers that will be instantiated by the container
 * - Import other modules to use their exported providers
 * - Export providers to make them available to other modules
 *
 * @param metadata - Module configuration
 * @param metadata.imports - Modules whose exported providers should be available in this module
 * @param metadata.providers - Providers that belong to this module
 * @param metadata.exports - Providers or modules to export (make available to importing modules)
 * @returns A class decorator
 * @throws {Error} If invalid metadata keys are provided
 *
 * @example
 * ```typescript
 * // Basic module
 * @NsModule({
 *   providers: [UserService, UserRepository],
 *   exports: [UserService]
 * })
 * class UserModule {}
 *
 * // Module with imports
 * @NsModule({
 *   imports: [DatabaseModule, LoggerModule],
 *   providers: [ProductService],
 *   exports: [ProductService]
 * })
 * class ProductModule {}
 *
 * // Root module
 * @NsModule({
 *   imports: [UserModule, ProductModule],
 *   providers: [AppService]
 * })
 * class AppModule {}
 * ```
 */
export function NsModule(metadata: ModuleMetadata): ClassDecorator {
	const propsKeys = Object.keys(metadata);
	validateModuleKeys(propsKeys);

	return (target) => {
		Reflect.defineMetadata(MODULE_WATERMARK, true, target);
		Reflect.defineMetadata(
			MODULE_METADATA.IMPORTS,
			metadata.imports || [],
			target,
		);
		Reflect.defineMetadata(
			MODULE_METADATA.EXPORTS,
			metadata.exports || [],
			target,
		);
		Reflect.defineMetadata(
			MODULE_METADATA.PROVIDERS,
			metadata.providers || [],
			target,
		);
	};
}
