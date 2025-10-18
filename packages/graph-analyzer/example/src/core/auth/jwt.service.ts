import { Injectable, Inject } from 'nexus-ioc';
import { ConfigService } from '../config/config.service';
import { LoggerService } from '../logger/logger.service';

export interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class JwtService {
  constructor(
    @Inject(ConfigService) private configService: ConfigService,
    @Inject(LoggerService) private logger: LoggerService
  ) {}

  sign(payload: JwtPayload): string {
    const jwtConfig = this.configService.get('jwt');
    this.logger.debug(`Signing JWT for user ${payload.userId}`, 'JwtService');

    // Simulate JWT signing
    return `jwt.${Buffer.from(JSON.stringify(payload)).toString('base64')}.signature`;
  }

  verify(token: string): JwtPayload | null {
    try {
      this.logger.debug('Verifying JWT token', 'JwtService');

      // Simulate JWT verification
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload as JwtPayload;
    } catch (error) {
      this.logger.error('JWT verification failed', error.message, 'JwtService');
      return null;
    }
  }

  generateTokenPair(payload: JwtPayload): TokenPair {
    return {
      accessToken: this.sign(payload),
      refreshToken: this.sign({ ...payload, type: 'refresh' })
    };
  }
}

