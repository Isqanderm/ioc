import { Module } from "nexus-ioc";
import { ConfigService } from "./config.service";

@Module({
	providers: [ConfigService],
	exports: [ConfigService],
})
export class ConfigModule {}
