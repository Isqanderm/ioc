import { NsModule } from 'nexus-ioc';
import { ConfigModule } from '../../core/config/config.module';
import { LoggerModule } from '../../core/logger/logger.module';
import { StorageService } from './storage.service';

@NsModule({
  imports: [ConfigModule, LoggerModule],
  providers: [StorageService],
  exports: [StorageService]
})
export class StorageModule {}

