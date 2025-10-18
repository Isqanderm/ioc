import { Inject, Injectable } from "nexus-ioc";
import type { RpcHelper } from "./rpc.helper";

@Injectable()
export class RpcService {
	constructor(
		@Inject("URL_TOKEN") _urlToken: string,
		readonly _helper: RpcHelper,
	) {}
}
