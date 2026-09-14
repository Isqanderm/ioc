import { describe, expect, it } from "vitest";
import {
	buildGraphModel,
	provider,
} from "../../graph/__tests__/graph-model-fixture";
import { ProviderScopeAnalyzer } from "../provider-scope-analyzer";

describe("ProviderScopeAnalyzer", () => {
	describe("Basic Scope Detection", () => {
		it("should detect singleton providers", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("UserService"),
						provider("CONFIG", { type: "UseValue" }),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			expect(result.hasScopeAnalysis).toBe(true);
			expect(result.totalProviders).toBe(2);
			expect(result.singletonProviders).toBe(2);
			expect(result.requestProviders).toBe(0);
		});

		it("should detect request-scoped providers", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("RequestService", {
							type: "UseClass",
							scope: "Scope.REQUEST",
						}),
						provider("AnotherRequestService", { scope: "Scope.Request" }),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			expect(result.totalProviders).toBe(2);
			expect(result.singletonProviders).toBe(0);
			expect(result.requestProviders).toBe(2);
		});

		it("should handle mixed scopes", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("SingletonService"),
						provider("RequestService", { scope: "Scope.REQUEST" }),
						provider("CONFIG", { type: "UseValue" }),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			expect(result.totalProviders).toBe(3);
			expect(result.singletonProviders).toBe(2);
			expect(result.requestProviders).toBe(1);
		});
	});

	describe("Scope Mismatch Detection", () => {
		it("should detect singleton depending on request-scoped provider", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("SingletonService", {
							dependencies: [{ token: "RequestService", optional: false }],
						}),
						provider("RequestService", { scope: "Scope.REQUEST" }),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
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
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("RequestService", {
							scope: "Scope.REQUEST",
							dependencies: [{ token: "SingletonService", optional: false }],
						}),
						provider("SingletonService"),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			expect(result.scopeMismatches).toHaveLength(0);
		});

		it("should detect multiple scope mismatches", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("ServiceA", {
							dependencies: [{ token: "RequestService1", optional: false }],
						}),
						provider("ServiceB", {
							dependencies: [{ token: "RequestService2", optional: false }],
						}),
						provider("RequestService1", { scope: "Scope.REQUEST" }),
						provider("RequestService2", { scope: "Scope.REQUEST" }),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			expect(result.scopeMismatches).toHaveLength(2);
			expect(result.scopeMismatches[0].provider).toBe("ServiceA");
			expect(result.scopeMismatches[1].provider).toBe("ServiceB");
		});

		it("should ignore optional dependencies in scope mismatch detection", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("SingletonService", {
							dependencies: [{ token: "RequestService", optional: true }],
						}),
						provider("RequestService", { scope: "Scope.REQUEST" }),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			// Optional dependencies should not cause scope mismatches
			expect(result.scopeMismatches).toHaveLength(0);
		});
	});

	describe("UseFactory Provider Scope", () => {
		it("should detect scope for UseFactory providers", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("FACTORY_TOKEN", {
							type: "UseFactory",
							scope: "Scope.REQUEST",
							dependencies: [{ token: "ConfigService", optional: false }],
						}),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			expect(result.requestProviders).toBe(1);
			expect(result.providerScopes[0].scope).toBe("Request");
		});

		it("should detect scope mismatch with UseFactory dependencies", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("FACTORY_TOKEN", {
							type: "UseFactory",
							dependencies: [{ token: "RequestService", optional: false }],
						}),
						provider("RequestService", { scope: "Scope.REQUEST" }),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			expect(result.scopeMismatches).toHaveLength(1);
			expect(result.scopeMismatches[0].provider).toBe("FACTORY_TOKEN");
			expect(result.scopeMismatches[0].dependency).toBe("RequestService");
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty graph", () => {
			const graphModel = buildGraphModel("AppModule", {});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			expect(result.hasScopeAnalysis).toBe(true);
			expect(result.totalProviders).toBe(0);
			expect(result.scopeMismatches).toHaveLength(0);
		});

		it("should handle providers without dependencies", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("ServiceA"),
						provider("ServiceB", { scope: "Scope.REQUEST" }),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			expect(result.totalProviders).toBe(2);
			expect(result.scopeMismatches).toHaveLength(0);
		});

		it("should handle dependency on non-existent provider", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("ServiceA", {
							dependencies: [{ token: "NonExistentService", optional: false }],
						}),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			// Should not crash, just no scope mismatch detected
			expect(result.totalProviders).toBe(1);
			expect(result.scopeMismatches).toHaveLength(0);
		});
	});
});
