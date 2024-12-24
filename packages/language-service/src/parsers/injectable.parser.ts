import { type SourceFile, tsquery } from "@phenomnomnominal/tsquery";
import type * as ts from "typescript/lib/tsserverlibrary";

const selector = `ClassDeclaration:has(Decorator > CallExpression > Identifier[name="Injectable"])`;

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class InjectableParser {
	public static execute(sourceFile: SourceFile) {
		return tsquery.query<ts.ClassDeclaration>(sourceFile, selector);
	}
}
