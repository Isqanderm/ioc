import { tsquery } from "@phenomnomnominal/tsquery";
import type * as ts from "typescript/lib/tsserverlibrary";
import type { Logger } from "../logger";

export type InjectParameterDeclaration = {
	name: ts.Identifier | ts.StringLiteral;
	location: "constructor" | "property";
	declaration: ts.ParameterDeclaration;
	start: number;
	end: number;
	length: number;
	parameterName: string;
	parameterType?: ts.TypeReferenceType | ts.Node;
};

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class InjectParser {
	public static execute(classDeclaration: ts.ClassDeclaration, logger: Logger) {
		const params: InjectParameterDeclaration[] = [];
		logger.log(`[InjectParser][execute] ${classDeclaration.getText()}`);
		const injectConstructorParams = tsquery.query<ts.ParameterDeclaration>(
			classDeclaration,
			`Constructor > Parameter:has(Decorator > CallExpression > Identifier[name="Inject"])`,
		);

		for (const injectConstructorParam of injectConstructorParams) {
			const [dependencyStringName] =
				tsquery.query<ts.StringLiteral>(
					injectConstructorParam,
					"Decorator > CallExpression StringLiteral",
				) || [];
			const [dependencyLink] =
				tsquery.query<ts.Identifier>(
					injectConstructorParam,
					"Decorator > CallExpression Identifier:not([name='Inject'])",
				) || [];

			const dependencyName = dependencyStringName || dependencyLink;

			if (!dependencyName) {
				continue;
			}

			const start = injectConstructorParam.getStart();
			const end = injectConstructorParam.getEnd();
			const parameterName = injectConstructorParam.name.getText();
			const parameterType = InjectParser.getParameterTypeNode(
				injectConstructorParam,
			);

			params.push({
				name: dependencyName,
				location: "constructor",
				declaration: injectConstructorParam,
				start,
				end,
				length: end - start,
				parameterName,
				parameterType,
			});
		}

		// const injectPropertyParams = tsquery.query<ts.PropertyDeclaration>(
		// 	classDeclaration,
		// 	selectorInjectProperty,
		// );

		return params;
	}

	private static getParameterTypeNode(param: ts.ParameterDeclaration) {
		return param.type;
	}
}
