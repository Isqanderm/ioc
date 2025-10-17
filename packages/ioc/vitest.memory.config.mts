import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["__test__/memory-leak.spec.ts"],
		// Disable parallelization for memory tests to get accurate measurements
		pool: "forks",
		poolOptions: {
			forks: {
				singleFork: true,
				// Pass --expose-gc to worker processes
				execArgv: ["--expose-gc"],
			},
		},
		// Increase timeout for memory tests
		testTimeout: 60000,
		// Disable coverage for memory tests
		coverage: {
			enabled: false,
		},
		clearMocks: true,
	},
});

