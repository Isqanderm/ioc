import { Global, NsModule } from "nexus-ioc";
import { HttpService } from "./http.service";

@Global()
@NsModule({
	providers: [HttpService, { provide: "URL", useValue: "https://api.*.com" }],
	exports: [HttpService],
})
export class HttpModule {}
