import "reflect-metadata";
import { MODULE_GLOBAL_WATERMARK } from "../interfaces";

export function Global(): ClassDecorator {
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	return (target: Function) => {
		Reflect.defineMetadata(MODULE_GLOBAL_WATERMARK, true, target);
	};
}
