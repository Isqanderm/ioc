import { NsModule } from "nexus-ioc";
import { DatabaseModule } from "../../core/database/database.module";
import { LoggerModule } from "../../core/logger/logger.module";
import { CacheModule } from "../../shared/cache/cache.module";
import { CategoriesService } from "./categories.service";
import { CategoryRepository } from "./category.repository";

@NsModule({
	imports: [DatabaseModule, LoggerModule, CacheModule],
	providers: [CategoryRepository, CategoriesService],
	exports: [CategoriesService],
})
export class CategoriesModule {}
