import { ArticleService } from "@external/article/article.service";
import { NsModule } from "nexus-ioc";

@NsModule({
	providers: [ArticleService],
})
export class ArticleModule {}
