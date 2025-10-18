import { NsModule } from 'nexus-ioc';
import { DatabaseModule } from '../../core/database/database.module';
import { LoggerModule } from '../../core/logger/logger.module';
import { CacheModule } from '../../shared/cache/cache.module';
import { CategoryRepository } from './category.repository';
import { CategoriesService } from './categories.service';

@NsModule({
  imports: [
    DatabaseModule,
    LoggerModule,
    CacheModule
  ],
  providers: [CategoryRepository, CategoriesService],
  exports: [CategoriesService]
})
export class CategoriesModule {}

