import { Inject, Injectable } from "@nexus-ioc/core";
import { DatabaseService } from "./database.service";

/**
 * Service for testing type mismatch detection
 *
 * This file intentionally has type mismatches to test the language service plugin.
 * The plugin should show errors for these mismatches.
 */
@Injectable()
export class TypeMismatchTestService {
	/**
	 * Constructor type mismatch: DatabaseService is not assignable to string
	 * Should show error: TS9999: Type mismatch for dependency 'DatabaseService'
	 */
	constructor(
		@Inject(DatabaseService) _db: string, // ❌ Type mismatch!
	) {}
}
