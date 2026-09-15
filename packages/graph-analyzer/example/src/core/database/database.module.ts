import { Module } from "nexus-ioc";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { DatabaseService } from "./database.service";

@Module({
	imports: [ConfigModule, LoggerModule],
	providers: [DatabaseService],
	exports: [DatabaseService],
})
export class DatabaseModule {}
