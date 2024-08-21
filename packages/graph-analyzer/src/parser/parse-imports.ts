import fs from "node:fs";
import path from "node:path";
import { ast, query } from "@phenomnomnominal/tsquery";
import * as ts from "typescript";
import type { ParseTsConfig } from "./parse-ts-config";

const extensions = ["ts", "tsx"];

export class ParseImports {
	private readonly nsModuleImportPattern = (moduleName: string) =>
		`ImportDeclaration:has(NamedImports:has(ImportSpecifier:has(Identifier[name="${moduleName}"])))`;
	private readonly ast: ReturnType<typeof ast>;

	constructor(
		private readonly sourceFile: ts.SourceFile,
		private readonly currentFilePath: string,
		private readonly tsConfig: ParseTsConfig,
	) {
		this.ast = ast(sourceFile.text);
	}

	public findAllNsModuleImports(moduleDeps: string[]) {
		const moduleImports: string[] = [];

		for (const moduleName of moduleDeps) {
			const [moduleImport] =
				query(this.ast, this.nsModuleImportPattern(moduleName)) || [];

			if (!moduleImport) {
				throw new Error(
					`"${moduleName}" module import not found in "${this.currentFilePath}"`,
				);
			}

			if (
				!(
					ts.isImportDeclaration(moduleImport) &&
					ts.isStringLiteral(moduleImport.moduleSpecifier)
				)
			) {
				throw new Error(
					`Module ${moduleImport} not correct in ${this.currentFilePath}`,
				);
			}

			const actualPath = this.checkFilePath(
				moduleImport.moduleSpecifier.text,
				this.currentFilePath,
			);

			const importPath = path.resolve(
				path.dirname(this.currentFilePath),
				actualPath,
			);

			moduleImports.push(importPath);
		}

		return moduleImports;
	}

	private isRelativeImport(path: string) {
		return path.startsWith(".");
	}

	private checkExtension(importPath: string, baseDir: string) {
		for (const extension of extensions) {
			const importTSFilePath = path.resolve(
				baseDir,
				`${importPath}.${extension}`,
			);
			const importIndexFilePath = path.resolve(
				baseDir,
				importPath,
				`index.${extension}`,
			);
			if (fs.existsSync(importTSFilePath)) {
				return importTSFilePath;
			}

			if (fs.existsSync(importIndexFilePath)) {
				return importIndexFilePath;
			}
		}

		return importPath;
	}

	private checkFilePath(importPath: string, currentFilePath: string) {
		if (this.isRelativeImport(importPath)) {
			if (
				extensions.find((extension) => importPath.endsWith(`.${extension}`))
			) {
				return importPath;
			}

			const baseDir = path.dirname(currentFilePath);

			return this.checkExtension(importPath, baseDir);
		}

		const basePath = this.tsConfig.getSrcBasePath();

		return this.checkExtension(
			this.tsConfig.resolveAliasPath(importPath),
			basePath,
		);
	}

	public parse() {}
}
