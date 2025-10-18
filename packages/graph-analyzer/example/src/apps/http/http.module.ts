import { Global, NsModule, Scope } from "nexus-ioc";
import { HttpService } from "./http.service";

@Global()
@NsModule({
	providers: [
		HttpService,
		{ provide: "URL", useValue: "https://api.*.com" },
		{
			provide: "REQUEST_ID",
			useValue: "request-123",
			scope: Scope.Request,
		},
		{
			provide: "requestFactory",
			useFactory: ({ requestId }: { requestId: string }) => {
				return `Request: ${requestId}`;
			},
			inject: ["REQUEST_ID"],
			scope: Scope.Request,
		},
	],
	exports: [HttpService],
})
export class HttpModule {}
