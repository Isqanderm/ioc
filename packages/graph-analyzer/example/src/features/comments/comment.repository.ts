import { Injectable, Inject } from 'nexus-ioc';
import { DatabaseService } from '../../core/database/database.service';
import { LoggerService } from '../../core/logger/logger.service';

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  postId: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommentDto {
  content: string;
  authorId: string;
  postId: string;
  parentId?: string;
}

@Injectable()
export class CommentRepository {
  constructor(
    @Inject(DatabaseService) private database: DatabaseService,
    @Inject(LoggerService) private logger: LoggerService
  ) {}

  async findById(id: string): Promise<Comment | null> {
    this.logger.debug(`Finding comment by id: ${id}`, 'CommentRepository');
    
    const comments = await this.database.query<Comment>(
      'SELECT * FROM comments WHERE id = $1',
      [id]
    );

    return comments[0] || null;
  }

  async create(data: CreateCommentDto): Promise<Comment> {
    this.logger.info(`Creating comment on post: ${data.postId}`, 'CommentRepository');
    
    const comment: Comment = {
      id: Date.now().toString(),
      content: data.content,
      authorId: data.authorId,
      postId: data.postId,
      parentId: data.parentId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.database.query(
      'INSERT INTO comments (id, content, author_id, post_id, parent_id) VALUES ($1, $2, $3, $4, $5)',
      [comment.id, comment.content, comment.authorId, comment.postId, comment.parentId]
    );

    return comment;
  }

  async update(id: string, content: string): Promise<Comment | null> {
    this.logger.info(`Updating comment: ${id}`, 'CommentRepository');
    
    const comment = await this.findById(id);
    if (!comment) {
      return null;
    }

    const updated: Comment = {
      ...comment,
      content,
      updatedAt: new Date()
    };

    await this.database.query(
      'UPDATE comments SET content = $1, updated_at = $2 WHERE id = $3',
      [content, updated.updatedAt, id]
    );

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    this.logger.info(`Deleting comment: ${id}`, 'CommentRepository');
    
    await this.database.query('DELETE FROM comments WHERE id = $1', [id]);
    return true;
  }

  async findByPost(postId: string): Promise<Comment[]> {
    this.logger.debug(`Finding comments for post: ${postId}`, 'CommentRepository');
    
    return this.database.query<Comment>(
      'SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC',
      [postId]
    );
  }

  async findByAuthor(authorId: string, limit: number = 10): Promise<Comment[]> {
    this.logger.debug(`Finding comments by author: ${authorId}`, 'CommentRepository');
    
    return this.database.query<Comment>(
      'SELECT * FROM comments WHERE author_id = $1 ORDER BY created_at DESC LIMIT $2',
      [authorId, limit]
    );
  }

  async findReplies(parentId: string): Promise<Comment[]> {
    this.logger.debug(`Finding replies to comment: ${parentId}`, 'CommentRepository');
    
    return this.database.query<Comment>(
      'SELECT * FROM comments WHERE parent_id = $1 ORDER BY created_at ASC',
      [parentId]
    );
  }
}

