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
			provide: "FACTORY",
			useFactory: () => "FACTORY",
		},
	],
})
export class TransportModule {}
