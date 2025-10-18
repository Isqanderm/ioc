import { Injectable, Inject } from 'nexus-ioc';
import { DatabaseService } from '../../core/database/database.service';
import { LoggerService } from '../../core/logger/logger.service';
import { CacheService } from '../../shared/cache/cache.service';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  email: string;
  name: string;
  passwordHash: string;
}

export interface UpdateUserDto {
  name?: string;
  avatar?: string;
  bio?: string;
}

@Injectable()
export class UserRepository {
  constructor(
    @Inject(DatabaseService) private database: DatabaseService,
    // INTENTIONALLY MISSING @Inject decorator for error detection demo
    private cache: CacheService,
    @Inject(LoggerService) private logger: LoggerService
  ) {}

  async findById(id: string): Promise<User | null> {
    // Try cache first
    const cached = await this.cache.get<User>(`user:${id}`);
    if (cached) {
      return cached;
    }

    this.logger.debug(`Finding user by id: ${id}`, 'UserRepository');
    
    const users = await this.database.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    const user = users[0] || null;
    
    if (user) {
      await this.cache.set(`user:${id}`, user, { ttl: 300 });
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    this.logger.debug(`Finding user by email: ${email}`, 'UserRepository');
    
    const users = await this.database.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    return users[0] || null;
  }

  async create(data: CreateUserDto): Promise<User> {
    this.logger.info(`Creating user: ${data.email}`, 'UserRepository');
    
    const user: User = {
      id: Date.now().toString(),
      email: data.email,
      name: data.name,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.database.query(
      'INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)',
      [user.id, data.email, data.name, data.passwordHash]
    );

    return user;
  }

  async update(id: string, data: UpdateUserDto): Promise<User | null> {
    this.logger.info(`Updating user: ${id}`, 'UserRepository');
    
    const user = await this.findById(id);
    if (!user) {
      return null;
    }

    const updated: User = {
      ...user,
      ...data,
      updatedAt: new Date()
    };

    await this.database.query(
      'UPDATE users SET name = $1, avatar = $2, bio = $3, updated_at = $4 WHERE id = $5',
      [updated.name, updated.avatar, updated.bio, updated.updatedAt, id]
    );

    // Invalidate cache
    await this.cache.delete(`user:${id}`);

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    this.logger.info(`Deleting user: ${id}`, 'UserRepository');
    
    await this.database.query('DELETE FROM users WHERE id = $1', [id]);
    await this.cache.delete(`user:${id}`);

    return true;
  }

  async list(limit: number = 10, offset: number = 0): Promise<User[]> {
    this.logger.debug(`Listing users (limit: ${limit}, offset: ${offset})`, 'UserRepository');
    
    return this.database.query<User>(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
  }
}

