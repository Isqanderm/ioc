import { NexusApplicationsServer } from "nexus-ioc/dist/server";
import { AppsModule } from "./apps";

async function bootstrap() {
	await NexusApplicationsServer.create(AppsModule).bootstrap();
}

bootstrap();
