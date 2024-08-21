import { NsModule, Scope } from "nexus-ioc";
import { RpcHelper } from "./rpc.helper";
import { RpcService } from "./rpc.service";

@NsModule({
	providers: [
		{
			provide: "RpcService",
			useClass: RpcService,
			scope: Scope.Singleton,
		},
		{
			provide: RpcHelper,
			useClass: RpcHelper,
		},
		{
			provide: "URL_TOKEN",
			useValue: "url_token",
		},
		{
			provide: "RpcServiceFactory",
			useFactory: (urlToken: string, helper: RpcHelper) => {
				return new RpcService(urlToken, RpcHelper);
			},
			inject: ["URL_TOKEN", RpcHelper],
			scope: Scope.Request,
		},
	],
	exports: [RpcService],
})
export class RpcModule {}
