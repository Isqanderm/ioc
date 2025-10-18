import { NsModule } from "nexus-ioc";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { LoggerModule } from "./logger/logger.module";

@NsModule({
	imports: [ConfigModule, LoggerModule, DatabaseModule, AuthModule],
	exports: [ConfigModule, LoggerModule, DatabaseModule, AuthModule],
})
export class CoreModule {}
