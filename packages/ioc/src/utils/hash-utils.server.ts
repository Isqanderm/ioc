import { createHash } from "node:crypto";
import type { HashUtilInterface } from "../interfaces";
import { randomStringGenerator } from "./random-string-generator.util";

export class HashUtilsServer implements HashUtilInterface {
	async hashString(value: string): Promise<string> {
		return createHash("sha256").update(value).digest("hex");
	}

	async hashObject(value: object): Promise<string> {
		const json = JSON.stringify(value);
		return this.hashString(json);
	}

	randomStringGenerator(): string {
		return randomStringGenerator();
	}
}
