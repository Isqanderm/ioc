import { InjectableParser } from "@nexus-ioc/type-checker";
import * as ts from "typescript";

describe("InjectableParser", () => {
	it("should find injectable classes in a source file", () => {
		// Create a sample source code with an injectable class
		const sourceText = `
import { Injectable } from '@nexus-ioc/core';

@Injectable()
export class TestService {
  constructor() {}
}

class NonInjectableClass {
  constructor() {}
}
`;

		// Create source file directly (tsquery works with source files, not programs)
		const sourceFile = ts.createSourceFile(
			"test.ts",
			sourceText,
			ts.ScriptTarget.Latest,
			true, // setParentNodes
		);

		// Execute the InjectableParser
		const injectableClasses = InjectableParser.execute(sourceFile);

		// Assertions
		expect(injectableClasses).toHaveLength(1);
		expect(injectableClasses[0].name?.getText()).toBe("TestService");
	});

	it("should return an empty array when no injectable classes are found", () => {
		// Create a source code without any injectable classes
		const sourceText = `
class NonInjectableClass {
  constructor() {}
}

function someFunction() {}
`;

		// Create source file directly (tsquery works with source files, not programs)
		const sourceFile = ts.createSourceFile(
			"test.ts",
			sourceText,
			ts.ScriptTarget.Latest,
			true, // setParentNodes
		);

		// Execute the InjectableParser
		const injectableClasses = InjectableParser.execute(sourceFile);

		// Assertions
		expect(injectableClasses).toHaveLength(0);
	});
});
