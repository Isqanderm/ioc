import "reflect-metadata";
import {
	INJECT_LAZY_WATERMARK,
	INJECT_WATERMARK,
	PROPERTY_DEPS_METADATA,
	SELF_DECLARED_DEPS_METADATA,
	type Type,
} from "../interfaces";

export function LazyInject(
	token: Type<unknown> | symbol | string,
): PropertyDecorator & ParameterDecorator {
	return (
		target: object,
		propertyKey?: string | symbol,
		parameterIndex?: number,
	) => {
		Reflect.defineMetadata(INJECT_WATERMARK, true, target);
		Reflect.defineMetadata(INJECT_LAZY_WATERMARK, true, target);

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

			properties = [...properties, { key: propertyKey, type, lazy: true }];
			Reflect.defineMetadata(
				PROPERTY_DEPS_METADATA,
				properties,
				target.constructor,
			);
			return;
		}

		let dependencies =
			Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, target) || [];

		dependencies = [
			...dependencies,
			{ index: parameterIndex, lazy: true, param: type },
		];
		Reflect.defineMetadata(SELF_DECLARED_DEPS_METADATA, dependencies, target);
	};
}
