import { ast, query } from "@phenomnomnominal/tsquery";
import type * as ts from "typescript";

export class ParseEntryFile {
	private readonly ast: ReturnType<typeof ast>;

	constructor(
		private readonly sourceFile: ts.SourceFile,
		private readonly currentFilePath: string,
	) {
		this.ast = ast(sourceFile.text);
	}
}
