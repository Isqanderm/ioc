import "reflect-metadata";
import type { ModuleMetadata } from "../interfaces";
import {
	MODULE_METADATA,
	MODULE_WATERMARK,
	validateModuleKeys,
} from "../interfaces";

export function Module(metadata: ModuleMetadata): ClassDecorator {
	const propsKeys = Object.keys(metadata);
	validateModuleKeys(propsKeys);

	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	return (target: Function) => {
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
