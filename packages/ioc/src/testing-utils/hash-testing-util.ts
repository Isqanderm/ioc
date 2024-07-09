import type { HashUtilBrowser } from "../utils/hash-utils.browser";
import { randomStringGenerator } from "../utils/random-string-generator.util";

export class HashTestingUtil implements HashUtilBrowser {
	async hashString(value: string): Promise<string> {
		let index = 0;
		return new Array(64)
			.fill(null)
			.map(() => {
				index++;

				if (index >= value.length) {
					index = 0;
				}

				return value.charAt(index);
			})
			.join("");
	}
	async hashObject(value: object): Promise<string> {
		return "";
	}
	randomStringGenerator() {
		return randomStringGenerator();
	}
}
