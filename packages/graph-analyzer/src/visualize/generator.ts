import { spawnSync } from "node:child_process";
import fs, { mkdirSync } from "node:fs";
import { dirname } from "node:path";

type ModuleInfo = {
	name: string;
	imports: string[];
	exports: string[];
	isGlobal: boolean;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	providers: any[];
	dependencies: string[];
};

type ModulesData = {
	[key: string]: ModuleInfo;
};

export class GraphGenerator {
	constructor(
		private readonly json: ModulesData,
		private readonly outputPath: string,
	) {}

	private typeColors = {
		Class: "lightblue",
		UseValue: "lightgreen",
		UseFactory: "lightcoral",
		UseClass: "lightyellow",
	};

	private generateDotGraph(): string {
		let dot = "digraph G {\n";
		dot += "    node [shape=box];\n"; // Установка формы узлов
		dot += "    rankdir=LR;\n"; // Установка горизонтального направления графа

		for (const [moduleName, moduleInfo] of Object.entries(this.json)) {
			dot += `    "${moduleName}" [label="${moduleName}", style=filled, fillcolor="lightgray"];\n`;

			if (moduleInfo.providers && moduleInfo.providers.length > 0) {
				moduleInfo.providers.forEach((provider, index) => {
					const providerName = `${moduleName}_Provider${index}`;
					const providerLabel = `"${provider.token.replace(/"/g, '\\"')} (${provider.type})"`;
					const color = this.typeColors[provider.type] || "white";
					dot += `    "${providerName}" [label=${providerLabel}, style=filled, fillcolor="${color}"];\n`;
					dot += `    "${moduleName}" -> "${providerName}";\n`;
				});
			}

			for (const imp of moduleInfo.imports) {
				dot += `    "${moduleName}" -> "${imp}";\n`;
			}
		}

		dot += "}\n";
		return dot;
	}

	public scan() {
		const dotGraph = this.generateDotGraph();
		this.ensureDirectoryExists(this.outputPath);

		const dotProcess = spawnSync("dot", ["-Tpng", "-o", this.outputPath], {
			input: dotGraph,
			encoding: "utf-8",
		});

		if (dotProcess.error) {
			console.error("Error running dot command:", dotProcess.error);
		} else {
			console.log(`Graph visualized as ${this.outputPath}`);
		}
	}

	protected ensureDirectoryExists(filePath: string): void {
		const dir = dirname(filePath);
		mkdirSync(dir, { recursive: true });
	}
}
