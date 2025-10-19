import "reflect-metadata";
import { NexusApplicationsServer } from "@nexus-ioc/core";
import { AppModule } from "./app.module";

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
	const app = await NexusApplicationsServer.create(AppModule).bootstrap();
	console.log("Application started successfully!");
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

