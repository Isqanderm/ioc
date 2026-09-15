import { Module } from "nexus-ioc";
import { ConfigModule } from "../../core/config/config.module";
import { LoggerModule } from "../../core/logger/logger.module";
import { CacheService } from "./cache.service";

@Module({
	imports: [ConfigModule, LoggerModule],
	providers: [CacheService],
	exports: [CacheService],
})
export class CacheModule {}
