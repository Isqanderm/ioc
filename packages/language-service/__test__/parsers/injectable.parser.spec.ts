import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import * as ts from "typescript";
import { InjectableParser } from "../../src/parsers/injectable.parser";

describe("InjectableParser", () => {
	let tempDir: string;
	let tempFilePath: string;

	beforeEach(() => {
		// Create a temporary directory and file for testing
		tempDir = mkdtempSync("injectable-parser-test-");
		tempFilePath = join(tempDir, "test.ts");
	});

	afterEach(() => {
		// Clean up temporary file and directory
		unlinkSync(tempFilePath);
		rmdirSync(tempDir);
	});

	it("should find injectable classes in a source file", () => {
		// Create a sample source code with an injectable class
		const sourceCode = `
import { Injectable } from '@nexus-ioc/core';

@Injectable()
export class TestService {
  constructor() {}
}

class NonInjectableClass {
  constructor() {}
}
`;

		// Write the source code to a temporary file
		writeFileSync(tempFilePath, sourceCode);

		// Create a program with the source file
		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.CommonJS,
		});

		// Get the source file from the program
		const sourceFile = program.getSourceFile(tempFilePath);

		// Ensure source file exists
		expect(sourceFile).toBeDefined();

		// Execute the InjectableParser
		const injectableClasses = InjectableParser.execute(sourceFile!);

		// Assertions
		expect(injectableClasses).toHaveLength(1);
		expect(injectableClasses[0].name?.getText()).toBe("TestService");
	});

	it("should return an empty array when no injectable classes are found", () => {
		// Create a source code without any injectable classes
		const sourceCode = `
class NonInjectableClass {
  constructor() {}
}

function someFunction() {}
`;

		// Write the source code to a temporary file
		writeFileSync(tempFilePath, sourceCode);

		// Create a program with the source file
		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.CommonJS,
		});

		// Get the source file from the program
		const sourceFile = program.getSourceFile(tempFilePath);

		// Ensure source file exists
		expect(sourceFile).toBeDefined();

		// Execute the InjectableParser
		const injectableClasses = InjectableParser.execute(sourceFile!);

		// Assertions
		expect(injectableClasses).toHaveLength(0);
	});
});
