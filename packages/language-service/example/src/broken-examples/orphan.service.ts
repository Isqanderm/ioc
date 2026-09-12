import { Inject, Injectable } from "@nexus-ioc/core";
import { DatabaseService } from "../database.service";

/**
 * This service demonstrates an ORPHAN SERVICE error
 *
 * Expected Error:
 * - Red squiggly under @Inject(DatabaseService)
 * - Message: "Class 'OrphanService' is missing dependency: DatabaseService"
 *
 * Why:
 * - OrphanService is NOT added to any module's providers array
 * - Therefore, it's not connected to the dependency injection system
 * - The plugin can't find which module this service belongs to
 * - So it reports that dependencies are missing
 *
 * How to fix:
 * - Add OrphanService to a module's providers array (e.g., AppModule)
 * - Make sure that module also provides or imports DatabaseService
 */
@Injectable()
export class OrphanService {
	constructor(
		// ERROR: OrphanService is not in any module, so it can't access dependencies
		@Inject(DatabaseService) private db: DatabaseService,
	) {}

	async getData(): Promise<unknown[]> {
		return this.db.query("SELECT * FROM data");
	}
}
