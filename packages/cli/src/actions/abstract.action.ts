import type { Input } from "../commands/command.input";

export abstract class AbstractAction {
	abstract handler(inputs: Input[], options: Input[]): Promise<void>;
}
