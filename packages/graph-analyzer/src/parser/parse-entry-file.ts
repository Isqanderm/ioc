import { ast, query } from "@phenomnomnominal/tsquery";
import type * as ts from "typescript";
import { ParseImports } from "./parse-imports";
import type { ParseTsConfig } from "./parse-ts-config";

export class ParseEntryFile {
	private readonly ast: ReturnType<typeof ast>;
	private readonly _imports: string[] = [];
	private _name: string | null = null;

	constructor(
		private readonly sourceFile: ts.SourceFile,
		private readonly _currentFilePath: string,
		private readonly tsConfig: ParseTsConfig,
	) {
		this.ast = ast(sourceFile.text);
	}

	parse() {
		const sourceText = this.sourceFile.text;
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
			throw new Error("No entry module");
		}

		this._name = entryModule;
		this._imports.push(...this.findNsModulesImports([entryModule]));

		return entryModule;
	}

	private findNsModulesImports(imports: string[]) {
		return new ParseImports(
			this.sourceFile,
			this._currentFilePath,
			this.tsConfig,
		).findAllNsModuleImports(imports);
	}

	get filePath(): string {
		return this._currentFilePath;
	}

	get imports(): string[] {
		return this._imports;
	}

	get name(): string | null {
		return this._name;
	}
}
