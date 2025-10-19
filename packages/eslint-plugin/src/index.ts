import checkDependencyTypes from "./rules/check-dependency-types";
import noCircularDependencies from "./rules/no-circular-dependencies";
import validProviderConfig from "./rules/valid-provider-config";

/**
 * ESLint plugin for Nexus IoC dependency injection
 */
const plugin = {
	meta: {
		name: "@nexus-ioc/eslint-plugin",
		version: "0.1.0",
	},
	rules: {
		"check-dependency-types": checkDependencyTypes,
		"no-circular-dependencies": noCircularDependencies,
		"valid-provider-config": validProviderConfig,
	},
	configs: {
		recommended: {
			plugins: ["@nexus-ioc"],
			rules: {
				"@nexus-ioc/check-dependency-types": "error",
				"@nexus-ioc/no-circular-dependencies": "error",
				"@nexus-ioc/valid-provider-config": "warn",
			},
		},
		strict: {
			plugins: ["@nexus-ioc"],
			rules: {
				"@nexus-ioc/check-dependency-types": "error",
				"@nexus-ioc/no-circular-dependencies": "error",
				"@nexus-ioc/valid-provider-config": "error",
			},
		},
	},
};

export default plugin;

// Export individual rules for testing
export { checkDependencyTypes, noCircularDependencies, validProviderConfig };
