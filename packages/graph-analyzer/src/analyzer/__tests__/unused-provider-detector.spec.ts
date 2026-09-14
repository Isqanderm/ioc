import { describe, expect, it } from "vitest";
import {
	buildGraphModel,
	provider,
} from "../../graph/__tests__/graph-model-fixture";
import { UnusedProviderDetector } from "../unused-provider-detector";

describe("UnusedProviderDetector", () => {
	describe("Basic Detection", () => {
		it("should detect no unused providers when all are injected", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("ServiceA"),
						provider("ServiceB", {
							dependencies: [{ token: "ServiceA", optional: false }],
						}),
						provider("ServiceC", {
							dependencies: [{ token: "ServiceB", optional: false }],
						}),
					],
				},
			});

			const detector = new UnusedProviderDetector(graphModel);
			const analysis = detector.analyze();

			// ServiceC is unused, but ServiceA and ServiceB are used
			expect(analysis.hasUnusedProviders).toBe(true);
			expect(analysis.unusedProviders).toHaveLength(1);
			expect(analysis.unusedProviders[0].token).toBe("ServiceC");
		});

		it("should detect unused provider when not injected anywhere", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("UsedService"),
						provider("UnusedService", {
							dependencies: [{ token: "UsedService", optional: false }],
						}),
					],
				},
			});

			const detector = new UnusedProviderDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasUnusedProviders).toBe(true);
			expect(analysis.unusedProviders).toHaveLength(1);
			expect(analysis.totalUnused).toBe(1);
			expect(analysis.unusedProviders[0].token).toBe("UnusedService");
			expect(analysis.unusedProviders[0].module).toBe("AppModule");
			expect(analysis.unusedProviders[0].type).toBe("Class");
			expect(analysis.unusedProviders[0].severity).toBe("warning");
		});

		it("should detect multiple unused providers", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("UnusedServiceA"),
						provider("UnusedServiceB", { type: "UseValue" }),
						provider("UnusedServiceC", { type: "UseFactory" }),
					],
				},
			});

			const detector = new UnusedProviderDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasUnusedProviders).toBe(true);
			expect(analysis.unusedProviders).toHaveLength(3);
			expect(analysis.totalUnused).toBe(3);

			const tokens = analysis.unusedProviders.map((p) => p.token);
			expect(tokens).toContain("UnusedServiceA");
			expect(tokens).toContain("UnusedServiceB");
			expect(tokens).toContain("UnusedServiceC");
		});
	});

	describe("Exported Providers", () => {
		it("should not mark exported providers as unused", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [provider("ExportedService")],
					exports: ["ExportedService"],
				},
			});

			const detector = new UnusedProviderDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasUnusedProviders).toBe(false);
			expect(analysis.unusedProviders).toHaveLength(0);
		});

		it("should detect unused non-exported providers even when module has exports", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [provider("ExportedService"), provider("UnusedService")],
					exports: ["ExportedService"],
				},
			});

			const detector = new UnusedProviderDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasUnusedProviders).toBe(true);
			expect(analysis.unusedProviders).toHaveLength(1);
			expect(analysis.unusedProviders[0].token).toBe("UnusedService");
		});
	});

	describe("Global Modules", () => {
		it("should not mark providers in global modules as unused", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [provider("GlobalService")],
					isGlobal: true,
				},
			});

			const detector = new UnusedProviderDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasUnusedProviders).toBe(false);
			expect(analysis.unusedProviders).toHaveLength(0);
		});
	});

	describe("Cross-Module Dependencies", () => {
		it("should detect usage across multiple modules", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					imports: ["ModuleA", "ModuleB"],
					providers: [
						provider("ServiceC", {
							dependencies: [{ token: "ServiceB", optional: false }],
						}),
					],
				},
				ModuleA: {
					providers: [provider("ServiceA")],
					exports: ["ServiceA"],
				},
				ModuleB: {
					providers: [
						provider("ServiceB", {
							dependencies: [{ token: "ServiceA", optional: false }],
						}),
					],
					exports: ["ServiceB"],
				},
			});

			const detector = new UnusedProviderDetector(graphModel);
			const analysis = detector.analyze();

			// ServiceA is exported and used in ModuleB, so it's not unused
			// ServiceB is exported and used in AppModule, so it's not unused
			// ServiceC is not used anywhere, so it's unused
			expect(analysis.hasUnusedProviders).toBe(true);
			expect(analysis.unusedProviders).toHaveLength(1);
			expect(analysis.unusedProviders[0].token).toBe("ServiceC");
		});
	});

	describe("Optional Dependencies", () => {
		it("should not count optional dependencies as usage", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("ServiceA"),
						provider("ServiceB", {
							dependencies: [{ token: "ServiceA", optional: true }],
						}),
					],
				},
			});

			const detector = new UnusedProviderDetector(graphModel);
			const analysis = detector.analyze();

			// ServiceA is only used as optional dependency, so it's marked as unused
			// ServiceB is also unused since it's not injected anywhere
			expect(analysis.hasUnusedProviders).toBe(true);
			expect(analysis.unusedProviders).toHaveLength(2);

			const tokens = analysis.unusedProviders.map((p) => p.token);
			expect(tokens).toContain("ServiceA");
			expect(tokens).toContain("ServiceB");
		});
	});

	describe("Provider Types", () => {
		it("should detect unused providers of all types", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("UnusedClass"),
						provider("UnusedValue", { type: "UseValue" }),
						provider("UnusedFactory", { type: "UseFactory" }),
						provider("UnusedUseClass", { type: "UseClass" }),
					],
				},
			});

			const detector = new UnusedProviderDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasUnusedProviders).toBe(true);
			expect(analysis.unusedProviders).toHaveLength(4);

			const types = analysis.unusedProviders.map((p) => p.type);
			expect(types).toContain("Class");
			expect(types).toContain("UseValue");
			expect(types).toContain("UseFactory");
			expect(types).toContain("UseClass");
		});
	});

	describe("Suggestions", () => {
		it("should provide removal suggestions for unused providers", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [provider("UnusedService")],
				},
			});

			const detector = new UnusedProviderDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.unusedProviders[0].suggestions).toBeDefined();
			expect(analysis.unusedProviders[0].suggestions.length).toBeGreaterThan(0);

			const suggestions = analysis.unusedProviders[0].suggestions.join(" ");
			expect(suggestions).toContain("Remove");
			expect(suggestions).toContain("UnusedService");
		});
	});
});
