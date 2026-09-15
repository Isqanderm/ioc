import { Module } from "@nexus-ioc/core";
import { AppService } from "./app.service";

@Module({
	providers: [AppService],
	exports: [],
})
export class TestModule {}
