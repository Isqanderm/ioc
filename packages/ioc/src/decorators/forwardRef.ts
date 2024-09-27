import type { Type } from "../interfaces";

export function forwardRef(fn: () => Type | string | symbol) {
	return fn;
}
