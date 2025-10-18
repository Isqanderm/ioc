import { Injectable, Inject } from 'nexus-ioc';
import { CommentRepository, Comment, CreateCommentDto } from './comment.repository';
import { LoggerService } from '../../core/logger/logger.service';
import { UsersService } from '../users/users.service';
import { PostsService } from '../posts/posts.service';
import { EmailService } from '../../shared/email/email.service';

@Injectable()
export class CommentsService {
  constructor(
    @Inject(CommentRepository) private commentRepository: CommentRepository,
    @Inject(UsersService) private usersService: UsersService,
    @Inject(PostsService) private postsService: PostsService,
    // INTENTIONALLY MISSING @Inject decorator for error detection demo
    private emailService: EmailService,
    @Inject(LoggerService) private logger: LoggerService
  ) {}

  async getCommentById(id: string): Promise<Comment | null> {
    return this.commentRepository.findById(id);
  }

  async createComment(data: CreateCommentDto): Promise<Comment> {
    // Verify author exists
    const author = await this.usersService.getUserById(data.authorId);
    if (!author) {
      throw new Error(`Author not found: ${data.authorId}`);
    }

    // Verify post exists
    const post = await this.postsService.getPostById(data.postId);
    if (!post) {
      throw new Error(`Post not found: ${data.postId}`);
    }

    const comment = await this.commentRepository.create(data);
    
    // Notify post author about new comment
    const postAuthor = await this.usersService.getUserById(post.authorId);
    if (postAuthor && postAuthor.id !== author.id) {
      await this.emailService.send({
        to: postAuthor.email,
        subject: 'New comment on your post',
        text: `${author.name} commented on your post "${post.title}"`
      });
    }
    
    this.logger.info(`Comment created successfully: ${comment.id}`, 'CommentsService');
    
    return comment;
  }

  async updateComment(id: string, content: string): Promise<Comment | null> {
    const comment = await this.commentRepository.update(id, content);
    
    if (comment) {
      this.logger.info(`Comment updated successfully: ${id}`, 'CommentsService');
    }
    
    return comment;
  }

  async deleteComment(id: string): Promise<boolean> {
    const deleted = await this.commentRepository.delete(id);
    
    if (deleted) {
      this.logger.info(`Comment deleted successfully: ${id}`, 'CommentsService');
    }
    
    return deleted;
  }

  async getCommentsByPost(postId: string): Promise<Comment[]> {
    return this.commentRepository.findByPost(postId);
  }

  async getCommentsByAuthor(authorId: string, limit?: number): Promise<Comment[]> {
    return this.commentRepository.findByAuthor(authorId, limit);
  }

  async getReplies(commentId: string): Promise<Comment[]> {
    return this.commentRepository.findReplies(commentId);
  }
}

