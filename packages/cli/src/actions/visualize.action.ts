import { exec } from "node:child_process";
import path from "node:path";
import prettier from "prettier";
import { Project } from "ts-morph";
import type { Input } from "../commands/command.input";
import { VisualizerTemplate } from "../templates/visualizer.template";
import { AbstractAction } from "./abstract.action";

export class VisualizeAction extends AbstractAction {
	private readonly project = new Project();

	async handler(inputs: Input[] = [], options: Input[] = []): Promise<void> {
		let outputDir = process.cwd();
		let type = "";

		for (const input of inputs) {
			if (input.name === "path") {
				outputDir = path.resolve(outputDir, input.value as string);
			} else if (input.name === "type") {
				type = input.value as string;
			}
		}

		if (type === "init") {
			await this.init(outputDir);
		} else if (type === "start") {
			await this.start(outputDir);
		}
	}

	private async init(outputDir: string) {
		const filePath = path.join(outputDir, "visualizer.ts");
		const visualizerTemplate = new VisualizerTemplate();
		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});
		const formattedText = await this.prettify(visualizerTemplate.generate(), {
			filepath: filePath,
		});

		sourceFile.replaceWithText(formattedText);

		await this.project.save();
	}

	private async start(outputDir: string) {
		exec(`npx ts-node ${outputDir}`, (error, stdout, stderr) => {
			if (!error || !stderr) {
				console.log("Graph visualization ready");
				return;
			}

			console.error("Some Error: ", error);
		});
	}

	private async prettify(text: string, options: { filepath: string }) {
		return prettier.format(text, options);
	}
}
