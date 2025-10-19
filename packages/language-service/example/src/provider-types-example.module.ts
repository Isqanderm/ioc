import { NsModule } from "@nexus-ioc/core";
import {
	DatabaseService,
	MockDatabaseService,
	ConfigService,
	LoggerService,
	ServiceUsingClassProvider,
	ServiceUsingUseClassProvider,
	ServiceUsingUseValueString,
	ServiceUsingUseValueNumber,
	ServiceUsingUseValueObject,
	ServiceUsingUseFactoryNoInject,
	ServiceUsingUseFactoryStringInject,
	ServiceUsingUseFactoryClassInject,
	ServiceUsingUseFactoryMixedInject,
} from "./provider-types-example.service";

/**
 * Example module demonstrating all provider types
 *
 * This module shows how to configure different types of providers:
 * 1. Class providers (shorthand) - just list the class
 * 2. useClass providers - provide a different implementation
 * 3. useValue providers - provide static values
 * 4. useFactory providers - provide values from factory functions
 */
@NsModule({
	providers: [
		// ============================================================================
		// Class Providers (Shorthand)
		// ============================================================================
		// These are the simplest form - just list the class in the providers array
		DatabaseService,
		ConfigService,
		LoggerService,
		MockDatabaseService,

		// ============================================================================
		// useClass Providers
		// ============================================================================
		// Use a different class implementation for a token
		// Useful for testing (provide mock instead of real service)
		{
			provide: "DB_SERVICE",
			useClass: MockDatabaseService,
		},

		// ============================================================================
		// useValue Providers
		// ============================================================================
		// Provide static values that don't need instantiation

		// String value
		{
			provide: "API_KEY",
			useValue: "secret-key-123",
		},

		// Number value
		{
			provide: "PORT",
			useValue: 3000,
		},

		// Object value
		{
			provide: "CONFIG",
			useValue: { debug: true, timeout: 5000 },
		},

		// ============================================================================
		// useFactory Providers
		// ============================================================================
		// Provide values from factory functions

		// Factory without dependencies
		{
			provide: "TIMESTAMP",
			useFactory: (): number => Date.now(),
		},

		// Factory with string token dependencies
		{
			provide: "DATABASE_CONNECTION",
			useFactory: (apiKey: string, port: number) => {
				return { apiKey, port, connected: true };
			},
			inject: ["API_KEY", "PORT"],
		},

		// Factory with class dependencies
		{
			provide: "LOGGER_WITH_CONFIG",
			useFactory: (config: ConfigService, logger: LoggerService) => {
				return { config, logger };
			},
			inject: [ConfigService, LoggerService],
		},

		// Factory with mixed dependencies (string tokens + classes)
		{
			provide: "MIXED_FACTORY",
			useFactory: (apiKey: string, db: DatabaseService) => {
				return { apiKey, db };
			},
			inject: ["API_KEY", DatabaseService],
		},

		// ============================================================================
		// Services Using the Providers
		// ============================================================================
		ServiceUsingClassProvider,
		ServiceUsingUseClassProvider,
		ServiceUsingUseValueString,
		ServiceUsingUseValueNumber,
		ServiceUsingUseValueObject,
		ServiceUsingUseFactoryNoInject,
		ServiceUsingUseFactoryStringInject,
		ServiceUsingUseFactoryClassInject,
		ServiceUsingUseFactoryMixedInject,
	],
	exports: [
		// Export all providers so they can be used in other modules
		DatabaseService,
		ConfigService,
		LoggerService,
		MockDatabaseService,
		"DB_SERVICE",
		"API_KEY",
		"PORT",
		"CONFIG",
		"TIMESTAMP",
		"DATABASE_CONNECTION",
		"LOGGER_WITH_CONFIG",
		"MIXED_FACTORY",
		ServiceUsingClassProvider,
		ServiceUsingUseClassProvider,
		ServiceUsingUseValueString,
		ServiceUsingUseValueNumber,
		ServiceUsingUseValueObject,
		ServiceUsingUseFactoryNoInject,
		ServiceUsingUseFactoryStringInject,
		ServiceUsingUseFactoryClassInject,
		ServiceUsingUseFactoryMixedInject,
	],
})
export class ProviderTypesExampleModule {}

