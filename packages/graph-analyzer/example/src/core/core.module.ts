import { NsModule } from 'nexus-ioc';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './logger/logger.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';

@NsModule({
  imports: [
    ConfigModule,
    LoggerModule,
    DatabaseModule,
    AuthModule
  ],
  exports: [
    ConfigModule,
    LoggerModule,
    DatabaseModule,
    AuthModule
  ]
})
export class CoreModule {}

