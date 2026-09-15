import { AppModule } from "./app.module";

// Stands in for a real framework bootstrap API (e.g. NexusApplication.create()).
// This file is never executed — StaticGraphVisualizer only parses it to find
// the root module passed to a `.create(...)`-shaped call.
class Bootstrap {
	static create(_module: unknown): Bootstrap {
		return new Bootstrap();
	}
	async run(): Promise<void> {}
}

async function bootstrap() {
	await Bootstrap.create(AppModule).run();
}

bootstrap();
