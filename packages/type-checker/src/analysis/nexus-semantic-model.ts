import type * as ts from "typescript";

export type NexusSourceSpan = {
	start: number;
	end: number;
	length: number;
};

export type NexusToken =
	| {
			kind: "string";
			value: string;
			expression: ts.StringLiteral;
		}
	| {
			kind: "symbol";
			declaration?: ts.Symbol;
			expression: ts.Expression;
		}
	| {
			kind: "reference";
			symbol: ts.Symbol;
			expression: ts.Expression;
		}
	| {
			kind: "expression";
			expression: ts.Expression;
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
