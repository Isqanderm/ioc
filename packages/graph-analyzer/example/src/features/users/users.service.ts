import { Injectable, Inject } from 'nexus-ioc';
import { UserRepository, User, CreateUserDto, UpdateUserDto } from './user.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { EmailService } from '../../shared/email/email.service';
import { StorageService, UploadedFile } from '../../shared/storage/storage.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject(UserRepository) private userRepository: UserRepository,
    @Inject(EmailService) private emailService: EmailService,
    @Inject(StorageService) private storageService: StorageService,
    @Inject(LoggerService) private logger: LoggerService
  ) {}

  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async createUser(data: CreateUserDto): Promise<User> {
    const user = await this.userRepository.create(data);
    
    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email, user.name);
    
    this.logger.info(`User created successfully: ${user.id}`, 'UsersService');
    
    return user;
  }

  async updateUser(id: string, data: UpdateUserDto): Promise<User | null> {
    const user = await this.userRepository.update(id, data);
    
    if (user) {
      this.logger.info(`User updated successfully: ${id}`, 'UsersService');
    }
    
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const deleted = await this.userRepository.delete(id);
    
    if (deleted) {
      this.logger.info(`User deleted successfully: ${id}`, 'UsersService');
    }
    
    return deleted;
  }

  async listUsers(limit?: number, offset?: number): Promise<User[]> {
    return this.userRepository.list(limit, offset);
  }

  async uploadAvatar(
    userId: string,
    file: { filename: string; mimetype: string; size: number; buffer: Buffer }
  ): Promise<UploadedFile> {
    this.logger.info(`Uploading avatar for user: ${userId}`, 'UsersService');

    const uploadedFile = await this.storageService.upload(file, {
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    });

    // Update user avatar URL
    await this.userRepository.update(userId, {
      avatar: uploadedFile.url
    });

    return uploadedFile;
  }

  async getUserStats(userId: string): Promise<{
    postsCount: number;
    commentsCount: number;
    followersCount: number;
  }> {
    this.logger.debug(`Getting stats for user: ${userId}`, 'UsersService');

    // Simulate stats retrieval
    return {
      postsCount: 0,
      commentsCount: 0,
      followersCount: 0
    };
  }
}

