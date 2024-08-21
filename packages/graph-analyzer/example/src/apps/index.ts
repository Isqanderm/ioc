import { ArticleModule } from "@external/article/article.module";
import { NsModule } from "nexus-ioc";
import { PostsModule } from "./posts/posts.module";
import { UserModule } from "./user/user.module";

@NsModule({
	imports: [UserModule, PostsModule, ArticleModule],
})
export class AppsModule {}
