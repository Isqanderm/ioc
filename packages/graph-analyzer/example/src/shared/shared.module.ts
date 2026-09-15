import { Module } from "nexus-ioc";
import { CacheModule } from "./cache/cache.module";
import { EmailModule } from "./email/email.module";
import { StorageModule } from "./storage/storage.module";

@Module({
	imports: [CacheModule, EmailModule, StorageModule],
	exports: [CacheModule, EmailModule, StorageModule],
})
export class SharedModule {}
