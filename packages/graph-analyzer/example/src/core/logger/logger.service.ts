import { Injectable, Inject } from 'nexus-ioc';
import { ConfigService } from '../config/config.service';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

@Injectable()
export class LoggerService {
  constructor(@Inject(ConfigService) private configService: ConfigService) {}

  private log(level: LogLevel, message: string, context?: string): void {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    console.log(`${timestamp} [${level.toUpperCase()}] ${contextStr} ${message}`);
  }

  debug(message: string, context?: string): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: string): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: string): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, trace?: string, context?: string): void {
    this.log(LogLevel.ERROR, message, context);
    if (trace) {
      console.error(trace);
    }
  }
}

