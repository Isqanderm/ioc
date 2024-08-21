import { NsModule } from "nexus-ioc";
import { HttpService } from "./http.service";

@NsModule({
	providers: [HttpService, { provide: "URL", useValue: "https://api.*.com" }],
	exports: [HttpService],
})
export class HttpModule {}
