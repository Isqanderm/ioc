import { NsModule } from "@nexus-ioc/core";
import { UserModule } from "./user.module";
import { PostModule } from "./post.module";
import { OptionalExampleModule } from "./optional-example.module";
import { FeatureWithGlobalDepsModule } from "./feature-with-global-deps.module";
import { GlobalConfigModule } from "./global-config.module";
import { GlobalLoggerModule } from "./global-logger.module";
import { PropertyInjectionModule } from "./property-injection.module";
import { ConfigService, type DatabaseConfig } from "./config.service";

/**
 * Root application module
 *
 * This demonstrates:
 * - Importing multiple modules
 * - Providing string tokens with useValue
 * - Complex module composition
 * - Optional dependencies (via OptionalExampleModule)
 * - Global modules (GlobalConfigModule, GlobalLoggerModule)
 * - Property injection (via PropertyInjectionModule)
 */
@NsModule({
	imports: [
		GlobalConfigModule,
		GlobalLoggerModule,
		UserModule,
		PostModule,
		OptionalExampleModule,
		FeatureWithGlobalDepsModule,
		PropertyInjectionModule,
	],
	providers: [
		ConfigService,
		{
			provide: "API_KEY",
			useValue: "secret-api-key-12345",
		},
		{
			provide: "DATABASE_CONFIG",
			useValue: {
				host: "localhost",
				port: 5432,
				database: "myapp",
				username: "admin",
				password: "password",
			} as DatabaseConfig,
		},
	],
})
export class AppModule {}

