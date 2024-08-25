import type { ParseEntryFile } from "../parser/parse-entry-file";
import type { ParseNsModule } from "../parser/parse-ns-module";
import { GraphGenerator } from "./generator";

export class GraphAnalyzer {
	constructor(
		private readonly graph: Map<string, ParseNsModule | ParseEntryFile>,
	) {}

	parse() {
		const entryModule = this.graph.get("entry") as ParseEntryFile;

		if (!entryModule || !entryModule.name) {
			throw new Error("Empty entry module");
		}

		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		const json: any = {};
		const modules = [entryModule.name];

		for (const module of modules) {
			const parseNsModule = this.graph.get(module) as ParseNsModule;

			if (!parseNsModule) {
				continue;
			}

			json[module] = {
				name: module,
				imports: parseNsModule.imports,
				exports: parseNsModule.exports,
				isGlobal: parseNsModule.isGlobal,
				providers: parseNsModule.providers.map((provider) => ({
					token: provider.token,
					value: provider.value,
					inject: provider.inject,
					scope: provider.scope,
					type: provider.type,
				})),
				dependencies: parseNsModule.deps,
			};

			modules.push(...parseNsModule.imports);
		}

		const graphGenerator = new GraphGenerator(json, "./graph.png");
		graphGenerator.scan();
	}
}
