import * as ts from "typescript";
import { ProvidersParser } from "../providers-parser";

describe("ProvidersParser", () => {
	/**
	 * Helper function to create a source file from TypeScript code
	 */
	function createSourceFile(code: string): ts.SourceFile {
		return ts.createSourceFile(
			"test.ts",
			code,
			ts.ScriptTarget.Latest,
			true,
		);
	}

	describe("Basic Functionality", () => {
		it("should parse class provider", () => {
			const providers = ["UserService"];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe("Class");
			expect(result[0].token).toBe("UserService");
		});

		it("should parse multiple class providers", () => {
			const providers = ["UserService", "DatabaseService", "ConfigService"];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result).toHaveLength(3);
			expect(result[0].token).toBe("UserService");
			expect(result[1].token).toBe("DatabaseService");
			expect(result[2].token).toBe("ConfigService");
		});

		it("should parse useValue provider", () => {
			const providers = ['{ provide: "CONFIG", useValue: "production" }'];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe("UseValue");
			expect(result[0].token).toBe("CONFIG");
		});

		it("should parse useFactory provider", () => {
			const providers = ['{ provide: "LOGGER", useFactory: () => { return new Logger(); } }'];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe("UseFactory");
			expect(result[0].token).toBe("LOGGER");
		});

		it("should parse useClass provider", () => {
			const code = `
				class UserService {}
				class MockUserService {}
			`;
			const sourceFile = createSourceFile(code);
			const providers = ['{ provide: UserService, useClass: MockUserService }'];
			const parser = new ProvidersParser(providers, sourceFile, "test.ts");
			const result = parser.parse();

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe("UseClass");
		});
	});

	describe("Mixed Provider Types", () => {
		it("should parse mixed provider types", () => {
			const providers = [
				"UserService",
				'{ provide: "CONFIG", useValue: "production" }',
				'{ provide: "LOGGER", useFactory: () => { return new Logger(); } }',
			];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result).toHaveLength(3);
			expect(result[0].type).toBe("Class");
			expect(result[1].type).toBe("UseValue");
			expect(result[2].type).toBe("UseFactory");
		});

		it("should handle all provider types in one array", () => {
			const code = `
				class UserService {}
				class MockUserService {}
			`;
			const sourceFile = createSourceFile(code);
			const providers = [
				"UserService",
				'{ provide: "CONFIG", useValue: "production" }',
				'{ provide: "LOGGER", useFactory: () => { return new Logger(); } }',
				'{ provide: UserService, useClass: MockUserService }',
			];
			const parser = new ProvidersParser(providers, sourceFile, "test.ts");
			const result = parser.parse();

			expect(result).toHaveLength(4);
			expect(result[0].type).toBe("Class");
			expect(result[1].type).toBe("UseValue");
			expect(result[2].type).toBe("UseFactory");
			expect(result[3].type).toBe("UseClass");
		});
	});

	describe("Whitespace Handling", () => {
		it("should handle providers with extra whitespace", () => {
			const providers = [
				"  UserService  ",
				'  { provide: "CONFIG", useValue: "production" }  ',
			];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result).toHaveLength(2);
			expect(result[0].token).toBe("UserService");
			expect(result[1].token).toBe("CONFIG");
		});

		it("should remove all whitespace from provider strings", () => {
			const providers = [
				"User Service", // Will be cleaned to "UserService"
				'{ provide : "CONFIG" , useValue : "production" }',
			];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result).toHaveLength(2);
			// After whitespace removal, "User Service" becomes "UserService"
			expect(result[0].token).toBe("UserService");
		});

		it("should handle newlines and tabs", () => {
			const providers = [
				"UserService\n\t",
				'{\n\tprovide: "CONFIG",\n\tuseValue: "production"\n}',
			];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result).toHaveLength(2);
			expect(result[0].token).toBe("UserService");
			expect(result[1].token).toBe("CONFIG");
		});
	});

	describe("Provider Detection", () => {
		it("should detect useValue provider by keyword", () => {
			const providers = ['{ provide: "TOKEN", useValue: "value" }'];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result[0].type).toBe("UseValue");
		});

		it("should detect useFactory provider by keyword", () => {
			const providers = ['{ provide: "TOKEN", useFactory: () => {} }'];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result[0].type).toBe("UseFactory");
		});

		it("should detect useClass provider by keyword", () => {
			const providers = ['{ provide: Token, useClass: Implementation }'];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result[0].type).toBe("UseClass");
		});

		it("should default to Class provider when no keyword found", () => {
			const providers = ["SimpleService"];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result[0].type).toBe("Class");
		});
	});

	describe("Empty and Edge Cases", () => {
		it("should handle empty providers array", () => {
			const providers: string[] = [];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result).toHaveLength(0);
		});

		it("should handle single provider", () => {
			const providers = ["UserService"];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result).toHaveLength(1);
		});

		it("should handle providers without source file", () => {
			const providers = ["UserService", "DatabaseService"];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result).toHaveLength(2);
			expect(result[0].type).toBe("Class");
			expect(result[1].type).toBe("Class");
		});

		it("should handle providers with source file but no file path", () => {
			const code = "class UserService {}";
			const sourceFile = createSourceFile(code);
			const providers = ["UserService"];
			const parser = new ProvidersParser(providers, sourceFile);
			const result = parser.parse();

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe("Class");
		});
	});

	describe("Complex Provider Strings", () => {
		it("should handle provider with scope", () => {
			const providers = ['{ provide: "TOKEN", useValue: "value", scope: "singleton" }'];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result[0].type).toBe("UseValue");
			expect(result[0].token).toBe("TOKEN");
		});

		it("should handle provider with inject array", () => {
			const providers = ['{ provide: "TOKEN", useFactory: () => {}, inject: [ServiceA, ServiceB] }'];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result[0].type).toBe("UseFactory");
		});

		it("should handle nested braces in factory", () => {
			const providers = ['{ provide: "TOKEN", useFactory: () => { return { key: "value" }; } }'];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result[0].type).toBe("UseFactory");
		});
	});

	describe("Order Preservation", () => {
		it("should preserve provider order", () => {
			const providers = [
				"ServiceA",
				"ServiceB",
				"ServiceC",
				'{ provide: "CONFIG", useValue: "value" }',
			];
			const parser = new ProvidersParser(providers);
			const result = parser.parse();

			expect(result[0].token).toBe("ServiceA");
			expect(result[1].token).toBe("ServiceB");
			expect(result[2].token).toBe("ServiceC");
			expect(result[3].token).toBe("CONFIG");
		});
	});

	describe("Source File Integration", () => {
		it("should pass source file to class parser", () => {
			const code = `
				import { Injectable, Inject } from 'nexus-ioc';
				
				@Injectable()
				class UserService {
					constructor(@Inject(DatabaseService) private db: DatabaseService) {}
				}
			`;
			const sourceFile = createSourceFile(code);
			const providers = ["UserService"];
			const parser = new ProvidersParser(providers, sourceFile, "test.ts");
			const result = parser.parse();

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe("Class");
			expect(result[0].token).toBe("UserService");
		});

		it("should pass source file to useClass parser", () => {
			const code = `
				class UserService {}
				class MockUserService {}
			`;
			const sourceFile = createSourceFile(code);
			const providers = ['{ provide: UserService, useClass: MockUserService }'];
			const parser = new ProvidersParser(providers, sourceFile, "test.ts");
			const result = parser.parse();

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe("UseClass");
		});
	});
});

