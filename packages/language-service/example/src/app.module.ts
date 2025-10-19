import { NsModule } from "@nexus-ioc/core";
import { UserModule } from "./user.module";
import { PostModule } from "./post.module";
import { ConfigService, type DatabaseConfig } from "./config.service";

/**
 * Root application module
 * 
 * This demonstrates:
 * - Importing multiple modules
 * - Providing string tokens with useValue
 * - Complex module composition
 */
@NsModule({
	imports: [UserModule, PostModule],
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

