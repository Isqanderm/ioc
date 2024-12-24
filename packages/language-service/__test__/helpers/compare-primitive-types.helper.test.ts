import * as ts from "typescript/lib/tsserverlibrary";
import {
	compareBigIntTypes,
	compareBooleanTypes,
	compareNumberTypes,
	compareStringTypes,
	compareSymbolTypes,
	compareTypes,
} from "../../src/helpers/compare-types.helper";

describe("Compare Primitive Types", () => {
	let program: ts.Program;
	let typeChecker: ts.TypeChecker;
	let sourceFile: ts.SourceFile;

	beforeAll(() => {
		const sourceText = `
      // String types
      const stringType: string = "test";
      const stringLiteral = "hello";
      const emptyString = "";
      const templateString = \`template\`;
      const stringObject = new String("test");
      
      // Number types
      const numberType: number = 42;
      const integerLiteral = 123;
      const floatLiteral = 3.14;
      const negativeLiteral = -1;
      const zeroNumber = 0;
      const infinityNumber = Infinity;
      const nanNumber = NaN;
      const numberObject = new Number(42);
      
      // Boolean types
      const booleanType: boolean = true;
      const trueLiteral = true;
      const falseLiteral = false;
      const booleanObject = new Boolean(true);
      
      // BigInt types
      const bigintType: bigint = 42n;
      const positiveBigInt = 123n;
      const negativeBigInt = -1n;
      const zeroBigInt = 0n;
      
      // Symbol types
      const symbolType: symbol = Symbol();
      const namedSymbol = Symbol("test");
      const anotherSymbol = Symbol("another");
      const wellKnownSymbol = Symbol.iterator;

      // Literal types
      const literalString: "specific" = "specific";
      const literalNumber: 42 = 42;
      const literalBoolean: true = true;

      // Null and Undefined
      const nullValue: null = null;
      const undefinedValue: undefined = undefined;
    `;

		// Create compiler host
		const compilerHost = ts.createCompilerHost({});
		const originalGetSourceFile = compilerHost.getSourceFile;
		compilerHost.getSourceFile = (
			fileName: string,
			languageVersion: ts.ScriptTarget,
		) => {
			if (fileName === "test.ts") {
				return ts.createSourceFile(fileName, sourceText, languageVersion);
			}
			return originalGetSourceFile(fileName, languageVersion);
		};

		// Create program
		program = ts.createProgram({
			rootNames: ["test.ts"],
			options: {},
			host: compilerHost,
		});

		typeChecker = program.getTypeChecker();
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		sourceFile = program.getSourceFile("test.ts")!;
	});

	function findNode(text: string): ts.Node {
		let result: ts.Node | undefined;

		function visit(node: ts.Node) {
			if (node.getText() === text) {
				result = node;
				return;
			}
			ts.forEachChild(node, visit);
		}

		ts.forEachChild(sourceFile, visit);
		if (!result) {
			throw new Error(`Node with text "${text}" not found`);
		}
		return result;
	}

	describe("String type comparisons", () => {
		it("should return true when comparing string type with string literal", () => {
			const stringTypeNode = findNode("string");
			const stringLiteralNode = findNode('"hello"');

			expect(
				compareStringTypes(stringTypeNode, stringLiteralNode, typeChecker),
			).toBe(true);
			expect(compareTypes(stringTypeNode, stringLiteralNode, typeChecker)).toBe(
				true,
			);
		});

		it("should handle empty strings", () => {
			const stringTypeNode = findNode("string");
			const emptyStringNode = findNode('""');

			expect(
				compareStringTypes(stringTypeNode, emptyStringNode, typeChecker),
			).toBe(true);
		});

		it("should handle template strings", () => {
			const stringTypeNode = findNode("string");
			const templateStringNode = findNode("`template`");

			expect(
				compareStringTypes(stringTypeNode, templateStringNode, typeChecker),
			).toBe(true);
		});

		it("should handle String objects", () => {
			const stringTypeNode = findNode("string");
			const stringObjectNode = findNode('new String("test")');

			expect(
				compareStringTypes(stringTypeNode, stringObjectNode, typeChecker),
			).toBe(false);
		});
	});

	describe("Number type comparisons", () => {
		it("should handle various number literals", () => {
			const numberTypeNode = findNode("number");
			const cases = [
				findNode("123"),
				findNode("3.14"),
				findNode("-1"),
				findNode("0"),
				findNode("Infinity"),
				findNode("NaN"),
			];

			for (const node of cases) {
				expect(compareNumberTypes(numberTypeNode, node, typeChecker)).toBe(
					true,
				);
			}
		});

		it("should handle Number objects", () => {
			const numberTypeNode = findNode("number");
			const numberObjectNode = findNode("new Number(42)");

			expect(
				compareNumberTypes(numberTypeNode, numberObjectNode, typeChecker),
			).toBe(false);
		});
	});

	describe("Boolean type comparisons", () => {
		it("should handle both boolean literals", () => {
			const booleanTypeNode = findNode("boolean");
			const trueLiteralNode = findNode("true");
			const falseLiteralNode = findNode("false");

			expect(
				compareBooleanTypes(booleanTypeNode, trueLiteralNode, typeChecker),
			).toBe(true);
			expect(
				compareBooleanTypes(booleanTypeNode, falseLiteralNode, typeChecker),
			).toBe(true);
		});

		it("should handle Boolean objects", () => {
			const booleanTypeNode = findNode("boolean");
			const booleanObjectNode = findNode("new Boolean(true)");

			expect(
				compareBooleanTypes(booleanTypeNode, booleanObjectNode, typeChecker),
			).toBe(false);
		});
	});

	describe("BigInt type comparisons", () => {
		it("should handle various bigint literals", () => {
			const bigintTypeNode = findNode("bigint");
			const cases = [findNode("123n"), findNode("-1n"), findNode("0n")];

			for (const node of cases) {
				expect(compareBigIntTypes(bigintTypeNode, node, typeChecker)).toBe(
					true,
				);
			}
		});
	});

	describe("Symbol type comparisons", () => {
		it("should handle various symbol expressions", () => {
			const symbolTypeNode = findNode("symbol");
			const cases = [
				findNode("Symbol()"),
				findNode('Symbol("test")'),
				findNode("Symbol.iterator"),
			];

			for (const node of cases) {
				expect(compareSymbolTypes(symbolTypeNode, node, typeChecker)).toBe(
					true,
				);
			}
		});
	});

	describe("Literal type comparisons", () => {
		it("should handle literal types", () => {
			const literalStringNode = findNode('"specific"');
			const literalNumberNode = findNode("42");
			const literalBooleanNode = findNode("true");

			expect(
				compareTypes(literalStringNode, literalStringNode, typeChecker),
			).toBe(true);
			expect(
				compareTypes(literalNumberNode, literalNumberNode, typeChecker),
			).toBe(true);
			expect(
				compareTypes(literalBooleanNode, literalBooleanNode, typeChecker),
			).toBe(true);
		});
	});

	describe("Edge cases", () => {
		it("should handle undefined nodes", () => {
			const stringTypeNode = findNode("string");

			expect(compareTypes(stringTypeNode, undefined, typeChecker)).toBe(false);
			expect(compareTypes(undefined, stringTypeNode, typeChecker)).toBe(false);
		});

		it("should handle null types", () => {
			const stringTypeNode = findNode("string");
			const nullNode = findNode("null");

			expect(compareTypes(stringTypeNode, nullNode, typeChecker)).toBe(false);
		});
	});
});
