import type * as ts from "typescript";

export type NexusSourceSpan = {
	start: number;
	end: number;
	length: number;
};

export type NexusToken =
	| {
			kind: "symbol";
			symbol: ts.Symbol;
			expression: ts.Identifier;
		}
	| {
			kind: "string";
			value: string;
			expression: ts.StringLiteral;
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
