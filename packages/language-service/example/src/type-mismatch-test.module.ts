import { Inject, Injectable, NsModule } from "@nexus-ioc/core";
import { DatabaseService } from "./database.service";
import { TypeMismatchTestService } from "./type-mismatch-test.service";

/**
 * Test service that expects a string
 */
@Injectable()
export class ServiceExpectingString {
	constructor(@Inject("CONFIG_VALUE") _config: string) {}
}

/**
 * Test service that expects a number
 */
@Injectable()
export class ServiceExpectingNumber {
	constructor(@Inject("PORT") _port: number) {}
}

/**
 * Test service that expects an object
 */
@Injectable()
export class ServiceExpectingObject {
	constructor(@Inject("DB_CONFIG") _dbConfig: { host: string; port: number }) {}
}

/**
 * Test module with intentional type mismatches
 *
 * This module should show type mismatch errors:
 * - CONFIG_VALUE is provided as number but expected as string
 * - PORT is provided as string but expected as number
 * - DB_CONFIG is provided as string but expected as object
 */
@NsModule({
	providers: [
		// Type mismatch: providing number instead of string
		{
			provide: "CONFIG_VALUE",
			useValue: 12345, // Should be string, but is number
		},
		// Type mismatch: providing string instead of number
		{
			provide: "PORT",
			useValue: "3000", // Should be number, but is string
		},
		// Type mismatch: providing string instead of object
		{
			provide: "DB_CONFIG",
			useValue: "localhost:5432", // Should be object, but is string
		},
		DatabaseService,
		TypeMismatchTestService,
		ServiceExpectingString,
		ServiceExpectingNumber,
		ServiceExpectingObject,
	],
})
export class TypeMismatchTestModule {}
