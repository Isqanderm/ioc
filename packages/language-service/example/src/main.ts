import "reflect-metadata";
import { NexusApplications } from "@nexus-ioc/core";
import { AppModule } from "./app.module";
import { OptionalDependenciesService } from "./optional-dependencies.service";
import { FeatureWithGlobalDepsService } from "./feature-with-global-deps.service";
import { GlobalLoggerService } from "./global-logger.service";
import { PropertyInjectionService } from "./property-injection.service";
import { OptionalPropertyInjectionService } from "./optional-property-injection.service";

/**
 * Main entry point for the example application
 *
 * This file is not used for testing the Language Service Plugin,
 * but it demonstrates how the application would be bootstrapped.
 *
 * To test the plugin:
 * 1. Open any .ts file in your IDE
 * 2. Try the features described in README.md
 */
async function bootstrap() {
	const app = await NexusApplications.create(AppModule).bootstrap();
	console.log("Application started successfully!");

	// Demonstrate optional dependencies
	const optionalService = await app.get(OptionalDependenciesService) as OptionalDependenciesService;
	console.log("Optional service status:", optionalService.getStatus());
	optionalService.performOperation("test-data");

	// Demonstrate global modules
	const globalLogger = await app.get(GlobalLoggerService) as GlobalLoggerService;
	globalLogger.log("Testing global logger service");

	const featureService = await app.get(FeatureWithGlobalDepsService) as FeatureWithGlobalDepsService;
	const config = featureService.getConfiguration();
	console.log("Configuration from global module:", config);

	const data = await featureService.fetchData();
	console.log("Fetched data:", data);

	// Demonstrate property injection
	const propertyService = await app.get(PropertyInjectionService) as PropertyInjectionService;
	console.log("\nProperty Injection Service:");
	console.log(propertyService.getInjectionInfo());
	const fetchedData = await propertyService.fetchData();
	console.log("Fetched data:", fetchedData);

	const optionalPropertyService = await app.get(OptionalPropertyInjectionService) as OptionalPropertyInjectionService;
	console.log("\nOptional Property Injection Service:");
	console.log(optionalPropertyService.getStatus());
	const processedData = await optionalPropertyService.processData("test-key", "test-value");
	console.log("Processed data:", processedData);

	console.log("\nAll logs:");
	console.log(globalLogger.getLogs());

	return app;
}

// Only run if this file is executed directly
if (require.main === module) {
	bootstrap().catch((error) => {
		console.error("Failed to start application:", error);
		process.exit(1);
	});
}

export { bootstrap };
