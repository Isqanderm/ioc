import type { HashUtilInterface } from "../src";
import { randomStringGenerator } from "../src/utils/random-string-generator.util";

export const hashUtilsMock: HashUtilInterface = {
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
	},
	async hashObject(value: object): Promise<string> {
		return "";
	},
	randomStringGenerator() {
		return randomStringGenerator();
	},
};
