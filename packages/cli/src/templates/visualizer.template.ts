export class VisualizerTemplate {
	public generate() {
		return `
      import { NexusApplicationsServer } from "@nexus-ioc/core/dist/server";
      import { GraphScannerVisualizer } from 'nexus-ioc-graph-visualizer';
      import { AppModule } from "./app.module";
      
      const visualizer = new GraphScannerVisualizer('graph.png');
      
      async function bootstrap() {
        await NexusApplicationsServer.create(AppModule)
          .addScannerPlugin(visualizer)
          .bootstrap();
      }
      
      bootstrap();
    `;
	}
}
