import { describe, expect, it } from "vitest";
import {
	buildGraphModel,
	provider,
} from "../../graph/__tests__/graph-model-fixture";
import { CircularDependencyDetector } from "../circular-dependency-detector";

describe("CircularDependencyDetector", () => {
	describe("Module Circular Dependencies", () => {
		it("should detect no circular dependencies in linear module chain", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: { imports: ["ModuleA"] },
				ModuleA: { imports: ["ModuleB"] },
				ModuleB: { imports: [] },
			});

			const detector = new CircularDependencyDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasCircularDependencies).toBe(false);
			expect(analysis.circularDependencies).toHaveLength(0);
			expect(analysis.moduleCircularCount).toBe(0);
			expect(analysis.providerCircularCount).toBe(0);
		});

		it("should detect simple circular dependency (A -> B -> A)", () => {
			const graphModel = buildGraphModel("ModuleA", {
				ModuleA: { imports: ["ModuleB"] },
				ModuleB: { imports: ["ModuleA"] },
			});

			const detector = new CircularDependencyDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasCircularDependencies).toBe(true);
			expect(analysis.moduleCircularCount).toBe(1);
			expect(analysis.circularDependencies).toHaveLength(1);

			const cycle = analysis.circularDependencies[0];
			expect(cycle.type).toBe("module");
			expect(cycle.severity).toBe("error");
			expect(cycle.cycle).toEqual(["ModuleA", "ModuleB", "ModuleA"]);
			expect(cycle.message).toContain("Circular module import detected");
		});

		it("should detect complex circular dependency (A -> B -> C -> A)", () => {
			const graphModel = buildGraphModel("ModuleA", {
				ModuleA: { imports: ["ModuleB"] },
				ModuleB: { imports: ["ModuleC"] },
				ModuleC: { imports: ["ModuleA"] },
			});

			const detector = new CircularDependencyDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasCircularDependencies).toBe(true);
			expect(analysis.moduleCircularCount).toBe(1);

			const cycle = analysis.circularDependencies[0];
			expect(cycle.cycle).toEqual(["ModuleA", "ModuleB", "ModuleC", "ModuleA"]);
		});

		it("should detect self-referencing module", () => {
			const graphModel = buildGraphModel("ModuleA", {
				ModuleA: { imports: ["ModuleA"] },
			});

			const detector = new CircularDependencyDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasCircularDependencies).toBe(true);
			expect(analysis.moduleCircularCount).toBe(1);

			const cycle = analysis.circularDependencies[0];
			expect(cycle.cycle).toEqual(["ModuleA", "ModuleA"]);
		});
	});

	describe("Provider Circular Dependencies", () => {
		it("should detect no circular dependencies in linear provider chain", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("ServiceA", {
							dependencies: [{ token: "ServiceB", optional: false }],
						}),
						provider("ServiceB", {
							dependencies: [{ token: "ServiceC", optional: false }],
						}),
						provider("ServiceC", { dependencies: [] }),
					],
				},
			});

			const detector = new CircularDependencyDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasCircularDependencies).toBe(false);
			expect(analysis.providerCircularCount).toBe(0);
		});

		it("should detect simple provider circular dependency (A -> B -> A)", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("ServiceA", {
							dependencies: [{ token: "ServiceB", optional: false }],
						}),
						provider("ServiceB", {
							dependencies: [{ token: "ServiceA", optional: false }],
						}),
					],
				},
			});

			const detector = new CircularDependencyDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasCircularDependencies).toBe(true);
			expect(analysis.providerCircularCount).toBe(1);

			const cycle = analysis.circularDependencies[0];
			expect(cycle.type).toBe("provider");
			expect(cycle.severity).toBe("error");
			expect(cycle.cycle).toEqual(["ServiceA", "ServiceB", "ServiceA"]);
			expect(cycle.message).toContain("Circular provider dependency detected");
		});

		it("should detect complex provider circular dependency (A -> B -> C -> A)", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("ServiceA", {
							dependencies: [{ token: "ServiceB", optional: false }],
						}),
						provider("ServiceB", {
							dependencies: [{ token: "ServiceC", optional: false }],
						}),
						provider("ServiceC", {
							dependencies: [{ token: "ServiceA", optional: false }],
						}),
					],
				},
			});

			const detector = new CircularDependencyDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasCircularDependencies).toBe(true);
			expect(analysis.providerCircularCount).toBe(1);

			const cycle = analysis.circularDependencies[0];
			expect(cycle.cycle).toEqual([
				"ServiceA",
				"ServiceB",
				"ServiceC",
				"ServiceA",
			]);
		});

		it("should ignore optional dependencies in circular detection", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("ServiceA", {
							dependencies: [{ token: "ServiceB", optional: false }],
						}),
						provider("ServiceB", {
							dependencies: [{ token: "ServiceA", optional: true }], // Optional
						}),
					],
				},
			});

			const detector = new CircularDependencyDetector(graphModel);
			const analysis = detector.analyze();

			// Optional dependencies break the cycle
			expect(analysis.hasCircularDependencies).toBe(false);
			expect(analysis.providerCircularCount).toBe(0);
		});

		it("should detect a factory-inject cycle", () => {
			const graphModel = buildGraphModel("AppModule", {
				AppModule: {
					providers: [
						provider("A", {
							type: "UseFactory",
							dependencies: [{ token: "B", optional: false }],
						}),
						provider("B", {
							type: "UseFactory",
							dependencies: [{ token: "A", optional: false }],
						}),
					],
				},
			});

			const detector = new CircularDependencyDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasCircularDependencies).toBe(true);
			expect(analysis.providerCircularCount).toBe(1);

			const cycle = analysis.circularDependencies[0];
			expect(cycle.cycle).toEqual(["A", "B", "A"]);
		});
	});

	describe("Name Collisions", () => {
		it("does not conflate two different provider classes that share a display name", () => {
			// ModuleA's "Service" and "Other" form a real cycle. ModuleB
			// registers an unrelated provider that happens to share the name
			// "Service" but has no dependencies at all. Before matching by id,
			// the second `providerDeps.set("Service", ...)` in
			// buildProviderDependencyMap() would silently overwrite the first,
			// losing ModuleA's real cycle (false negative).
			const graphModel = buildGraphModel("ModuleA", {
				ModuleA: {
					providers: [
						provider("Service", {
							id: "svc-a",
							dependencies: [
								{ token: "Other", tokenId: "other-a", optional: false },
							],
						}),
						provider("Other", {
							id: "other-a",
							dependencies: [
								{ token: "Service", tokenId: "svc-a", optional: false },
							],
						}),
					],
				},
				ModuleB: {
					providers: [provider("Service", { id: "svc-b" })],
				},
			});

			const detector = new CircularDependencyDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasCircularDependencies).toBe(true);
			expect(analysis.providerCircularCount).toBe(1);
			expect(analysis.circularDependencies[0].cycle).toEqual([
				"Service",
				"Other",
				"Service",
			]);
		});
	});

	describe("Mixed Scenarios", () => {
		it("should detect both module and provider circular dependencies", () => {
			const graphModel = buildGraphModel("ModuleA", {
				ModuleA: {
					imports: ["ModuleB"],
					providers: [
						provider("ServiceA", {
							dependencies: [{ token: "ServiceB", optional: false }],
						}),
					],
				},
				ModuleB: {
					imports: ["ModuleA"], // Module circular
					providers: [
						provider("ServiceB", {
							dependencies: [{ token: "ServiceA", optional: false }], // Provider circular
						}),
					],
				},
			});

			const detector = new CircularDependencyDetector(graphModel);
			const analysis = detector.analyze();

			expect(analysis.hasCircularDependencies).toBe(true);
			expect(analysis.moduleCircularCount).toBe(1);
			expect(analysis.providerCircularCount).toBe(1);
			expect(analysis.circularDependencies).toHaveLength(2);
		});
	});
});
