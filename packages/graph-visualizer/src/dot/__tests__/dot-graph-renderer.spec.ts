import type {
	CircularDependency,
	GraphOutput,
} from "@nexus-ioc/graph-analyzer";
import { describe, expect, it } from "vitest";
import { DotGraphRenderer } from "../dot-graph-renderer";

function graphOutput(overrides: Partial<GraphOutput> = {}): GraphOutput {
	return {
		modules: [],
		providers: [],
		metadata: {
			entryPoint: "/app/entry.ts",
			rootModule: "AppModule",
			analyzedAt: new Date().toISOString(),
			version: "1.0.0",
			totalModules: 0,
			totalProviders: 0,
		},
		...overrides,
	};
}

describe("DotGraphRenderer", () => {
	it("renders a subgraph cluster per module with its providers", () => {
		const output = graphOutput({
			modules: [
				{
					name: "AppModule",
					path: "/app/app.module.ts",
					imports: [],
					exports: [],
					providers: ["AppService"],
					isGlobal: false,
				},
			],
			providers: [
				{
					token: "AppService",
					type: "Class",
					module: "AppModule",
					dependencies: [],
				},
			],
		});

		const dot = new DotGraphRenderer(output).render();

		expect(dot).toContain("subgraph cluster_AppModule");
		expect(dot).toContain('"AppModule"');
		expect(dot).toContain('"AppService"');
	});

	it("colors a circular module import edge red", () => {
		const output = graphOutput({
			modules: [
				{
					name: "ModuleA",
					path: "/app/a.ts",
					imports: ["ModuleB"],
					exports: [],
					providers: [],
					isGlobal: false,
				},
				{
					name: "ModuleB",
					path: "/app/b.ts",
					imports: ["ModuleA"],
					exports: [],
					providers: [],
					isGlobal: false,
				},
			],
		});
		const circularDependencies: CircularDependency[] = [
			{
				type: "module",
				cycle: ["ModuleA", "ModuleB", "ModuleA"],
				severity: "error",
				message:
					"Circular module import detected: ModuleA -> ModuleB -> ModuleA",
			},
		];

		const dot = new DotGraphRenderer(output, {}, circularDependencies).render();

		expect(dot).toContain('"ModuleB" -> "ModuleA" [color="#ff0000"');
	});

	it("colors a circular provider dependency edge red", () => {
		const output = graphOutput({
			modules: [
				{
					name: "AppModule",
					path: "/app/app.module.ts",
					imports: [],
					exports: [],
					providers: ["ServiceA", "ServiceB"],
					isGlobal: false,
				},
			],
			providers: [
				{
					token: "ServiceA",
					type: "Class",
					module: "AppModule",
					dependencies: [{ token: "ServiceB", optional: false }],
				},
				{
					token: "ServiceB",
					type: "Class",
					module: "AppModule",
					dependencies: [{ token: "ServiceA", optional: false }],
				},
			],
		});
		const circularDependencies: CircularDependency[] = [
			{
				type: "provider",
				cycle: ["ServiceA", "ServiceB", "ServiceA"],
				severity: "error",
				message: "Circular provider dependency detected",
			},
		];

		const dot = new DotGraphRenderer(output, {}, circularDependencies).render();

		expect(dot).toContain('"ServiceB" -> "ServiceA" [color="#ff0000"');
		expect(dot).toContain('"ServiceA" -> "ServiceB" [color="#ff0000"');
	});

	it("does not color a non-circular edge red", () => {
		const output = graphOutput({
			modules: [
				{
					name: "AppModule",
					path: "/app/app.module.ts",
					imports: ["OtherModule"],
					exports: [],
					providers: [],
					isGlobal: false,
				},
				{
					name: "OtherModule",
					path: "/app/other.module.ts",
					imports: [],
					exports: [],
					providers: [],
					isGlobal: false,
				},
			],
		});

		const dot = new DotGraphRenderer(output).render();

		expect(dot).toContain('"OtherModule" -> "AppModule" [color="#000"');
	});

	it("omits provider nodes and edges when showProviders is false", () => {
		const output = graphOutput({
			modules: [
				{
					name: "AppModule",
					path: "/app/app.module.ts",
					imports: [],
					exports: [],
					providers: ["AppService"],
					isGlobal: false,
				},
			],
			providers: [
				{
					token: "AppService",
					type: "Class",
					module: "AppModule",
					dependencies: [],
				},
			],
		});

		const dot = new DotGraphRenderer(output, { showProviders: false }).render();

		expect(dot).not.toContain('"AppService"');
	});
});
