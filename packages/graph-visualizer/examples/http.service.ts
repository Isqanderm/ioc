import { Inject, Injectable } from "@nexus-ioc/core";

@Injectable()
export class HttpService {
	constructor(
		@Inject("URL") private readonly url: string,
		@Inject("ASYNC_FACTORY") private readonly factoryResult: string,
	) {}
}
