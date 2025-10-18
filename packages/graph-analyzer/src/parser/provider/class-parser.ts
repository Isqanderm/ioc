import * as fs from "node:fs";
import * as path from "node:path";
import { query } from "@phenomnomnominal/tsquery";
import * as ts from "typescript";
import type { ProvidersInterface } from "../../interfaces/providers.interface";
import {
	DependencyExtractor,
	type Dependency,
} from "../dependency-extractor";

export class ClassParser implements ProvidersInterface {
	public readonly type = "Class";
	private _dependencies: Dependency[] = [];
	private dependencyExtractor = new DependencyExtractor();

	constructor(
		public readonly _token: string,
		private readonly sourceFile?: ts.SourceFile,
		private readonly currentFilePath?: string,
	) {}

	parse(): this {
		// If we have a source file, extract dependencies
		if (this.sourceFile) {
			this._dependencies = this.extractDependenciesFromClass();
		}
		return this;
	}

	private extractDependenciesFromClass(): Dependency[] {
		if (!this.sourceFile) {
			return [];
		}

		// First, try to find the class in the current file (module file)
		let classDeclaration = this.findClassDeclaration(
			this._token,
			this.sourceFile,
		);
		let targetSourceFile = this.sourceFile;

		// If not found, try to find the import and load the actual class file
		if (!classDeclaration && this.currentFilePath) {
			const classSourceFile = this.findAndLoadClassFile(this._token);
			if (classSourceFile) {
				classDeclaration = this.findClassDeclaration(
					this._token,
					classSourceFile,
				);
				targetSourceFile = classSourceFile;
			}
		}

		if (!classDeclaration) {
			return [];
		}

		// Extract dependencies using the DependencyExtractor
		return this.dependencyExtractor.extractDependencies(
			classDeclaration,
			targetSourceFile,
		);
	}

	private findAndLoadClassFile(className: string): ts.SourceFile | undefined {
		if (!this.sourceFile || !this.currentFilePath) {
			return undefined;
		}

		// Find the import statement for this class
		const importPath = this.findImportPathForClass(className);
		if (!importPath) {
			return undefined;
		}

		// Resolve the full path
		const fullPath = this.resolveImportPath(importPath);
		if (!fullPath || !fs.existsSync(fullPath)) {
			return undefined;
		}

		// Load and parse the file
		try {
			const content = fs.readFileSync(fullPath, "utf8");
			return ts.createSourceFile(
				fullPath,
				content,
				ts.ScriptTarget.Latest,
				true,
			);
		} catch (error) {
			return undefined;
		}
	}

	private findImportPathForClass(className: string): string | undefined {
		if (!this.sourceFile) {
			return undefined;
		}

		// Find import declarations that include this class
		const importDeclarations = query(this.sourceFile, "ImportDeclaration");

		for (const node of importDeclarations) {
			if (!ts.isImportDeclaration(node)) {
				continue;
			}

			const importClause = node.importClause;
			if (!importClause || !importClause.namedBindings) {
				continue;
			}

			// Check named imports
			if (ts.isNamedImports(importClause.namedBindings)) {
				for (const element of importClause.namedBindings.elements) {
					if (element.name.text === className) {
						// Found the import!
						if (ts.isStringLiteral(node.moduleSpecifier)) {
							return node.moduleSpecifier.text;
						}
					}
				}
			}
		}

		return undefined;
	}

	private resolveImportPath(importPath: string): string | undefined {
		if (!this.currentFilePath) {
			return undefined;
		}

		// Skip node_modules
		if (!importPath.startsWith(".")) {
			return undefined;
		}

		const dir = path.dirname(this.currentFilePath);
		let resolved = path.resolve(dir, importPath);

		// Try different extensions
		const extensions = [".ts", ".tsx", "/index.ts", "/index.tsx"];
		for (const ext of extensions) {
			const fullPath = resolved.endsWith(".ts") ? resolved : resolved + ext;
			if (fs.existsSync(fullPath)) {
				return fullPath;
			}
		}

		return undefined;
	}

	private findClassDeclaration(
		className: string,
		sourceFile: ts.SourceFile,
	): ts.ClassDeclaration | undefined {
		// Use tsquery to find the class declaration
		const selector = `ClassDeclaration[name.name="${className}"]`;
		const nodes = query(sourceFile, selector);

		for (const node of nodes) {
			if (ts.isClassDeclaration(node)) {
				return node;
			}
		}

		return undefined;
	}

	get token(): string {
		return this._token;
	}

	get dependencies(): Dependency[] {
		return this._dependencies;
	}
}
