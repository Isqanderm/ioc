import { NsModule } from 'nexus-ioc';
import { DatabaseModule } from '../../core/database/database.module';
import { LoggerModule } from '../../core/logger/logger.module';
import { CacheModule } from '../../shared/cache/cache.module';
import { EmailModule } from '../../shared/email/email.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { UserRepository } from './user.repository';
import { UsersService } from './users.service';

@NsModule({
  imports: [
    DatabaseModule,
    LoggerModule,
    CacheModule,
    EmailModule,
    StorageModule
  ],
  providers: [UserRepository, UsersService],
  exports: [UsersService, UserRepository]
})
export class UsersModule {}

