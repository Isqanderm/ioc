import * as ts from "typescript";
import { describe, expect, it } from "vitest";
import {
	getClassName,
	getDecorators,
	hasNexusDecorator,
	isInjectableClass,
	isModuleClass,
} from "../../src/utils/typescript-utils";

function getClass(code: string): ts.ClassDeclaration {
	const sourceFile = ts.createSourceFile(
		"test.ts",
		code,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);

	const classDeclaration = sourceFile.statements.find(ts.isClassDeclaration);
	if (!classDeclaration) {
		throw new Error("Expected class declaration");
	}

	return classDeclaration;
}

function createAnalyzer(decoratedKinds: Set<string>) {
	return {
		hasDecorator: (_node: ts.Node, kind: string) => decoratedKinds.has(kind),
	} as ReturnType<typeof import("@nexus-ioc/type-checker").createNexusAnalyzer>;
}

describe("typescript-utils", () => {
	it("checks Nexus decorators through the semantic analyzer", () => {
		const node = getClass("class UserService {}");
		const analyzer = createAnalyzer(new Set(["Injectable", "NsModule"]));

		expect(hasNexusDecorator(analyzer, node, "Injectable")).toBe(true);
		expect(isInjectableClass(analyzer, node)).toBe(true);
		expect(isModuleClass(analyzer, node)).toBe(true);
	});

	it("supports Global as a module decorator", () => {
		const node = getClass("class GlobalModule {}");
		const analyzer = createAnalyzer(new Set(["Global"]));

		expect(isModuleClass(analyzer, node)).toBe(true);
	});

	it("rejects non-class nodes", () => {
		const sourceFile = ts.createSourceFile(
			"test.ts",
			"const value = 1;",
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const analyzer = createAnalyzer(new Set(["Injectable", "NsModule"]));

		expect(isInjectableClass(analyzer, sourceFile.statements[0])).toBe(false);
		expect(isModuleClass(analyzer, sourceFile.statements[0])).toBe(false);
	});

	it("reads class names and decorators from TypeScript nodes", () => {
		const node = getClass("@decorator() class UserService {}");

		expect(getClassName(node)).toBe("UserService");
		expect(getDecorators(node)).toHaveLength(1);
	});
});
