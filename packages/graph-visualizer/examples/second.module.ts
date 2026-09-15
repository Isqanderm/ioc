import { Module } from "@nexus-ioc/core";
import { FirstModule } from "./first.module";

@Module({
	imports: [FirstModule],
})
export class SecondModule {}
