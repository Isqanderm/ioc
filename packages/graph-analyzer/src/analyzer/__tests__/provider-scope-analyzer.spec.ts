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

			const result = new ProviderScopeAnalyzer(graphModel).analyze();

			expect(result.hasScopeAnalysis).toBe(true);
			expect(result.totalProviders).toBe(2);
			expect(result.singletonProviders).toBe(2);
			expect(result.transientProviders).toBe(0);
		});

		it("should detect transient providers", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("TransientService", {
							type: "UseClass",
							scope: "Scope.Transient",
						}),
						provider("AnotherTransientService", { scope: "Scope.Transient" }),
					],
				},
			});

			const result = new ProviderScopeAnalyzer(graphModel).analyze();

			expect(result.totalProviders).toBe(2);
			expect(result.singletonProviders).toBe(0);
			expect(result.transientProviders).toBe(2);
			expect(result.providerScopes.map((p) => p.scope)).toEqual([
				"Transient",
				"Transient",
			]);
		});

		it("should handle mixed scopes", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("SingletonService"),
						provider("TransientService", { scope: "Scope.Transient" }),
						provider("CONFIG", { type: "UseValue" }),
					],
				},
			});

			const result = new ProviderScopeAnalyzer(graphModel).analyze();

			expect(result.totalProviders).toBe(3);
			expect(result.singletonProviders).toBe(2);
			expect(result.transientProviders).toBe(1);
		});

		it("should treat an explicit Scope.Singleton as Singleton", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [provider("S", { scope: "Scope.Singleton" })],
				},
			});

			const result = new ProviderScopeAnalyzer(graphModel).analyze();

			expect(result.providerScopes[0].scope).toBe("Singleton");
		});
	});

	describe("No scope mismatch rule", () => {
		it("a Singleton depending on a Transient produces no issue", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("SingletonService", {
							dependencies: [{ token: "TransientService", optional: false }],
						}),
						provider("TransientService", { scope: "Scope.Transient" }),
					],
				},
			});

			const result = new ProviderScopeAnalyzer(graphModel).analyze();

			expect(result).not.toHaveProperty("scopeMismatches");
			expect(result.providerScopes).toHaveLength(2);
		});
	});

	describe("UseFactory Provider Scope", () => {
		it("should detect scope for UseFactory providers", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("FACTORY_TOKEN", {
							type: "UseFactory",
							scope: "Scope.Transient",
							dependencies: [{ token: "ConfigService", optional: false }],
						}),
					],
				},
			});

			const result = new ProviderScopeAnalyzer(graphModel).analyze();

			expect(result.transientProviders).toBe(1);
			expect(result.providerScopes[0].scope).toBe("Transient");
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty graph", () => {
			const graphModel = buildGraphModel("AppModule", {});

			const result = new ProviderScopeAnalyzer(graphModel).analyze();

			expect(result.hasScopeAnalysis).toBe(true);
			expect(result.totalProviders).toBe(0);
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

			const result = new ProviderScopeAnalyzer(graphModel).analyze();

			expect(result.totalProviders).toBe(1);
		});
	});
});
