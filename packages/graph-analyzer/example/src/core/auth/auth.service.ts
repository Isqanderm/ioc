import { Injectable, Inject } from 'nexus-ioc';
import { JwtService, JwtPayload, TokenPair } from './jwt.service';
import { PasswordService } from './password.service';
import { LoggerService } from '../logger/logger.service';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface AuthResult {
  success: boolean;
  tokens?: TokenPair;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  error?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(JwtService) private jwtService: JwtService,
    @Inject(PasswordService) private passwordService: PasswordService,
    @Inject(LoggerService) private logger: LoggerService
  ) {}

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    this.logger.info(`Login attempt for ${credentials.email}`, 'AuthService');

    // Simulate user lookup and password verification
    const user = {
      id: '123',
      email: credentials.email,
      name: 'John Doe',
      passwordHash: await this.passwordService.hash(credentials.password),
      roles: ['user']
    };

    const isValid = await this.passwordService.compare(
      credentials.password,
      user.passwordHash
    );

    if (!isValid) {
      this.logger.warn(`Failed login attempt for ${credentials.email}`, 'AuthService');
      return {
        success: false,
        error: 'Invalid credentials'
      };
    }

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      roles: user.roles
    };

    const tokens = this.jwtService.generateTokenPair(payload);

    this.logger.info(`Successful login for ${credentials.email}`, 'AuthService');

    return {
      success: true,
      tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }

  async register(data: RegisterData): Promise<AuthResult> {
    this.logger.info(`Registration attempt for ${data.email}`, 'AuthService');

    // Validate password
    const validation = this.passwordService.validate(data.password);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', ')
      };
    }

    // Simulate user creation
    const passwordHash = await this.passwordService.hash(data.password);
    const user = {
      id: Date.now().toString(),
      email: data.email,
      name: data.name,
      passwordHash,
      roles: ['user']
    };

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      roles: user.roles
    };

    const tokens = this.jwtService.generateTokenPair(payload);

    this.logger.info(`Successful registration for ${data.email}`, 'AuthService');

    return {
      success: true,
      tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }

  async validateToken(token: string): Promise<JwtPayload | null> {
    return this.jwtService.verify(token);
  }
}

