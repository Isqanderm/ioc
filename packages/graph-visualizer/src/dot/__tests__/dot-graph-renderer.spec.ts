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
					module: { name: "AppModule", path: "/app/app.module.ts" },
					dependencies: [],
				},
			],
		});

		const dot = new DotGraphRenderer(output).render();

		expect(dot).toContain("subgraph cluster_AppModule__app_app_module_ts");
		expect(dot).toContain('"AppModule@/app/app.module.ts"');
		expect(dot).toContain('"AppModule@/app/app.module.ts::AppService"');
	});

	it("colors a circular module import edge red", () => {
		const output = graphOutput({
			modules: [
				{
					name: "ModuleA",
					path: "/app/a.ts",
					imports: [{ name: "ModuleB", path: "/app/b.ts" }],
					exports: [],
					providers: [],
					isGlobal: false,
				},
				{
					name: "ModuleB",
					path: "/app/b.ts",
					imports: [{ name: "ModuleA", path: "/app/a.ts" }],
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

		expect(dot).toContain(
			'"ModuleB@/app/b.ts" -> "ModuleA@/app/a.ts" [color="#ff0000"',
		);
	});

	it("colors a circular provider dependency edge red", () => {
		const appModuleRef = { name: "AppModule", path: "/app/app.module.ts" };
		const output = graphOutput({
			modules: [
				{
					...appModuleRef,
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
					module: appModuleRef,
					dependencies: [{ token: "ServiceB", optional: false }],
				},
				{
					token: "ServiceB",
					type: "Class",
					module: appModuleRef,
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

		expect(dot).toContain(
			'"AppModule@/app/app.module.ts::ServiceB" -> "AppModule@/app/app.module.ts::ServiceA" [color="#ff0000"',
		);
		expect(dot).toContain(
			'"AppModule@/app/app.module.ts::ServiceA" -> "AppModule@/app/app.module.ts::ServiceB" [color="#ff0000"',
		);
	});

	it("does not color a non-circular edge red", () => {
		const output = graphOutput({
			modules: [
				{
					name: "AppModule",
					path: "/app/app.module.ts",
					imports: [{ name: "OtherModule", path: "/app/other.module.ts" }],
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

		expect(dot).toContain(
			'"OtherModule@/app/other.module.ts" -> "AppModule@/app/app.module.ts" [color="#000"',
		);
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
					module: { name: "AppModule", path: "/app/app.module.ts" },
					dependencies: [],
				},
			],
		});

		const dot = new DotGraphRenderer(output, { showProviders: false }).render();

		expect(dot).not.toContain("AppService");
	});

	it("distinguishes two modules that share a display name via path", () => {
		const output = graphOutput({
			modules: [
				{
					name: "AppModule",
					path: "/app/app.module.ts",
					imports: [
						{ name: "SharedModule", path: "/a/shared.module.ts" },
						{ name: "SharedModule", path: "/b/shared.module.ts" },
					],
					exports: [],
					providers: [],
					isGlobal: false,
				},
				{
					name: "SharedModule",
					path: "/a/shared.module.ts",
					imports: [],
					exports: [],
					providers: [],
					isGlobal: false,
				},
				{
					name: "SharedModule",
					path: "/b/shared.module.ts",
					imports: [],
					exports: [],
					providers: [],
					isGlobal: false,
				},
			],
		});

		const dot = new DotGraphRenderer(output).render();

		// Both same-named modules get their own cluster/node, not one merged node.
		expect(dot).toContain('"SharedModule@/a/shared.module.ts"');
		expect(dot).toContain('"SharedModule@/b/shared.module.ts"');
		expect(dot).toContain(
			'"SharedModule@/a/shared.module.ts" -> "AppModule@/app/app.module.ts"',
		);
		expect(dot).toContain(
			'"SharedModule@/b/shared.module.ts" -> "AppModule@/app/app.module.ts"',
		);
	});
});
