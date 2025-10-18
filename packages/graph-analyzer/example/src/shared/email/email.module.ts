import { NsModule } from 'nexus-ioc';
import { ConfigModule } from '../../core/config/config.module';
import { LoggerModule } from '../../core/logger/logger.module';
import { EmailService } from './email.service';

@NsModule({
  imports: [ConfigModule, LoggerModule],
  providers: [EmailService],
  exports: [EmailService]
})
export class EmailModule {}

