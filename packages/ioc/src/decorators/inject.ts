import "reflect-metadata";
import {
	INJECT_WATERMARK,
	PROPERTY_DEPS_METADATA,
	SELF_DECLARED_DEPS_METADATA,
	type Type,
} from "../interfaces";

export function Inject(token: Type | symbol | string): PropertyDecorator & ParameterDecorator {
	return (target: object, propertyKey?: string | symbol, parameterIndex?: number) => {
		Reflect.defineMetadata(INJECT_WATERMARK, true, target);

		const type = token || Reflect.getMetadata("design:type", target, propertyKey as string);

		if (!type) {
			throw new Error(`
				Token is undefined at index: ${parameterIndex}. This often occurs due to circular dependencies.
Ensure there are no circular dependencies in your files or barrel files.`);
		}

		if (parameterIndex === undefined) {
			let properties = Reflect.getMetadata(PROPERTY_DEPS_METADATA, target) || [];

			properties = [...properties, { key: propertyKey, type }];
			Reflect.defineMetadata(PROPERTY_DEPS_METADATA, properties, target.constructor);
			return;
		}

		let dependencies = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, target) || [];

		dependencies = [...dependencies, { index: parameterIndex, param: type }];
		Reflect.defineMetadata(SELF_DECLARED_DEPS_METADATA, dependencies, target);
	};
}
