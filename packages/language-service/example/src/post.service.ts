import { Inject, Injectable } from "@nexus-ioc/core";
import { DatabaseService } from "./database.service";
import { LoggerService } from "./logger.service";
import { UserService } from "./user.service";

/**
 * Post service that demonstrates importing services from other modules
 *
 * This demonstrates:
 * - Injecting UserService which is exported from UserModule
 * - PostModule imports UserModule, so UserService is available
 * - Auto-completion should show UserService
 * - No errors should appear
 */
@Injectable()
export class PostService {
	constructor(
		@Inject(DatabaseService) private db: DatabaseService,
		@Inject(LoggerService) private logger: LoggerService,
		@Inject(UserService) private userService: UserService,
	) {}

	async create(postData: Partial<Post>): Promise<Post> {
		this.logger.log(`Creating post: ${postData.title}`);

		// Verify author exists
		const author = await this.userService.findById(postData.authorId!);
		if (!author) {
			throw new Error("Author not found");
		}

		const posts = await this.db.query<Post>(
			`INSERT INTO posts (title, content, authorId) VALUES ('${postData.title}', '${postData.content}', ${postData.authorId})`,
		);
		return posts[0];
	}

	async findById(id: number): Promise<Post | null> {
		this.logger.log(`Finding post by id: ${id}`);
		const posts = await this.db.query<Post>(
			`SELECT * FROM posts WHERE id = ${id}`,
		);
		return posts[0] || null;
	}

	async findByAuthor(authorId: number): Promise<Post[]> {
		this.logger.log(`Finding posts by author: ${authorId}`);
		return this.db.query<Post>(
			`SELECT * FROM posts WHERE authorId = ${authorId}`,
		);
	}
}

export interface Post {
	id: number;
	title: string;
	content: string;
	authorId: number;
	createdAt: Date;
}
