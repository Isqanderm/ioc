import type { HashUtilInterface } from "../interfaces";

export class HashUtilBrowser implements HashUtilInterface {
	private increment = 0;

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

	incrementString(): string {
		return `${this.increment++}`;
	}
}
