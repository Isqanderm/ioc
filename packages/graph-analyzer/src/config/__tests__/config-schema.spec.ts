import { describe, expect, it } from "vitest";
import {
	DEFAULT_CONFIG,
	type GraphAnalyzerConfig,
	mergeConfigs,
	validateConfig,
} from "../config-schema";

describe("Config Schema", () => {
	describe("validateConfig", () => {
		it("should validate a valid configuration", () => {
			const config: GraphAnalyzerConfig = {
				entryFile: "src/main.ts",
				verbose: true,
			};

			const errors = validateConfig(config);
			expect(errors).toEqual([]);
		});

		it("should reject non-object configuration", () => {
			const errors = validateConfig("not an object");
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("must be an object");
		});

		it("should reject null configuration", () => {
			const errors = validateConfig(null);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("must be an object");
		});

		it("should reject non-boolean verbose", () => {
			const config = {
				verbose: "yes",
			};

			const errors = validateConfig(config);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("verbose must be a boolean");
		});

		it("should reject non-boolean quiet", () => {
			const config = {
				quiet: 1,
			};

			const errors = validateConfig(config);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("quiet must be a boolean");
		});

		it("should reject non-string entryFile", () => {
			const config = {
				entryFile: 123,
			};

			const errors = validateConfig(config);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("entryFile must be a string");
		});

		it("should reject non-string tsConfig", () => {
			const config = {
				tsConfig: true,
			};

			const errors = validateConfig(config);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("tsConfig must be a string");
		});

		it("should reject non-string output", () => {
			const config = {
				output: [],
			};

			const errors = validateConfig(config);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("output must be a string");
		});

		it("should reject non-positive deepModuleThreshold", () => {
			const config = {
				deepModuleThreshold: 0,
			};

			const errors = validateConfig(config);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain(
				"deepModuleThreshold must be a positive number",
			);
		});

		it("should collect multiple errors", () => {
			const config = {
				verbose: "not-boolean",
				quiet: "not-boolean",
			};

			const errors = validateConfig(config);
			expect(errors.length).toBeGreaterThan(1);
		});
	});

	describe("mergeConfigs", () => {
		it("should merge multiple configurations", () => {
			const config1 = {
				entryFile: "src/main.ts",
				verbose: false,
			};

			const config2 = {
				verbose: true,
			};

			const merged = mergeConfigs(config1, config2);

			expect(merged).toEqual({
				entryFile: "src/main.ts",
				verbose: true,
			});
		});

		it("should give priority to later configurations", () => {
			const config1 = {
				verbose: false,
				checkCircular: false,
			};

			const config2 = {
				checkCircular: true,
			};

			const config3 = {
				verbose: true,
			};

			const merged = mergeConfigs(config1, config2, config3);

			expect(merged.checkCircular).toBe(true);
			expect(merged.verbose).toBe(true);
		});

		it("should skip undefined values", () => {
			const config1 = {
				entryFile: "src/main.ts",
				verbose: false,
			};

			const config2 = {
				verbose: undefined,
			};

			const merged = mergeConfigs(config1, config2);

			expect(merged.entryFile).toBe("src/main.ts");
			expect(merged.verbose).toBe(false);
		});

		it("should handle empty configurations", () => {
			const merged = mergeConfigs({}, {}, {});
			expect(merged).toEqual({});
		});

		it("should merge with default config", () => {
			const userConfig = {
				entryFile: "src/app.ts",
			};

			const merged = mergeConfigs(DEFAULT_CONFIG, userConfig);

			expect(merged.entryFile).toBe("src/app.ts");
			expect(merged.deepModuleThreshold).toBe(5);
		});
	});

	describe("DEFAULT_CONFIG", () => {
		it("should have expected default values", () => {
			expect(DEFAULT_CONFIG.verbose).toBe(false);
			expect(DEFAULT_CONFIG.quiet).toBe(false);
			expect(DEFAULT_CONFIG.checkCircular).toBe(false);
			expect(DEFAULT_CONFIG.checkUnused).toBe(false);
			expect(DEFAULT_CONFIG.checkDepth).toBe(false);
			expect(DEFAULT_CONFIG.deepModuleThreshold).toBe(5);
			expect(DEFAULT_CONFIG.checkScope).toBe(false);
		});
	});
});
