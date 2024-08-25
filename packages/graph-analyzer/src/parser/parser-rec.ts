import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { GraphAnalyzer } from "../visualize/graph-analyzer";
import { ParseEntryFile } from "./parse-entry-file";
import { ParseNsModule } from "./parse-ns-module";
import { ParseTsConfig } from "./parse-ts-config";

interface ModuleGraph {
	[key: string]: string[];
}

const modulesGraph = new Map<string, ParseNsModule | ParseEntryFile>();

async function buildDependencyGraph(
	entryFile: string,
	tsConfig: ParseTsConfig,
): Promise<ModuleGraph> {
	const graph: ModuleGraph = {};
	const filesToProcess: string[] = [entryFile];

	while (filesToProcess.length) {
		const currentFile = filesToProcess.pop() as string;
		if (graph[currentFile]) {
			continue;
		}

		const content = fs.readFileSync(currentFile, "utf8");
		const sourceFile = ts.createSourceFile(
			currentFile,
			content,
			ts.ScriptTarget.Latest,
			true,
		);

		const nsModuleParser = new ParseNsModule(sourceFile, currentFile, tsConfig);
		nsModuleParser.parse();

		modulesGraph.set(nsModuleParser.name as string, nsModuleParser);

		graph[currentFile] = nsModuleParser.deps;
		filesToProcess.push(...nsModuleParser.deps);
	}

	return graph;
}

async function parseEntryPoint(
	entryFile: string,
	tsConfig: string,
	basePath: string,
) {
	const content = fs.readFileSync(entryFile, "utf8");
	const config = fs.readFileSync(tsConfig, "utf8");
	const sourceFile = ts.createSourceFile(
		entryFile,
		content,
		ts.ScriptTarget.Latest,
		true,
	);

	const parseTsConfig = new ParseTsConfig(config, basePath);
	const parseEntryFile = new ParseEntryFile(
		sourceFile,
		entryFile,
		parseTsConfig,
	);

	parseEntryFile.parse();

	if (!parseEntryFile.name) {
		throw new Error("No entry module");
	}

	modulesGraph.set("entry", parseEntryFile);

	return await buildDependencyGraph(parseEntryFile.imports[0], parseTsConfig);
}

const entryPath = path.resolve("./example/src/entry.ts");
const tsConfig = path.resolve("./example/tsconfig.json");
const basePath = path.resolve("./example");
parseEntryPoint(entryPath, tsConfig, basePath).then((graph) => {
	// console.log("Граф зависимостей:", graph);

	new GraphAnalyzer(modulesGraph).parse();
});
