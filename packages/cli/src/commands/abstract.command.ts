import type { Command } from "commander";
import type { AbstractAction } from "../actions/abstract.action";

export abstract class AbstractCommand {
	constructor(protected readonly action: AbstractAction) {}

	abstract load(): Promise<Command>;
}
