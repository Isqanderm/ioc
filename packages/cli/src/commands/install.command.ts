import { Command } from "commander";
import type { AbstractAction } from "../actions/abstract.action";
import { AbstractCommand } from "./abstract.command";

export class InstallCommand extends AbstractCommand {
	constructor(private readonly action: AbstractAction) {
		super();
	}

	async load() {
		return new Command("install")
			.description("install nexus-ioc package")
			.alias("i")
			.action(async () => {
				return this.action.handler();
			});
	}
}
