import { NsModule } from "nexus-ioc";
import { CoreModule } from "../core/core.module";
import { CategoriesModule } from "../features/categories/categories.module";
import { CommentsModule } from "../features/comments/comments.module";
import { PostsModule } from "../features/posts/posts.module";
import { UsersModule } from "../features/users/users.module";
import { SharedModule } from "../shared/shared.module";

@NsModule({
	imports: [
		CoreModule,
		SharedModule,
		UsersModule,
		PostsModule,
		CommentsModule,
		CategoriesModule,
	],
})
export class AppsModule {}
