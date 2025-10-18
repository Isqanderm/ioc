#!/usr/bin/env node

import { Command } from "commander";
import { CommandsHelper } from "./commands.helper";
import { MainMenu } from "./tui/main-menu";

async function bootstrap() {
	const commandsHelper = new CommandsHelper();
	const program = new Command();

	// Add global --interactive flag
	program.option("-i, --interactive", "Run in interactive mode");

	// Register all commands
	for (const command of commandsHelper.getAllCommands()) {
		const commander = commandsHelper.getCommander(command.command);
		const commandInstance = await commander?.load();

		if (commandInstance) {
			program.addCommand(commandInstance);
		}
	}

	// Parse arguments
	program.parse(process.argv);

	// Check if interactive mode should be enabled
	const opts = program.opts();
	const shouldRunInteractive =
		opts.interactive || // Explicit --interactive flag
		process.argv.length === 2; // No arguments provided

	if (shouldRunInteractive) {
		// Run interactive TUI
		const mainMenu = new MainMenu({ commandsHelper });
		await mainMenu.show();
	}
}

bootstrap();
