import { NsModule } from 'nexus-ioc';
import { ConfigService } from './config.service';

@NsModule({
  providers: [ConfigService],
  exports: [ConfigService]
})
export class ConfigModule {}

