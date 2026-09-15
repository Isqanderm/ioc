import { Module } from "@nexus-ioc/core";
import { TransportModule } from "./transport.module";
import { SecondProvider } from "./second-provider.service";
import { AppService } from "./app.service";

@Module({
	imports: [TransportModule],
	providers: [
		{
			provide: "SecondProvider",
			useClass: SecondProvider,
		},
		{
			provide: "AppService",
			useClass: AppService,
		},
	],
	exports: ["AppService"],
})
export class AppModule {}
