import { NsModule } from 'nexus-ioc';
import { ConfigModule } from '../config/config.module';
import { LoggerModule } from '../logger/logger.module';
import { AuthService } from './auth.service';
import { JwtService } from './jwt.service';
import { PasswordService } from './password.service';

@NsModule({
  imports: [ConfigModule, LoggerModule],
  providers: [AuthService, JwtService, PasswordService],
  exports: [AuthService, JwtService]
})
export class AuthModule {}

