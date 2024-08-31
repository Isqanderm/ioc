import { Command } from "commander";
import { AbstractCommand } from "./abstract.command";
import type { Input } from "./command.input";

export class VisualizerCommand extends AbstractCommand {
	async load(): Promise<Command> {
		return new Command("visualizer")
			.description("Visualisation helper")
			.arguments("[type] [path]")
			.alias("vi")
			.action(
				async (
					type: string,
					path: string,
					_,
					// params,
					// command: Command,
				) => {
					const options: Input[] = [];

					const inputs: Input[] = [];
					inputs.push({ name: "type", value: type });
					inputs.push({ name: "path", value: path });

					await this.action.handler(inputs, options);
				},
			);
	}
}
