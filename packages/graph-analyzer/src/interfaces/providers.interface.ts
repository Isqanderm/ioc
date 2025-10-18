import type { Dependency } from "../parser/dependency-extractor";

export interface ProvidersInterface {
	parse(): this;
	token: string | null;
	value?: string | null;
	scope?: string | null;
	inject?: string[];
	type: string;
	dependencies?: Dependency[];
}
