import type * as ts from "typescript";

export type NexusSourceSpan = {
	fileName: string;
	start: number;
	end: number;
	length: number;
};

export type NexusToken =
	| {
			kind: "string";
			value: string;
			source: NexusSourceSpan;
		}
	| {
			kind: "symbol";
			declaration?: ts.Symbol;
			source: NexusSourceSpan;
		}
	| {
			kind: "reference";
			symbol: ts.Symbol;
			source: NexusSourceSpan;
		}
	| {
			kind: "expression";
			source: NexusSourceSpan;
		};

export type NexusDependency = {
	location: "constructor" | "property";
	name: string;
	token?: NexusToken;
	optional: boolean;
	source: NexusSourceSpan;
};

export type NexusDecoratorKind =
	| "Inject"
	| "Injectable"
	| "NsModule"
	| "Optional"
	| "Global";

export type NexusDecorator = {
	kind: NexusDecoratorKind;
	source: NexusSourceSpan;
};

export type NexusClass = {
	name?: string;
	source: NexusSourceSpan;
	decorators: readonly NexusDecorator[];
	dependencies: readonly NexusDependency[];
	isInjectable: boolean;
	isModule: boolean;
	isGlobal: boolean;
};
