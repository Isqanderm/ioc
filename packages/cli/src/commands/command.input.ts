export interface Input {
	name: string;
	value: boolean | string;
	// biome-ignore lint/suspicious/noExplicitAny: command input interface
	options?: any;
}
