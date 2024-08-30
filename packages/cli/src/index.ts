#!/usr/bin/env node

import { Command } from "commander";
import { CommandsHelper } from "./commands.helper";

async function bootstrap() {
	const commandsHelper = new CommandsHelper();
	const program = new Command();

	for (const command of commandsHelper.getAllCommands()) {
		const commander = commandsHelper.getCommander(command.command);
		const commandInstance = await commander?.load();

		if (commandInstance) {
			program.addCommand(commandInstance);
		}
	}

	program.parse(process.argv);
}

bootstrap();
