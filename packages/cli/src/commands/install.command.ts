import { Command } from "commander";
import { AbstractCommand } from "./abstract.command";

export class InstallCommand extends AbstractCommand {
	async load() {
		return new Command("install")
			.description("install @nexus-ioc/core package")
			.alias("i")
			.action(async () => {
				return this.action.handler([], []);
			});
	}
}
