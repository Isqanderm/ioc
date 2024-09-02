import "reflect-metadata";
import {
	OPTIONAL_WATERMARK,
	PROPERTY_OPTIONAL_DEPS_METADATA,
	SELF_DECLARED_OPTIONAL_DEPS_METADATA,
} from "../interfaces";

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
