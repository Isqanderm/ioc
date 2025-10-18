import * as fs from "node:fs";
import * as path from "node:path";
import { ast, query } from "@phenomnomnominal/tsquery";
import * as ts from "typescript";
import { rules } from "./rules";

function findAllImports(entryFilePath: string) {
	const alreadyVisited = new Set<string>();
	const filesToVisit = [entryFilePath];

	while (filesToVisit.length > 0) {
		const currentFile = filesToVisit.pop() as string;
		if (alreadyVisited.has(currentFile)) {
			continue;
		}

		alreadyVisited.add(currentFile);

		const content = fs.readFileSync(currentFile, "utf8");
		const sourceFile = ts.createSourceFile(
			currentFile,
			content,
			ts.ScriptTarget.Latest,
			true,
		);
		const contentAst = ast(sourceFile.text);
		const importNodes = query(contentAst, "ImportDeclaration");

		for (const node of importNodes) {
			if (
				ts.isImportDeclaration(node) &&
				node.moduleSpecifier &&
				ts.isStringLiteral(node.moduleSpecifier)
			) {
				let moduleName = node.moduleSpecifier.text;
				if (!moduleName.startsWith(".")) {
					continue; // Пропуск модулей из node_modules
				}

				moduleName = path.resolve(path.dirname(currentFile), moduleName);

				if (!moduleName.endsWith(".ts")) {
					if (fs.existsSync(`${moduleName}/index.ts`)) {
						moduleName += "/index.ts";
					} else if (fs.existsSync(`${moduleName}/index.tsx`)) {
						moduleName += "/index.tsx";
					} else {
						moduleName += ".ts";
					}
				}

				if (fs.existsSync(moduleName) && !alreadyVisited.has(moduleName)) {
					filesToVisit.push(moduleName);
				}
			}
		}

		for (const rule of rules) {
			const result = query(contentAst, rule.rule);

			if (!result.length) {
				break;
			}

			rule.name ?? console.group(rule.name);
			rule.callback?.(result, sourceFile);
			rule.name ?? console.groupEnd();
		}
	}

	console.log("Обработанные файлы:", alreadyVisited);
}

const entryPath = path.resolve("./example/entry.ts");
findAllImports(entryPath);
