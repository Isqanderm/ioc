import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["__test__/**/*.spec.ts"],
		// Type assertions (expectTypeOf) are only checked by tsc. Any new spec that
		// uses expectTypeOf MUST be added to typecheck.include here and to
		// tsconfig.typecheck.jsonc, otherwise its type assertions protect nothing.
		typecheck: {
			enabled: true,
			include: [
				"__test__/get-resolve.spec.ts",
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
			],
			thresholds: {
				branches: 90,
				functions: 60,
				lines: 75,
				statements: 75,
			},
		},
		clearMocks: true,
	},
});

