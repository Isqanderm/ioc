import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    // Test environment (node is default for Vitest)
    environment: 'node',

    // Enable global test APIs (describe, it, expect, etc.) without imports
    globals: true,

    // Automatically clear mock calls, instances, and results before every test
    clearMocks: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.spec.ts',
        '**/*.test.ts',
        '__tests__/',
        'example/**',
        'vitest.config.ts',
        'src/index.ts',
        'src/cli.ts',
        // Standalone scripts and examples
        'src/parser/parser.ts',
        'src/parser/parser-rec.ts',
        // Type definitions and interfaces
        'src/parser/rules.ts',
        'src/parser/parse-provider.ts',
        'src/interfaces/**/*.ts',
      ],
    },

    // Test file patterns
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules/', 'dist/'],

    // Global test timeout
    testTimeout: 10000,
  },

  resolve: {
    alias: {
      // Add any path aliases if needed
    },
  },
});

