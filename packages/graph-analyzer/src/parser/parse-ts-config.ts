import path from "node:path";

export class ParseTsConfig {
	private aliasPaths: Record<string, string[]> = {};
	private srcPath = "";
	constructor(
		private readonly config: string,
		private readonly basePath: string,
	) {
		this.parse();
	}

	private parse() {
		const config = JSON.parse(this.config);
		// console.log("config.compilerOptions: ", config.compilerOptions);
		this.aliasPaths = config.compilerOptions?.paths;
		this.srcPath = config.compilerOptions.baseUrl;
	}

	public resolveAliasPath(path: string) {
		for (const aliaKey of Object.keys(this.aliasPaths)) {
			const aliasStart = aliaKey.slice(0, -1);
			if (path.startsWith(aliasStart)) {
				const [resolvePath] = this.aliasPaths[aliaKey] || [];
				return path.replace(aliasStart, resolvePath.slice(0, -1));
			}
		}

		return path;
	}

	public getSrcBasePath() {
		return path.resolve(this.basePath, this.srcPath);
	}
}
