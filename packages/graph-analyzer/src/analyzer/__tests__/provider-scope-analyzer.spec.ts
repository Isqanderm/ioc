import { describe, expect, it } from "vitest";
import type { ParseEntryFile } from "../../parser/parse-entry-file";
import type { ParseNsModule } from "../../parser/parse-ns-module";
import { ProviderScopeAnalyzer } from "../provider-scope-analyzer";

describe("ProviderScopeAnalyzer", () => {
	describe("Basic Scope Detection", () => {
		it("should detect singleton providers", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "UserService",
						type: "Class",
						dependencies: [],
					},
					{
						token: "CONFIG",
						type: "UseValue",
						dependencies: [],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ProviderScopeAnalyzer(graph);
			const result = analyzer.analyze();

			expect(result.hasScopeAnalysis).toBe(true);
			expect(result.totalProviders).toBe(2);
			expect(result.singletonProviders).toBe(2);
			expect(result.requestProviders).toBe(0);
		});

		it("should detect request-scoped providers", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "RequestService",
						type: "UseClass",
						scope: "Scope.REQUEST",
						dependencies: [],
					},
					{
						token: "AnotherRequestService",
						type: "Class",
						scope: "Scope.Request",
						dependencies: [],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ProviderScopeAnalyzer(graph);
			const result = analyzer.analyze();

			expect(result.totalProviders).toBe(2);
			expect(result.singletonProviders).toBe(0);
			expect(result.requestProviders).toBe(2);
		});

		it("should handle mixed scopes", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "SingletonService",
						type: "Class",
						dependencies: [],
					},
					{
						token: "RequestService",
						type: "Class",
						scope: "Scope.REQUEST",
						dependencies: [],
					},
					{
						token: "CONFIG",
						type: "UseValue",
						dependencies: [],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ProviderScopeAnalyzer(graph);
			const result = analyzer.analyze();

			expect(result.totalProviders).toBe(3);
			expect(result.singletonProviders).toBe(2);
			expect(result.requestProviders).toBe(1);
		});
	});

	describe("Scope Mismatch Detection", () => {
		it("should detect singleton depending on request-scoped provider", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "SingletonService",
						type: "Class",
						dependencies: [
							{
								type: "constructor",
								index: 0,
								token: "RequestService",
								tokenType: "class",
								optional: false,
								hasExplicitDecorator: false,
							},
						],
					},
					{
						token: "RequestService",
						type: "Class",
						scope: "Scope.REQUEST",
						dependencies: [],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ProviderScopeAnalyzer(graph);
			const result = analyzer.analyze();

			expect(result.scopeMismatches).toHaveLength(1);
			expect(result.scopeMismatches[0]).toMatchObject({
				provider: "SingletonService",
				providerScope: "Singleton",
				dependency: "RequestService",
				dependencyScope: "Request",
				severity: "error",
			});
			expect(result.scopeMismatches[0].message).toContain("memory leaks");
			expect(result.scopeMismatches[0].suggestions).toHaveLength(3);
		});

		it("should not flag request-scoped depending on singleton", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "RequestService",
						type: "Class",
						scope: "Scope.REQUEST",
						dependencies: [
							{
								type: "constructor",
								index: 0,
								token: "SingletonService",
								tokenType: "class",
								optional: false,
								hasExplicitDecorator: false,
							},
						],
					},
					{
						token: "SingletonService",
						type: "Class",
						dependencies: [],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ProviderScopeAnalyzer(graph);
			const result = analyzer.analyze();

			expect(result.scopeMismatches).toHaveLength(0);
		});

		it("should detect multiple scope mismatches", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "ServiceA",
						type: "Class",
						dependencies: [
							{
								type: "constructor",
								index: 0,
								token: "RequestService1",
								tokenType: "class",
								optional: false,
								hasExplicitDecorator: false,
							},
						],
					},
					{
						token: "ServiceB",
						type: "Class",
						dependencies: [
							{
								type: "constructor",
								index: 0,
								token: "RequestService2",
								tokenType: "class",
								optional: false,
								hasExplicitDecorator: false,
							},
						],
					},
					{
						token: "RequestService1",
						type: "Class",
						scope: "Scope.REQUEST",
						dependencies: [],
					},
					{
						token: "RequestService2",
						type: "Class",
						scope: "Scope.REQUEST",
						dependencies: [],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ProviderScopeAnalyzer(graph);
			const result = analyzer.analyze();

			expect(result.scopeMismatches).toHaveLength(2);
			expect(result.scopeMismatches[0].provider).toBe("ServiceA");
			expect(result.scopeMismatches[1].provider).toBe("ServiceB");
		});

		it("should ignore optional dependencies in scope mismatch detection", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "SingletonService",
						type: "Class",
						dependencies: [
							{
								type: "constructor",
								index: 0,
								token: "RequestService",
								tokenType: "class",
								optional: true,
								hasExplicitDecorator: false,
							},
						],
					},
					{
						token: "RequestService",
						type: "Class",
						scope: "Scope.REQUEST",
						dependencies: [],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ProviderScopeAnalyzer(graph);
			const result = analyzer.analyze();

			// Optional dependencies should not cause scope mismatches
			expect(result.scopeMismatches).toHaveLength(0);
		});
	});

	describe("UseFactory Provider Scope", () => {
		it("should detect scope for UseFactory providers", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "FACTORY_TOKEN",
						type: "UseFactory",
						scope: "Scope.REQUEST",
						inject: ["ConfigService"],
						dependencies: [],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ProviderScopeAnalyzer(graph);
			const result = analyzer.analyze();

			expect(result.requestProviders).toBe(1);
			expect(result.providerScopes[0].scope).toBe("Request");
		});

		it("should detect scope mismatch with UseFactory dependencies", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "FACTORY_TOKEN",
						type: "UseFactory",
						inject: ["RequestService"],
						dependencies: [],
					},
					{
						token: "RequestService",
						type: "Class",
						scope: "Scope.REQUEST",
						dependencies: [],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ProviderScopeAnalyzer(graph);
			const result = analyzer.analyze();

			expect(result.scopeMismatches).toHaveLength(1);
			expect(result.scopeMismatches[0].provider).toBe("FACTORY_TOKEN");
			expect(result.scopeMismatches[0].dependency).toBe("RequestService");
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty graph", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			const analyzer = new ProviderScopeAnalyzer(graph);
			const result = analyzer.analyze();

			expect(result.hasScopeAnalysis).toBe(true);
			expect(result.totalProviders).toBe(0);
			expect(result.scopeMismatches).toHaveLength(0);
		});

		it("should handle providers without dependencies", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "ServiceA",
						type: "Class",
						dependencies: [],
					},
					{
						token: "ServiceB",
						type: "Class",
						scope: "Scope.REQUEST",
						dependencies: [],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ProviderScopeAnalyzer(graph);
			const result = analyzer.analyze();

			expect(result.totalProviders).toBe(2);
			expect(result.scopeMismatches).toHaveLength(0);
		});

		it("should handle dependency on non-existent provider", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "ServiceA",
						type: "Class",
						dependencies: [
							{
								type: "constructor",
								index: 0,
								token: "NonExistentService",
								tokenType: "class",
								optional: false,
								hasExplicitDecorator: false,
							},
						],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const analyzer = new ProviderScopeAnalyzer(graph);
			const result = analyzer.analyze();

			// Should not crash, just no scope mismatch detected
			expect(result.totalProviders).toBe(1);
			expect(result.scopeMismatches).toHaveLength(0);
		});
	});
});
