import { Command } from "commander";
import { AbstractCommand } from "./abstract.command";
import type { Input } from "./command.input";

export class BootstrapCommand extends AbstractCommand {
	async load(): Promise<Command> {
		return new Command("bootstrap")
			.description("Bootstrap app")
			.alias("boot")
			.option("--react", "Install integration with react", () => true, false)
			.option("--skip-deps", "Install deps", () => true, false)
			.action(async (params: { skipDeps: boolean; react: boolean }) => {
				const options: Input[] = [];
				options.push({ name: "skipDeps", value: params.skipDeps });
				options.push({ name: "react", value: params.react });

				const inputs: Input[] = [];

				await this.action.handler(inputs, options);
			});
	}
}
