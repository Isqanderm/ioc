import type { ProviderToken } from "./injection-token.interface";

export type GraphError =
	| {
			type: "CD_IMPORTS";
			path: string[];
	  }
	| {
			type: "CD_PROVIDERS";
			path: [ProviderToken, ProviderToken][];
	  }
	| {
			type: "UNREACHED_DEP_CONSTRUCTOR";
			token: string;
			dependency: string;
			position: number;
	  }
	| {
			type: "UNREACHED_DEP_PROPERTY";
			token: string;
			dependency: string;
			key: string;
	  }
	| {
			type: "UNREACHED_DEP_FACTORY";
			token: string;
			dependency: string;
			key: number;
	  }
	| {
			type: "PROVIDER_TOKEN_CONFLICT";
			token: string;
			module: string;
			existingModule: string;
	  }
	| {
			type: "CHILD_DECLARED_TWICE";
			child: string;
			modules: [string, string];
	  };
