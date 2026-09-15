import { NexusApplicationServer } from "nexus-ioc/dist/server";
import { AppsModule } from "./apps";

async function bootstrap() {
	await NexusApplicationServer.create(AppsModule).bootstrap();
}

bootstrap();
