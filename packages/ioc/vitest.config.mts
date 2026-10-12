import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["__test__/**/*.spec.ts"],
		exclude: ["__test__/memory-leak.spec.ts"], // Memory leak tests run separately with --expose-gc
		// Type assertions (expectTypeOf) are only checked by tsc. Any new spec that
		// uses expectTypeOf MUST be added to typecheck.include here and to
		// tsconfig.typecheck.jsonc, otherwise its type assertions protect nothing.
		typecheck: {
			enabled: true,
			include: [
				"__test__/children/create-child.spec.ts",
				"__test__/unit/get-resolve.spec.ts",
				"__test__/unit/token-inference.spec.ts",
				"__test__/unit/injection-token.spec.ts",
			],
			tsconfig: "./tsconfig.typecheck.jsonc",
		},
		coverage: {
			provider: "v8",
			reporter: ["json", "json-summary", "text", "lcov", "clover", "html"],
			reportsDirectory: "./coverage",
			exclude: [
				"node_modules/",
				"dist/",
				"__test__/",
				"**/*.config.*",
				"**/*.interface.ts",
				"**/interfaces/**",
				"**/index.ts",
				"**/*.d.ts",
				"**/*.browser.ts",
				"**/*.server.ts",
				"**/browser.ts",
				"**/server.ts",
			],
			thresholds: {
				branches: 80,
				functions: 70,
				lines: 80,
				statements: 80,
			},
		},
		clearMocks: true,
	},
});

