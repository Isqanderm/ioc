import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Enable globals like describe, it, expect without imports
		globals: true,
		
		// Clear mocks before each test
		clearMocks: true,
		
		// Coverage configuration
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'__test__/',
				'dist/',
				'*.config.ts',
				'example/',
			],
		},
		
		// Test environment
		environment: 'node',
		
		// Include test files
		include: ['__test__/**/*.{test,spec}.ts'],
		
		// TypeScript configuration
		typecheck: {
			tsconfig: './tsconfig.test.json',
		},
	},
});

