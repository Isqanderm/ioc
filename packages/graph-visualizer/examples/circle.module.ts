import { NsModule } from "@nexus-ioc/core";
import { AppModule } from "./app.module";
import { StandAloneService } from "./standalone.service";

@NsModule({
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
