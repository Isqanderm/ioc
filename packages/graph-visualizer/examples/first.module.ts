import { Module } from "@nexus-ioc/core";
import { SecondModule } from "./second.module";

@Module({
	imports: [SecondModule],
})
export class FirstModule {}
