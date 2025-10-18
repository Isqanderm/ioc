import { Injectable, Inject } from 'nexus-ioc';
import { PostRepository, Post, CreatePostDto, UpdatePostDto } from './post.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class PostsService {
  constructor(
    @Inject(PostRepository) private postRepository: PostRepository,
    // INTENTIONALLY MISSING @Inject decorator for error detection demo
    private usersService: UsersService,
    @Inject(LoggerService) private logger: LoggerService
  ) {}

  async getPostById(id: string): Promise<Post | null> {
    return this.postRepository.findById(id);
  }

  async createPost(data: CreatePostDto): Promise<Post> {
    // Verify author exists
    const author = await this.usersService.getUserById(data.authorId);
    if (!author) {
      throw new Error(`Author not found: ${data.authorId}`);
    }

    const post = await this.postRepository.create(data);
    
    this.logger.info(`Post created successfully: ${post.id}`, 'PostsService');
    
    return post;
  }

  async updatePost(id: string, data: UpdatePostDto): Promise<Post | null> {
    const post = await this.postRepository.update(id, data);
    
    if (post) {
      this.logger.info(`Post updated successfully: ${id}`, 'PostsService');
    }
    
    return post;
  }

  async deletePost(id: string): Promise<boolean> {
    const deleted = await this.postRepository.delete(id);
    
    if (deleted) {
      this.logger.info(`Post deleted successfully: ${id}`, 'PostsService');
    }
    
    return deleted;
  }

  async getPostsByAuthor(authorId: string, limit?: number): Promise<Post[]> {
    return this.postRepository.findByAuthor(authorId, limit);
  }

  async getPostsByCategory(categoryId: string, limit?: number): Promise<Post[]> {
    return this.postRepository.findByCategory(categoryId, limit);
  }

  async getPublishedPosts(limit?: number, offset?: number): Promise<Post[]> {
    return this.postRepository.findPublished(limit, offset);
  }

  async publishPost(id: string): Promise<Post | null> {
    return this.updatePost(id, { status: 'published' });
  }

  async archivePost(id: string): Promise<Post | null> {
    return this.updatePost(id, { status: 'archived' });
  }
}

