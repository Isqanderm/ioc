import type { HashUtilInterface } from "@nexus-ioc/core/dist/node";

export class HashTestingUtil implements HashUtilInterface {
	private increment = 1;
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

	incrementString() {
		return `${this.increment++}`;
	}
}
