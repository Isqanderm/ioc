import { NsModule } from "@nexus-ioc/core";
import { DatabaseService } from "./database.service";
import { LoggerService } from "./logger.service";
import { PostService } from "./post.service";
import { UserModule } from "./user.module";

/**
 * Post module that imports UserModule
 *
 * This demonstrates:
 * - Importing other modules to access their exported providers
 * - PostService can inject UserService because UserModule exports it
 */
@NsModule({
	imports: [UserModule],
	providers: [PostService, DatabaseService, LoggerService],
	exports: [PostService],
})
export class PostModule {}
