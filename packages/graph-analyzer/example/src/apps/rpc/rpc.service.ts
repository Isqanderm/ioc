import { Inject, Injectable } from "nexus-ioc";
import type { RpcHelper } from "./rpc.helper";

@Injectable()
export class RpcService {
	constructor(
		@Inject("URL_TOKEN") urlToken: string,
		private readonly helper: RpcHelper,
	) {}
}
