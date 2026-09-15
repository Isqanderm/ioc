import { Module } from "@nexus-ioc/core";
import { AppModule } from "./app.module";
import { StandAloneService } from "./standalone.service";

@Module({
	imports: [AppModule],
	providers: [
		{
			provide: "StandAloneService",
			useClass: StandAloneService,
		},
	],
	exports: ["StandAloneService"],
})
export class CircleModule {}
