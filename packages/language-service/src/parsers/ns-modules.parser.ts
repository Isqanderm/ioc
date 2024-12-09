import { tsquery } from "@phenomnomnominal/tsquery";
import type * as ts from "typescript/lib/tsserverlibrary";
import { checkTypesHelper } from "../helpers/check-types.helper";
import type { Logger } from "../logger";

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class NsModulesParser {
	public static execute(sourceFile: ts.SourceFile): ts.ClassDeclaration[] {
		return tsquery.query<ts.ClassDeclaration>(
			sourceFile,
			`ClassDeclaration:has(Decorator > CallExpression > Identifier[name="NsModule"])`,
		);
	}

	public static executeByClassDependency(
		sourceFile: ts.SourceFile,
		classDependency: ts.ClassDeclaration,
		logger: Logger,
	) {
		const modules = NsModulesParser.execute(sourceFile);
		const result: ts.ClassDeclaration[] = [];

		for (const module of modules) {
			const [existModule] =
				tsquery<ts.ClassDeclaration>(
					module,
					`Decorator PropertyAssignment:has(Identifier[name="providers"]) ArrayLiteralExpression Identifier[name="${classDependency.name?.text}"]`,
				) || [];

			if (existModule) {
				result.push(module);
			}
		}

		return result;
	}

	public static executeByModuleName(
		sourceFile: ts.SourceFile,
		moduleDeclaration: ts.Identifier,
		typeChecker: ts.TypeChecker,
		logger: Logger,
	): ts.ClassDeclaration[] {
		const modules = NsModulesParser.execute(sourceFile);
		const result: ts.ClassDeclaration[] = [];

		for (const module of modules) {
			const moduleIsEqual = checkTypesHelper(
				module,
				moduleDeclaration,
				typeChecker,
				logger,
			);

			if (moduleIsEqual) {
				result.push(module);
			}
		}

		return result;
	}
}
