import * as fs from "node:fs";
import * as path from "node:path";
import { ast, query } from "@phenomnomnominal/tsquery";
import * as ts from "typescript";
import { ParseNsModule } from "./parse-ns-module";
import { ParseTsConfig } from "./parse-ts-config";

interface ModuleGraph {
	[key: string]: string[];
}

const modulesGraph = new Map<string, ParseNsModule>();

async function buildDependencyGraph(
	entryFile: string,
	entryModule: string,
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

		console.log(
			"nsModuleParser: ",
			nsModuleParser.imports,
			nsModuleParser.providers,
			nsModuleParser.exports,
		);
		// modulesGraph.set(parentModule, nsModuleParser)

		graph[currentFile] = nsModuleParser.deps;
		filesToProcess.push(...nsModuleParser.deps);
	}

	return graph;
}

function getAllImports(currentFile: ts.SourceFile, basePath: string) {
	const importNodes = query(ast(currentFile.text), "ImportDeclaration");
	const imports: string[] = [];

	for (const node of importNodes) {
		if (
			ts.isImportDeclaration(node) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			let moduleName = node.moduleSpecifier.text;
			if (!moduleName.startsWith(".")) continue;

			moduleName = path.resolve(path.dirname(basePath), moduleName);

			if (!moduleName.endsWith(".ts")) {
				if (fs.existsSync(`${moduleName}/index.ts`)) {
					moduleName += "/index.ts";
				} else if (fs.existsSync(`${moduleName}/index.tsx`)) {
					moduleName += "/index.tsx";
				} else {
					moduleName += ".ts";
				}
			}

			if (!fs.existsSync(moduleName)) {
				continue;
			}

			imports.push(moduleName);
		}
	}

	return imports;
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

	const sourceText = sourceFile.text;
	const nodes = query(ast(sourceText), "CallExpression");
	let entryModule: string | null = null;

	for (const node of nodes) {
		const text = node.getText();
		const match = text.match(/\.create\((\w+)\)/);

		if (match) {
			entryModule = match[1];
		}
	}

	if (!entryModule) {
		console.error("No entry module");
		return;
	}
	const parseTsConfig = new ParseTsConfig(config, basePath);

	const imports = getAllImports(sourceFile, entryFile);
	return await buildDependencyGraph(imports[0], entryModule, parseTsConfig);
}

const entryPath = path.resolve("./example/src/entry.ts");
const tsConfig = path.resolve("./example/tsconfig.json");
const basePath = path.resolve("./example");
parseEntryPoint(entryPath, tsConfig, basePath).then((graph) => {
	console.log("Граф зависимостей:", graph);
});
