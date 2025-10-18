import { NsModule } from 'nexus-ioc';
import { DatabaseModule } from '../../core/database/database.module';
import { LoggerModule } from '../../core/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { PostsModule } from '../posts/posts.module';
import { EmailModule } from '../../shared/email/email.module';
import { CommentRepository } from './comment.repository';
import { CommentsService } from './comments.service';

@NsModule({
  imports: [
    DatabaseModule,
    LoggerModule,
    UsersModule,
    PostsModule,
    EmailModule
  ],
  providers: [CommentRepository, CommentsService],
  exports: [CommentsService]
})
export class CommentsModule {}

