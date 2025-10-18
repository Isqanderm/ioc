import { Injectable } from 'nexus-ioc';

export interface AppConfig {
  port: number;
  host: string;
  database: {
    host: string;
    port: number;
    name: string;
  };
  redis: {
    host: string;
    port: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  email: {
    host: string;
    port: number;
    user: string;
  };
}

@Injectable()
export class ConfigService {
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): AppConfig {
    return {
      port: 3000,
      host: 'localhost',
      database: {
        host: 'localhost',
        port: 5432,
        name: 'blog_db'
      },
      redis: {
        host: 'localhost',
        port: 6379
      },
      jwt: {
        secret: 'super-secret-key',
        expiresIn: '7d'
      },
      email: {
        host: 'smtp.gmail.com',
        port: 587,
        user: 'noreply@example.com'
      }
    };
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  getAll(): AppConfig {
    return this.config;
  }
}

