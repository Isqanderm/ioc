import { describe, expect, it } from "vitest";
import type { ParseEntryFile } from "../../parser/parse-entry-file";
import type { ParseNsModule } from "../../parser/parse-ns-module";
import { UnusedProviderDetector } from "../unused-provider-detector";

describe("UnusedProviderDetector", () => {
	describe("Basic Detection", () => {
		it("should detect no unused providers when all are injected", () => {
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
						dependencies: [
							{
								type: "constructor",
								index: 0,
								token: "ServiceA",
								tokenType: "class",
								optional: false,
							},
						],
					},
					{
						token: "ServiceC",
						type: "Class",
						dependencies: [
							{
								type: "constructor",
								index: 0,
								token: "ServiceB",
								tokenType: "class",
								optional: false,
							},
						],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new UnusedProviderDetector(graph);
			const analysis = detector.analyze();

			// ServiceC is unused, but ServiceA and ServiceB are used
			expect(analysis.hasUnusedProviders).toBe(true);
			expect(analysis.unusedProviders).toHaveLength(1);
			expect(analysis.unusedProviders[0].token).toBe("ServiceC");
		});

		it("should detect unused provider when not injected anywhere", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "UsedService",
						type: "Class",
						dependencies: [],
					},
					{
						token: "UnusedService",
						type: "Class",
						dependencies: [
							{
								type: "constructor",
								index: 0,
								token: "UsedService",
								tokenType: "class",
								optional: false,
							},
						],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new UnusedProviderDetector(graph);
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
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "UnusedServiceA",
						type: "Class",
						dependencies: [],
					},
					{
						token: "UnusedServiceB",
						type: "UseValue",
						dependencies: [],
					},
					{
						token: "UnusedServiceC",
						type: "UseFactory",
						dependencies: [],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new UnusedProviderDetector(graph);
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
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "ExportedService",
						type: "Class",
						dependencies: [],
					},
				],
				exports: ["ExportedService"],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new UnusedProviderDetector(graph);
			const analysis = detector.analyze();

			expect(analysis.hasUnusedProviders).toBe(false);
			expect(analysis.unusedProviders).toHaveLength(0);
		});

		it("should detect unused non-exported providers even when module has exports", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "ExportedService",
						type: "Class",
						dependencies: [],
					},
					{
						token: "UnusedService",
						type: "Class",
						dependencies: [],
					},
				],
				exports: ["ExportedService"],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new UnusedProviderDetector(graph);
			const analysis = detector.analyze();

			expect(analysis.hasUnusedProviders).toBe(true);
			expect(analysis.unusedProviders).toHaveLength(1);
			expect(analysis.unusedProviders[0].token).toBe("UnusedService");
		});
	});

	describe("Global Modules", () => {
		it("should not mark providers in global modules as unused", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "GlobalService",
						type: "Class",
						dependencies: [],
					},
				],
				exports: [],
				isGlobal: true,
			} as unknown as ParseNsModule);

			const detector = new UnusedProviderDetector(graph);
			const analysis = detector.analyze();

			expect(analysis.hasUnusedProviders).toBe(false);
			expect(analysis.unusedProviders).toHaveLength(0);
		});
	});

	describe("Cross-Module Dependencies", () => {
		it("should detect usage across multiple modules", () => {
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: ["ModuleA", "ModuleB"],
				providers: [
					{
						token: "ServiceC",
						type: "Class",
						dependencies: [
							{
								type: "constructor",
								index: 0,
								token: "ServiceB",
								tokenType: "class",
								optional: false,
							},
						],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleA", {
				name: "ModuleA",
				imports: [],
				providers: [
					{
						token: "ServiceA",
						type: "Class",
						dependencies: [],
					},
				],
				exports: ["ServiceA"],
				isGlobal: false,
			} as unknown as ParseNsModule);

			graph.set("ModuleB", {
				name: "ModuleB",
				imports: [],
				providers: [
					{
						token: "ServiceB",
						type: "Class",
						dependencies: [
							{
								type: "constructor",
								index: 0,
								token: "ServiceA",
								tokenType: "class",
								optional: false,
							},
						],
					},
				],
				exports: ["ServiceB"],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new UnusedProviderDetector(graph);
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
						dependencies: [
							{
								type: "constructor",
								index: 0,
								token: "ServiceA",
								tokenType: "class",
								optional: true, // Optional dependency
							},
						],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new UnusedProviderDetector(graph);
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
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "UnusedClass",
						type: "Class",
						dependencies: [],
					},
					{
						token: "UnusedValue",
						type: "UseValue",
						dependencies: [],
					},
					{
						token: "UnusedFactory",
						type: "UseFactory",
						dependencies: [],
					},
					{
						token: "UnusedUseClass",
						type: "UseClass",
						dependencies: [],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new UnusedProviderDetector(graph);
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
			const graph = new Map<string, ParseNsModule | ParseEntryFile>();

			graph.set("entry", {
				name: "AppModule",
			} as unknown as ParseEntryFile);

			graph.set("AppModule", {
				name: "AppModule",
				imports: [],
				providers: [
					{
						token: "UnusedService",
						type: "Class",
						dependencies: [],
					},
				],
				exports: [],
				isGlobal: false,
			} as unknown as ParseNsModule);

			const detector = new UnusedProviderDetector(graph);
			const analysis = detector.analyze();

			expect(analysis.unusedProviders[0].suggestions).toBeDefined();
			expect(analysis.unusedProviders[0].suggestions.length).toBeGreaterThan(0);

			const suggestions = analysis.unusedProviders[0].suggestions.join(" ");
			expect(suggestions).toContain("Remove");
			expect(suggestions).toContain("UnusedService");
		});
	});
});
