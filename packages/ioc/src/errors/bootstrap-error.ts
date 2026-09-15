import type { GraphError, InjectionToken } from "../interfaces";

function tokenToStr(token: InjectionToken): string {
	return typeof token === "function" ? token.name : String(token);
}

function formatError(error: GraphError): string {
	switch (error.type) {
		case "CD_PROVIDERS": {
			const path = error.path
				.map(([from, to]) => `${tokenToStr(from)} → ${tokenToStr(to)}`)
				.join(", ");
			return `  Circular dependency: ${path}\n  Hint: Use @Inject(forwardRef(() => X)) to resolve this cycle explicitly.`;
		}
		case "CD_IMPORTS":
			return `  Circular import: ${error.path.join(" → ")}`;
		case "UNREACHED_DEP_CONSTRUCTOR":
			return `  Missing provider "${error.dependency}" in ${error.token} (constructor param #${error.position})`;
		case "UNREACHED_DEP_PROPERTY":
			return `  Missing provider "${error.dependency}" in ${error.token} (property "${error.key}")`;
		case "UNREACHED_DEP_FACTORY":
			return `  Missing provider "${error.dependency}" in ${error.token} (inject[${error.key}])`;
		case "PROVIDER_TOKEN_CONFLICT":
			return `  Provider token "${error.token}" in ${error.module} is already registered by ${error.existingModule}`;
	}
}

export function formatGraphErrors(errors: GraphError[]): string {
	return errors.map(formatError).join("\n");
}

export class BootstrapError extends Error {
	constructor(public readonly errors: GraphError[]) {
		super(`Application bootstrap failed:\n${formatGraphErrors(errors)}`);
		this.name = "BootstrapError";
		Object.setPrototypeOf(this, BootstrapError.prototype);
	}
}
