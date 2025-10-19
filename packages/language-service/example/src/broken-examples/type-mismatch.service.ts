import { Inject, Injectable } from "@nexus-ioc/core";
import { LoggerService } from "../logger.service";

/**
 * This service demonstrates a TYPE MISMATCH error
 *
 * Expected Error:
 * - Red squiggly under the wrongTypeLogger parameter
 * - Message: "Type mismatch for dependency 'LoggerService'"
 * - Related info: "Module: AppModule"
 *
 * Why:
 * - The parameter is typed as 'string'
 * - But LoggerService is a class, not a string
 * - The plugin detects this type mismatch
 *
 * How to fix:
 * - Change the parameter type from 'string' to 'LoggerService'
 */
@Injectable()
export class TypeMismatchService {
	constructor(
		// ERROR: Type mismatch - LoggerService is a class, not a string
		@Inject(LoggerService) private wrongTypeLogger: string,
	) {}

	test(): void {
		// This would fail at runtime because wrongTypeLogger is actually a LoggerService instance
		// biome-ignore lint/suspicious/noExplicitAny: demonstrating type mismatch
		(this.wrongTypeLogger as any).log("This is wrong!");
	}
}
