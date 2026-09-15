import { Module } from "@nexus-ioc/core";
import { FirstModule } from "./first.module";
import { SecondModule } from "./second.module";
import { CircleModule } from "./circle.module";
import { HttpService } from "./http.service";

@Module({
	imports: [FirstModule, SecondModule, CircleModule],
	providers: [
		HttpService,
		{
			provide: "URL",
			useValue: "https://example.com",
		},
		{
			provide: "ASYNC_FACTORY",
			useFactory: () => Promise.resolve("ASYNC_FACTORY"),
		},
	],
})
export class TransportModule {}
