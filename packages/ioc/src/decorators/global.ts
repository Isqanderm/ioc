import "reflect-metadata";
import { MODULE_GLOBAL_WATERMARK } from "../interfaces";

export function Global(): ClassDecorator {
	// biome-ignore lint/complexity/noBannedTypes: Function type needed for decorator
	return (target: Function) => {
		Reflect.defineMetadata(MODULE_GLOBAL_WATERMARK, true, target);
	};
}
