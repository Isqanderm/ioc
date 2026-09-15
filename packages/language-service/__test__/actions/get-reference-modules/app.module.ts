import { Module } from "@nexus-ioc/core";
import { AppService } from "./app.service";

@Module({
	providers: [AppService],
	exports: [AppService],
})
export class AppModule {}
