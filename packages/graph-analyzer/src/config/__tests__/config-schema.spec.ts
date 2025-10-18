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
				format: "json",
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

		it("should reject invalid format", () => {
			const config = {
				format: "invalid",
			};

			const errors = validateConfig(config);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("Invalid format");
		});

		it("should accept valid formats", () => {
			const formats = ["json", "png", "html", "both"];

			for (const format of formats) {
				const config = { format };
				const errors = validateConfig(config);
				expect(errors).toEqual([]);
			}
		});

		it("should reject invalid ideProtocol", () => {
			const config = {
				ideProtocol: "invalid",
			};

			const errors = validateConfig(config);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("Invalid ideProtocol");
		});

		it("should accept valid ideProtocols", () => {
			const protocols = ["vscode", "webstorm", "idea"];

			for (const ideProtocol of protocols) {
				const config = { ideProtocol };
				const errors = validateConfig(config);
				expect(errors).toEqual([]);
			}
		});

		it("should reject non-boolean darkTheme", () => {
			const config = {
				darkTheme: "true",
			};

			const errors = validateConfig(config);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain("darkTheme must be a boolean");
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

		it("should collect multiple errors", () => {
			const config = {
				format: "invalid",
				ideProtocol: "bad",
				verbose: "not-boolean",
			};

			const errors = validateConfig(config);
			expect(errors.length).toBeGreaterThan(1);
		});
	});

	describe("mergeConfigs", () => {
		it("should merge multiple configurations", () => {
			const config1 = {
				entryFile: "src/main.ts",
				format: "json" as const,
			};

			const config2 = {
				format: "png" as const,
				verbose: true,
			};

			const merged = mergeConfigs(config1, config2);

			expect(merged).toEqual({
				entryFile: "src/main.ts",
				format: "png",
				verbose: true,
			});
		});

		it("should give priority to later configurations", () => {
			const config1 = {
				format: "json" as const,
				verbose: false,
			};

			const config2 = {
				format: "png" as const,
			};

			const config3 = {
				verbose: true,
			};

			const merged = mergeConfigs(config1, config2, config3);

			expect(merged.format).toBe("png");
			expect(merged.verbose).toBe(true);
		});

		it("should skip undefined values", () => {
			const config1 = {
				entryFile: "src/main.ts",
				format: "json" as const,
			};

			const config2 = {
				format: undefined,
				verbose: true,
			};

			const merged = mergeConfigs(config1, config2);

			expect(merged.format).toBe("json");
			expect(merged.verbose).toBe(true);
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
			expect(merged.format).toBe("both");
			expect(merged.ideProtocol).toBe("vscode");
		});
	});

	describe("DEFAULT_CONFIG", () => {
		it("should have expected default values", () => {
			expect(DEFAULT_CONFIG.format).toBe("both");
			expect(DEFAULT_CONFIG.ideProtocol).toBe("vscode");
			expect(DEFAULT_CONFIG.darkTheme).toBe(false);
			expect(DEFAULT_CONFIG.verbose).toBe(false);
			expect(DEFAULT_CONFIG.quiet).toBe(false);
		});
	});
});
