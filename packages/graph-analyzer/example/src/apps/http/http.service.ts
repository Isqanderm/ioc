import { Inject, Injectable } from "nexus-ioc";

@Injectable()
export class HttpService {
	constructor(@Inject("URL") private readonly url: string) {}
}
