import * as fs from "node:fs";

export class Logger {
	constructor(private readonly options: { debug: boolean; logPath: string }) {}

	log(message: string) {
		if (!this.options.debug) {
			return;
		}

		const logMessage = `${message}\n`;
		fs.appendFileSync(this.options.logPath, logMessage, { encoding: "utf8" });
	}
}
