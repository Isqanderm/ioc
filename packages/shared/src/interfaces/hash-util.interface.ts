export interface HashUtilInterface {
	hashString(value: string): Promise<string>;

	hashObject(value: object): Promise<string>;

	incrementString(): string;
}

