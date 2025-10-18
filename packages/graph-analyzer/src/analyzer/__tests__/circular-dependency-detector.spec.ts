import { describe, expect, it } from "vitest";
import type { ParseEntryFile } from "../../parser/parse-entry-file";
import type { ParseNsModule } from "../../parser/parse-ns-module";
import { CircularDependencyDetector } from "../circular-dependency-detector";

describe("CircularDependencyDetector", () => {
	describe("Module Circular Dependencies", () => {
		it("should detect no circular dependencies in linear module chain", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				imports: ["ModuleA"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleA", {
				imports: ["ModuleB"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleB", {
				imports: [],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new CircularDependencyDetector(graph);
			const analysis = detector.analyze();

			expect(analysis.hasCircularDependencies).toBe(false);
			expect(analysis.circularDependencies).toHaveLength(0);
			expect(analysis.moduleCircularCount).toBe(0);
			expect(analysis.providerCircularCount).toBe(0);
		});

		it("should detect simple circular dependency (A -> B -> A)", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "ModuleA",
			} as unknown as ParseEntryFile);

			graph.set("ModuleA", {
				imports: ["ModuleB"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleB", {
				imports: ["ModuleA"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new CircularDependencyDetector(graph);
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
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "ModuleA",
			} as unknown as ParseEntryFile);

			graph.set("ModuleA", {
				imports: ["ModuleB"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleB", {
				imports: ["ModuleC"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleC", {
				imports: ["ModuleA"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new CircularDependencyDetector(graph);
			const analysis = detector.analyze();

			expect(analysis.hasCircularDependencies).toBe(true);
			expect(analysis.moduleCircularCount).toBe(1);

			const cycle = analysis.circularDependencies[0];
			expect(cycle.cycle).toEqual(["ModuleA", "ModuleB", "ModuleC", "ModuleA"]);
		});

		it("should detect self-referencing module", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "ModuleA",
			} as unknown as ParseEntryFile);

			graph.set("ModuleA", {
				imports: ["ModuleA"],
				providers: [],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new CircularDependencyDetector(graph);
			const analysis = detector.analyze();

			expect(analysis.hasCircularDependencies).toBe(true);
			expect(analysis.moduleCircularCount).toBe(1);

			const cycle = analysis.circularDependencies[0];
			expect(cycle.cycle).toEqual(["ModuleA", "ModuleA"]);
		});
	});

	describe("Provider Circular Dependencies", () => {
		it("should detect no circular dependencies in linear provider chain", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				imports: [],
				providers: [
					{
						token: "ServiceA",
						type: "Class",
						dependencies: [{ token: "ServiceB", optional: false }],
					},
					{
						token: "ServiceB",
						type: "Class",
						dependencies: [{ token: "ServiceC", optional: false }],
					},
					{
						token: "ServiceC",
						type: "Class",
						dependencies: [],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new CircularDependencyDetector(graph);
			const analysis = detector.analyze();

			expect(analysis.hasCircularDependencies).toBe(false);
			expect(analysis.providerCircularCount).toBe(0);
		});

		it("should detect simple provider circular dependency (A -> B -> A)", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				imports: [],
				providers: [
					{
						token: "ServiceA",
						type: "Class",
						dependencies: [{ token: "ServiceB", optional: false }],
					},
					{
						token: "ServiceB",
						type: "Class",
						dependencies: [{ token: "ServiceA", optional: false }],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new CircularDependencyDetector(graph);
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
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				imports: [],
				providers: [
					{
						token: "ServiceA",
						type: "Class",
						dependencies: [{ token: "ServiceB", optional: false }],
					},
					{
						token: "ServiceB",
						type: "Class",
						dependencies: [{ token: "ServiceC", optional: false }],
					},
					{
						token: "ServiceC",
						type: "Class",
						dependencies: [{ token: "ServiceA", optional: false }],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new CircularDependencyDetector(graph);
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
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				imports: [],
				providers: [
					{
						token: "ServiceA",
						type: "Class",
						dependencies: [{ token: "ServiceB", optional: false }],
					},
					{
						token: "ServiceB",
						type: "Class",
						dependencies: [{ token: "ServiceA", optional: true }], // Optional
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new CircularDependencyDetector(graph);
			const analysis = detector.analyze();

			// Optional dependencies break the cycle
			expect(analysis.hasCircularDependencies).toBe(false);
			expect(analysis.providerCircularCount).toBe(0);
		});
	});

	describe("Mixed Scenarios", () => {
		it("should detect both module and provider circular dependencies", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "ModuleA",
			} as unknown as ParseEntryFile);

			graph.set("ModuleA", {
				imports: ["ModuleB"],
				providers: [
					{
						token: "ServiceA",
						type: "Class",
						dependencies: [{ token: "ServiceB", optional: false }],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleB", {
				imports: ["ModuleA"], // Module circular
				providers: [
					{
						token: "ServiceB",
						type: "Class",
						dependencies: [{ token: "ServiceA", optional: false }], // Provider circular
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new CircularDependencyDetector(graph);
			const analysis = detector.analyze();

			expect(analysis.hasCircularDependencies).toBe(true);
			expect(analysis.moduleCircularCount).toBe(1);
			expect(analysis.providerCircularCount).toBe(1);
			expect(analysis.circularDependencies).toHaveLength(2);
		});
	});
});
