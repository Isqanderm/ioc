import type * as ts from "typescript";

export type NexusSourceSpan = {
	start: number;
	end: number;
	length: number;
};

/**
 * Semantic representation of a Nexus injection token.
 *
 * A TypeScript symbol is the identity of a referenced declaration; it is not
 * itself a JavaScript `symbol` runtime token. Keeping that distinction explicit
 * prevents the semantic model from conflating declaration identity with token
 * value.
 */
export type NexusToken =
	| {
			kind: "reference";
			symbol: ts.Symbol;
			expression: ts.Expression;
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