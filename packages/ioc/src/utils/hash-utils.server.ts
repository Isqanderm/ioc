import { createHash } from "node:crypto";
import type { HashUtilInterface } from "../interfaces";

export class HashUtilsServer implements HashUtilInterface {
	private increment = 0;

	async hashString(value: string): Promise<string> {
		return createHash("sha256").update(value).digest("hex");
	}

	async hashObject(value: object): Promise<string> {
		const json = JSON.stringify(value);
		return this.hashString(json);
	}

	incrementString(): string {
		return `${this.increment++}`;
	}
}
