import { Inject, Injectable } from "@nexus-ioc/core";

@Injectable()
export class SecondProvider {
	constructor(
		@Inject("AppService") private readonly appService: unknown,
	) {}
}
