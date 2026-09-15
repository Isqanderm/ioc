export class BootstrapTemplate {
	public generate() {
		return `
      import { NexusApplicationBrowser } from "@nexus-ioc/core/dist/browser";
      import { AppModule } from "./apps/app.module";
      
      async function bootstrap() {
        const container = await NexusApplicationBrowser
          .create(AppModule)
          .bootstrap();
      }
      
      bootstrap();
    `;
	}
}
