import { Injectable, Inject } from 'nexus-ioc';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class PasswordService {
  constructor(@Inject(LoggerService) private logger: LoggerService) {}

  async hash(password: string): Promise<string> {
    this.logger.debug('Hashing password', 'PasswordService');
    
    // Simulate password hashing (bcrypt)
    return `$2b$10$${Buffer.from(password).toString('base64')}`;
  }

  async compare(password: string, hash: string): Promise<boolean> {
    this.logger.debug('Comparing password with hash', 'PasswordService');
    
    // Simulate password comparison
    const expectedHash = await this.hash(password);
    return expectedHash === hash;
  }

  validate(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

