import type { GraphError } from "../interfaces";
import { formatGraphErrors } from "./bootstrap-error";

/** The loader rejected or returned something that is not a @Module() class. */
export class LazyModuleLoadError extends Error {
	constructor(
		public readonly lazyModuleName: string,
		reason: string,
	) {
		super(`Failed to load lazy module "${lazyModuleName}": ${reason}`);
		this.name = "LazyModuleLoadError";
		Object.setPrototypeOf(this, LazyModuleLoadError.prototype);
	}
}

/** The loaded module compiled with graph errors; the segment was rolled back. */
export class LazyModuleGraphError extends Error {
	constructor(
		public readonly lazyModuleName: string,
		public readonly errors: GraphError[],
	) {
		super(
			`Lazy module "${lazyModuleName}" failed to compile:\n${formatGraphErrors(errors)}`,
		);
		this.name = "LazyModuleGraphError";
		Object.setPrototypeOf(this, LazyModuleGraphError.prototype);
	}
}
