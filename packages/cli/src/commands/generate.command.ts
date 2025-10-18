import { Command } from "commander";
import { AbstractCommand } from "./abstract.command";
import type { Input } from "./command.input";

export class GenerateCommand extends AbstractCommand {
	async load() {
		return new Command("generate")
			.description("Generate a new schematic")
			.arguments("<schematic> [type] [name] [path]")
			.alias("g")
			.option("--skip-import", "Skip importing")
			.option("--no-spec", "Disable spec files generation.")
			.action(
				async (
					type: string,
					name: string,
					path: string,
					_,
					params: { skipImport: boolean; spec: boolean },
					_command: Command,
				) => {
					const options: Input[] = [];
					options.push({
						name: "skipImport",
						value: params.skipImport ?? false,
					});
					options.push({ name: "spec", value: params.spec ?? true });

					const inputs: Input[] = [];
					inputs.push({ name: "type", value: type });
					inputs.push({ name: "name", value: name });
					inputs.push({ name: "path", value: path });

					await this.action.handler(inputs, options);
				},
			);
	}
}
