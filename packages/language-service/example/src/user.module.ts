import { NsModule } from "@nexus-ioc/core";
import { DatabaseService } from "./database.service";
import { LoggerService } from "./logger.service";
import { UserService } from "./user.service";

/**
 * User module that provides and exports UserService
 *
 * This demonstrates:
 * - Module with providers array
 * - Exporting services to make them available to other modules
 */
@NsModule({
	providers: [UserService, DatabaseService, LoggerService],
	exports: [UserService],
})
export class UserModule {}
