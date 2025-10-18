#!/usr/bin/env node

import { CommandsHelper } from "./commands.helper";
import { MainMenu } from "./tui/main-menu";

async function bootstrap() {
	const commandsHelper = new CommandsHelper();
	const mainMenu = new MainMenu({ commandsHelper });
	await mainMenu.show();
}

bootstrap();
