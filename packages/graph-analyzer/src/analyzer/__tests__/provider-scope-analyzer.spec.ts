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
			expect(result.scopedProviders).toBe(0);
		});

		it("should detect scoped providers", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("ScopedService", {
							type: "UseClass",
							scope: "Scope.SCOPED",
						}),
						provider("AnotherScopedService", { scope: "Scope.Scoped" }),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			expect(result.totalProviders).toBe(2);
			expect(result.singletonProviders).toBe(0);
			expect(result.scopedProviders).toBe(2);
		});

		it("should handle mixed scopes", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("SingletonService"),
						provider("ScopedService", { scope: "Scope.SCOPED" }),
						provider("CONFIG", { type: "UseValue" }),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			expect(result.totalProviders).toBe(3);
			expect(result.singletonProviders).toBe(2);
			expect(result.scopedProviders).toBe(1);
		});
	});

	describe("Scope Mismatch Detection", () => {
		it("should detect singleton depending on scoped provider", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("SingletonService", {
							dependencies: [{ token: "ScopedService", optional: false }],
						}),
						provider("ScopedService", { scope: "Scope.SCOPED" }),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			expect(result.scopeMismatches).toHaveLength(1);
			expect(result.scopeMismatches[0]).toMatchObject({
				provider: "SingletonService",
				providerScope: "Singleton",
				dependency: "ScopedService",
				dependencyScope: "Scoped",
				severity: "error",
			});
			expect(result.scopeMismatches[0].message).toContain("memory leaks");
			expect(result.scopeMismatches[0].suggestions).toHaveLength(3);
		});

		it("should not flag scoped depending on singleton", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("ScopedService", {
							scope: "Scope.SCOPED",
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
							dependencies: [{ token: "ScopedService1", optional: false }],
						}),
						provider("ServiceB", {
							dependencies: [{ token: "ScopedService2", optional: false }],
						}),
						provider("ScopedService1", { scope: "Scope.SCOPED" }),
						provider("ScopedService2", { scope: "Scope.SCOPED" }),
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
							dependencies: [{ token: "ScopedService", optional: true }],
						}),
						provider("ScopedService", { scope: "Scope.SCOPED" }),
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
							scope: "Scope.SCOPED",
							dependencies: [{ token: "ConfigService", optional: false }],
						}),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			expect(result.scopedProviders).toBe(1);
			expect(result.providerScopes[0].scope).toBe("Scoped");
		});

		it("should detect scope mismatch with UseFactory dependencies", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("FACTORY_TOKEN", {
							type: "UseFactory",
							dependencies: [{ token: "ScopedService", optional: false }],
						}),
						provider("ScopedService", { scope: "Scope.SCOPED" }),
					],
				},
			});

			const analyzer = new ProviderScopeAnalyzer(graphModel);
			const result = analyzer.analyze();

			expect(result.scopeMismatches).toHaveLength(1);
			expect(result.scopeMismatches[0].provider).toBe("FACTORY_TOKEN");
			expect(result.scopeMismatches[0].dependency).toBe("ScopedService");
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
						provider("ServiceB", { scope: "Scope.SCOPED" }),
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
