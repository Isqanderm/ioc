import type { InjectionToken } from "./injection-token.interface";

export type GraphError =
	| {
			type: "CD_IMPORTS";
			path: string[];
	  }
	| {
			type: "CD_PROVIDERS";
			path: [InjectionToken, InjectionToken][];
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
	  };

