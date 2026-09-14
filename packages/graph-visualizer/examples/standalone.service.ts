import { Inject, Injectable } from "@nexus-ioc/core";

@Injectable()
export class StandAloneService {
	constructor(
		@Inject("AppService") private readonly appService: unknown,
	) {}
}
