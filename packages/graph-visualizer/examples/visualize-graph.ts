import { Inject, Injectable, NsModule } from "nexus-ioc";
import { NexusApplicationsServer } from "nexus-ioc/dist/server";
import { GraphScannerVisualizer } from "../src";

@Injectable()
class StandAloneService {
	constructor(
		@Inject("AppService")
		private readonly appService: IAppService,
	) {}
}

class CircleModule {}

class FirstModule {}
class SecondModule {}

NsModule({
	imports: [SecondModule],
})(FirstModule);

NsModule({
	imports: [FirstModule],
})(SecondModule);

@Injectable()
class HttpService {
	@Inject("URL") private readonly url: string = "";
	@Inject("ASYNC_FACTORY") private readonly factoryResult: string = "";
}

@NsModule({
	imports: [FirstModule, SecondModule, CircleModule],
	providers: [
		HttpService,
		{
			provide: "URL",
			useValue: "https://....",
		},
		{
			provide: "ASYNC_FACTORY",
			useFactory: () => {
				return Promise.resolve("ASYNC_FACTORY");
			},
		},
	],
})
class TransportModule {}

// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
interface IAppService {}
// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
interface ISecondProvider {}

@Injectable()
class SecondProvider implements SecondProvider {
	constructor(
		@Inject("AppService")
		private readonly appService: IAppService,
	) {}
}

@Injectable()
class AppService implements IAppService {
	constructor(
		@Inject("SecondProvider")
		private readonly secondProvider: ISecondProvider,
		@Inject("StandAloneService")
		private readonly standAloneService: StandAloneService,
	) {}
}

@NsModule({
	imports: [TransportModule],
	providers: [
		{
			provide: "SecondProvider",
			useClass: SecondProvider,
		},
		{
			provide: "AppService",
			useClass: AppService,
		},
	],
	exports: ["AppService"],
})
class AppModule {}

NsModule({
	imports: [AppModule],
	providers: [
		{
			provide: "StandAloneService",
			useClass: StandAloneService,
		},
	],
	exports: ["StandAloneService"],
})(CircleModule);

const visualizer = new GraphScannerVisualizer("./__test__build__/graph.png");

async function bootstrap() {
	await NexusApplicationsServer.create(AppModule).addScannerPlugin(visualizer).bootstrap();
}

bootstrap();
