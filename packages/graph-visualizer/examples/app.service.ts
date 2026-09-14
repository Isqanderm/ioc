import { Inject, Injectable } from "@nexus-ioc/core";

@Injectable()
export class AppService {
	constructor(
		@Inject("SecondProvider") private readonly secondProvider: unknown,
		@Inject("StandAloneService") private readonly standAloneService: unknown,
	) {}
}
