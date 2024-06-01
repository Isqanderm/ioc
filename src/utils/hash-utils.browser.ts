import type { HashUtilInterface } from "../interfaces";
import { randomStringGenerator } from "./random-string-generator.util";

export class HashUtilBrowser implements HashUtilInterface {
	async hashString(value: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(value);
		const hashBuffer = await crypto.subtle.digest("SHA-256", data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
	}

	async hashObject(value: object): Promise<string> {
		const json = JSON.stringify(value);

		return this.hashString(json);
	}

	randomStringGenerator(): string {
		return randomStringGenerator();
	}
}
