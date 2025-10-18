import { NsModule } from 'nexus-ioc';
import { DatabaseModule } from '../../core/database/database.module';
import { LoggerModule } from '../../core/logger/logger.module';
import { CacheModule } from '../../shared/cache/cache.module';
import { UsersModule } from '../users/users.module';
import { PostRepository } from './post.repository';
import { PostsService } from './posts.service';

@NsModule({
  imports: [
    DatabaseModule,
    LoggerModule,
    CacheModule,
    UsersModule
  ],
  providers: [PostRepository, PostsService],
  exports: [PostsService, PostRepository]
})
export class PostsModule {}

