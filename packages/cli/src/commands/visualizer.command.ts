import { Command } from "commander";
import { AbstractCommand } from "./abstract.command";
import type { Input } from "./command.input";

export class VisualizerCommand extends AbstractCommand {
	async load(): Promise<Command> {
		return new Command("visualizer")
			.description("Visualisation helper")
			.arguments("[type] [path]")
			.alias("vi")
			.option("--install-deps", "Install deps for this functionality", () => true, false)
			.action(
				async (
					type: string,
					path: string,
					params: { installDeps: boolean },
					// command: Command,
				) => {
					const options: Input[] = [];
					options.push({ name: "installDeps", value: params.installDeps });

					const inputs: Input[] = [];
					inputs.push({ name: "type", value: type });
					inputs.push({ name: "path", value: path });

					await this.action.handler(inputs, options);
				},
			);
	}
}
