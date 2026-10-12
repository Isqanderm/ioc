import { Global, Module, Scope } from "nexus-ioc";
import { HttpService } from "./http.service";

@Global()
@Module({
	providers: [
		HttpService,
		{ provide: "URL", useValue: "https://api.*.com" },
		{
			provide: "REQUEST_ID",
			useValue: "request-123",
			scope: Scope.Transient,
		},
		{
			provide: "requestFactory",
			useFactory: ({ requestId }: { requestId: string }) => {
				return `Request: ${requestId}`;
			},
			inject: ["REQUEST_ID"],
			scope: Scope.Transient,
		},
	],
	exports: [HttpService],
})
export class HttpModule {}
