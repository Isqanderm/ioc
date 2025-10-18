import { NsModule } from 'nexus-ioc';
import { CacheModule } from './cache/cache.module';
import { EmailModule } from './email/email.module';
import { StorageModule } from './storage/storage.module';

@NsModule({
  imports: [
    CacheModule,
    EmailModule,
    StorageModule
  ],
  exports: [
    CacheModule,
    EmailModule,
    StorageModule
  ]
})
export class SharedModule {}

