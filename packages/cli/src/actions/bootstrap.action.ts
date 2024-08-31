import { exec } from "node:child_process";
import path from "node:path";
import prettier from "prettier";
import { Project } from "ts-morph";
import type { Input } from "../commands/command.input";
import { BootstrapTemplate } from "../templates/bootstrap.template";
import { ModuleTemplate } from "../templates/module.template";
import { AbstractAction } from "./abstract.action";

export class BootstrapAction extends AbstractAction {
	private readonly project = new Project();

	async handler(inputs: Input[], options: Input[]): Promise<void> {
		if (options.find((item) => item.name === "skipDeps" && !item.value)) {
			const installReact = !!options.find(
				(item) => item.name === "skipDeps" && !item.value,
			);
			await this.installDeps({
				installReact,
			});
		}

		await this.createAppModule();
		await this.createBootstrap();

		await this.project.save();

		console.log("Bootstrap done!");
	}

	private async createBootstrap() {
		const outputDir = process.cwd();
		const filePath = path.join(outputDir, "bootstrap.ts");
		const sourceFile = this.project.createSourceFile(filePath);
		const bootstrapTemplate = new BootstrapTemplate();

		const formattedText = await this.prettify(bootstrapTemplate.generate(), {
			filepath: filePath,
		});

		sourceFile.replaceWithText(formattedText);
	}

	private async createAppModule() {
		const outputDir = path.resolve(process.cwd(), "apps");
		const filePath = path.join(outputDir, "app.module.ts");
		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});

		const moduleTemplate = new ModuleTemplate({ name: "App" });

		const sourceText = `
      import { NsModule } from 'nexus-ioc';
      
      ${moduleTemplate.generate()}
    `;

		const formattedText = await this.prettify(sourceText, {
			filepath: filePath,
		});

		sourceFile.replaceWithText(formattedText);
	}

	private async installDeps(params: { installReact: boolean }) {
		const devDeps = ["nexus-ioc-graph-visualizer", "nexus-ioc-testing"];
		const deps = ["nexus-ico"];

		if (params.installReact) {
			deps.push("nexus-ioc-react-adapter");
		}

		return new Promise<void>((resolve, reject) => {
			exec(
				`npm install -save ${deps.join(" ")} && npm install --save-dev ${devDeps.join(" ")}`,
				(error, stdout, stderr) => {
					if (error) {
						console.error(`Install error: ${error.message}`);
						reject();
						return;
					}

					if (stderr) {
						console.error(`Error: ${stderr}`);
						reject();
						return;
					}

					resolve();
				},
			);
		});
	}

	private async prettify(text: string, options: { filepath: string }) {
		return prettier.format(text, options);
	}
}
