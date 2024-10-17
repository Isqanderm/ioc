export class BootstrapTemplate {
	private parse() {}

	public generate() {
		return `
      import { NexusApplicationsBrowser } from "@nexus-ioc/core/dist/browser";
      import { AppModule } from "./apps/app.module";
      
      async function bootstrap() {
        const container = await NexusApplicationsBrowser
          .create(AppModule)
          .bootstrap();
      }
      
      bootstrap();
    `;
	}
}
