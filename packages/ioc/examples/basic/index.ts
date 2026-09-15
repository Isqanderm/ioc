import "reflect-metadata";
import { Inject, Injectable, Module, NexusApplication } from "@nexus-ioc/core";

@Injectable()
class GreetingService {
	greet(name: string): string {
		return `Hello, ${name}!`;
	}
}

@Injectable()
class AppService {
	constructor(
		@Inject(GreetingService) private readonly greeting: GreetingService,
	) {}

	run(): void {
		console.log(this.greeting.greet("World"));
	}
}

@Module({
	providers: [GreetingService, AppService],
})
class AppModule {}

async function main() {
	const app = await NexusApplication.create(AppModule).bootstrap();
	const service = await app.get<AppService>(AppService);
	service?.run(); // Hello, World!
	await app.close();
}

main();
