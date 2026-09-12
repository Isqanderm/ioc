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
	parameterName: string;
	parameterType?: ts.TypeNode;
	token?: NexusToken;
	optional: boolean;
	source: NexusSourceSpan;
	declaration: ts.ParameterDeclaration | ts.PropertyDeclaration;
};

export type NexusDecoratorKind =
	| "Inject"
	| "Injectable"
	| "NsModule"
	| "Optional"
	| "Global";

export type NexusDecorator = {
	kind: NexusDecoratorKind;
	declaration: ts.Decorator;
	expression: ts.Expression;
	source: NexusSourceSpan;
};

export type NexusClassModel = {
	node: ts.ClassDeclaration;
	name?: string;
	decorators: NexusDecorator[];
	isInjectable: boolean;
	isModule: boolean;
	isGlobal: boolean;
	dependencies: NexusDependency[];
};