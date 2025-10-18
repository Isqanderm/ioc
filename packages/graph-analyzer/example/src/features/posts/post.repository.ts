import { Injectable, Inject } from 'nexus-ioc';
import { DatabaseService } from '../../core/database/database.service';
import { LoggerService } from '../../core/logger/logger.service';
import { CacheService } from '../../shared/cache/cache.service';

export interface Post {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  authorId: string;
  categoryId?: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePostDto {
  title: string;
  content: string;
  excerpt?: string;
  authorId: string;
  categoryId?: string;
  status?: 'draft' | 'published';
}

export interface UpdatePostDto {
  title?: string;
  content?: string;
  excerpt?: string;
  categoryId?: string;
  status?: 'draft' | 'published' | 'archived';
}

@Injectable()
export class PostRepository {
  constructor(
    @Inject(DatabaseService) private database: DatabaseService,
    @Inject(CacheService) private cache: CacheService,
    @Inject(LoggerService) private logger: LoggerService
  ) {}

  async findById(id: string): Promise<Post | null> {
    const cached = await this.cache.get<Post>(`post:${id}`);
    if (cached) {
      return cached;
    }

    this.logger.debug(`Finding post by id: ${id}`, 'PostRepository');
    
    const posts = await this.database.query<Post>(
      'SELECT * FROM posts WHERE id = $1',
      [id]
    );

    const post = posts[0] || null;
    
    if (post) {
      await this.cache.set(`post:${id}`, post, { ttl: 600 });
    }

    return post;
  }

  async create(data: CreatePostDto): Promise<Post> {
    this.logger.info(`Creating post: ${data.title}`, 'PostRepository');
    
    const post: Post = {
      id: Date.now().toString(),
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      authorId: data.authorId,
      categoryId: data.categoryId,
      status: data.status || 'draft',
      publishedAt: data.status === 'published' ? new Date() : undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.database.query(
      'INSERT INTO posts (id, title, content, author_id, status) VALUES ($1, $2, $3, $4, $5)',
      [post.id, post.title, post.content, post.authorId, post.status]
    );

    return post;
  }

  async update(id: string, data: UpdatePostDto): Promise<Post | null> {
    this.logger.info(`Updating post: ${id}`, 'PostRepository');
    
    const post = await this.findById(id);
    if (!post) {
      return null;
    }

    const updated: Post = {
      ...post,
      ...data,
      updatedAt: new Date()
    };

    if (data.status === 'published' && post.status !== 'published') {
      updated.publishedAt = new Date();
    }

    await this.database.query(
      'UPDATE posts SET title = $1, content = $2, status = $3, updated_at = $4 WHERE id = $5',
      [updated.title, updated.content, updated.status, updated.updatedAt, id]
    );

    await this.cache.delete(`post:${id}`);

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    this.logger.info(`Deleting post: ${id}`, 'PostRepository');
    
    await this.database.query('DELETE FROM posts WHERE id = $1', [id]);
    await this.cache.delete(`post:${id}`);

    return true;
  }

  async findByAuthor(authorId: string, limit: number = 10): Promise<Post[]> {
    this.logger.debug(`Finding posts by author: ${authorId}`, 'PostRepository');
    
    return this.database.query<Post>(
      'SELECT * FROM posts WHERE author_id = $1 ORDER BY created_at DESC LIMIT $2',
      [authorId, limit]
    );
  }

  async findByCategory(categoryId: string, limit: number = 10): Promise<Post[]> {
    this.logger.debug(`Finding posts by category: ${categoryId}`, 'PostRepository');
    
    return this.database.query<Post>(
      'SELECT * FROM posts WHERE category_id = $1 AND status = $2 ORDER BY published_at DESC LIMIT $3',
      [categoryId, 'published', limit]
    );
  }

  async findPublished(limit: number = 10, offset: number = 0): Promise<Post[]> {
    this.logger.debug(`Finding published posts (limit: ${limit}, offset: ${offset})`, 'PostRepository');
    
    return this.database.query<Post>(
      'SELECT * FROM posts WHERE status = $1 ORDER BY published_at DESC LIMIT $2 OFFSET $3',
      ['published', limit, offset]
    );
  }
}

