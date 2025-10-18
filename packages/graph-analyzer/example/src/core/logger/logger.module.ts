import { NsModule } from 'nexus-ioc';
import { ConfigModule } from '../config/config.module';
import { LoggerService } from './logger.service';

@NsModule({
  imports: [ConfigModule],
  providers: [LoggerService],
  exports: [LoggerService]
})
export class LoggerModule {}

