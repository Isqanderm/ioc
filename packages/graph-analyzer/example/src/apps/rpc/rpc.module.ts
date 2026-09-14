import { Module, Scope } from "nexus-ioc";
import { RpcHelper } from "./rpc.helper";
import { RpcService } from "./rpc.service";

@Module({
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
			useFactory: (urlToken: string, _helper: RpcHelper) => {
				return new RpcService(urlToken, RpcHelper);
			},
			inject: ["URL_TOKEN", RpcHelper],
			scope: Scope.Scoped,
		},
	],
	exports: [RpcService],
})
export class RpcModule {}
