export interface Input {
	name: string;
	value: boolean | string;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	options?: any;
}
