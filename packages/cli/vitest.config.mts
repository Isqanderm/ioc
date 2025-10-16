import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["__test__/**/*.spec.ts"],
		coverage: {
			provider: "v8",
			reporter: ["json", "text", "lcov", "clover", "html"],
			reportsDirectory: "./coverage",
			exclude: ["node_modules/", "dist/", "__test__/"],
		},
		clearMocks: true,
	},
});

