import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
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

	/**
	 * Escape special characters for DOT format
	 * Escapes quotes, backslashes, and newlines to prevent injection
	 */
	private escapeDotString(str: string): string {
		return str
			.replace(/\\/g, "\\\\") // Escape backslashes first
			.replace(/"/g, '\\"') // Escape quotes
			.replace(/\n/g, "\\n") // Escape newlines
			.replace(/\r/g, "\\r"); // Escape carriage returns
	}

	private generateDotGraph(): string {
		let dot = "digraph G {\n";
		dot += "    node [shape=box];\n"; // Set node shape
		dot += "    rankdir=LR;\n"; // Set horizontal graph direction

		for (const [moduleName, moduleInfo] of Object.entries(this.json)) {
			const escapedModuleName = this.escapeDotString(moduleName);
			dot += `    "${escapedModuleName}" [label="${escapedModuleName}", style=filled, fillcolor="lightgray"];\n`;

			if (moduleInfo.providers && moduleInfo.providers.length > 0) {
				moduleInfo.providers.forEach((provider, index) => {
					const providerName = `${escapedModuleName}_Provider${index}`;
					const escapedToken = this.escapeDotString(provider.token);
					const escapedType = this.escapeDotString(provider.type);
					const providerLabel = `"${escapedToken} (${escapedType})"`;
					const color = this.typeColors[provider.type] || "white";
					dot += `    "${providerName}" [label=${providerLabel}, style=filled, fillcolor="${color}"];\n`;
					dot += `    "${escapedModuleName}" -> "${providerName}";\n`;
				});
			}

			for (const imp of moduleInfo.imports) {
				const escapedImp = this.escapeDotString(imp);
				dot += `    "${escapedModuleName}" -> "${escapedImp}";\n`;
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
