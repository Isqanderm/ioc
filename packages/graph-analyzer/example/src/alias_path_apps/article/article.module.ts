import { ArticleService } from "@external/article/article.service";
import { Module } from "nexus-ioc";

@Module({
	providers: [ArticleService],
})
export class ArticleModule {}
