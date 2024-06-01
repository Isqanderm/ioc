import "reflect-metadata";
import { INJECTABLE_OPTIONS, INJECTABLE_WATERMARK, Scope } from "../interfaces";
import type { InjectableOptions } from "../interfaces";

export function Injectable(
	options: InjectableOptions = { scope: Scope.Singleton },
): ClassDecorator {
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	return (target: Function) => {
		Reflect.defineMetadata(INJECTABLE_OPTIONS, options, target);
		Reflect.defineMetadata(INJECTABLE_WATERMARK, true, target);
	};
}
