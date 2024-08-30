import type { Command } from "commander";

export abstract class AbstractCommand {
	abstract load(): Promise<Command>;
}
