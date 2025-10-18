import { Inject, Injectable } from "nexus-ioc";

@Injectable()
export class HttpService {
	constructor(
		@Inject("URL") readonly _url: string,
		@Inject("requestFactory") readonly _requestFactory: string,
	) {}
}
