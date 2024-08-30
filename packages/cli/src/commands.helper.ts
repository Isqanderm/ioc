import type { AbstractAction } from "./actions/abstract.action";
import { GenerateAction } from "./actions/generate.action";
import { InstallAction } from "./actions/install.action";
import type { AbstractCommand } from "./commands/abstract.command";
import { GenerateCommand } from "./commands/generate.command";
import { InstallCommand } from "./commands/install.command";

type CommandMapper = {
	command: string;
	alias: string;
	commander: new (action: AbstractAction) => AbstractCommand;
	handler: new () => AbstractAction;
};

export class CommandsHelper {
	private readonly mapper: CommandMapper[] = [
		{
			command: "generate",
			alias: "g",
			commander: GenerateCommand,
			handler: GenerateAction,
		},
		{
			command: "install",
			alias: "i",
			commander: InstallCommand,
			handler: InstallAction,
		},
	];

	private readonly commands = new Map(
		this.mapper.reduce<[string, CommandMapper][]>((prev, next) => {
			prev.push([next.command, next]);
			prev.push([next.alias, next]);

			return prev;
		}, []),
	);

	public getAllCommands() {
		return this.mapper;
	}

	public getCommander(schematic: string) {
		const commandMapper = this.commands.get(schematic);

		if (!commandMapper) {
			return null;
		}

		return new commandMapper.commander(new commandMapper.handler());
	}
}
