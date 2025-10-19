import { tsquery } from "@phenomnomnominal/tsquery";
import * as ts from "typescript/lib/tsserverlibrary";
import type { ILogger } from "../types/logger.interface";

export type InjectParameterDeclaration = {
	name: ts.Identifier | ts.StringLiteral;
	location: "constructor" | "property";
	declaration: ts.ParameterDeclaration | ts.PropertyDeclaration;
	start: number;
	end: number;
	length: number;
	parameterName: string;
	parameterType?: ts.TypeReferenceType | ts.Node;
	isOptional: boolean;
};

// biome-ignore lint/complexity/noStaticOnlyClass: static-only class provides namespace for related parsing methods
export class InjectParser {
	/**
	 * Extracts all @Inject decorated parameters and properties from a class declaration
	 *
	 * @param classDeclaration - The class to analyze
	 * @param logger - Logger instance for debugging
	 * @returns Array of inject parameter/property declarations with metadata
	 */
	public static execute(
		classDeclaration: ts.ClassDeclaration,
		logger: ILogger,
	) {
		const params: InjectParameterDeclaration[] = [];
		const className = classDeclaration.name?.text || "AnonymousClass";
		logger.log(`[InjectParser][execute] ${className}`);

		// Parse constructor parameters with @Inject decorator
		const injectConstructorParams = tsquery.query<ts.ParameterDeclaration>(
			classDeclaration,
			`Constructor > Parameter:has(Decorator > CallExpression > Identifier[name="Inject"])`,
		);

		for (const injectConstructorParam of injectConstructorParams) {
			const [dependencyStringName] =
				tsquery.query<ts.StringLiteral>(
					injectConstructorParam,
					"Decorator > CallExpression:has(Identifier[name='Inject']) StringLiteral",
				) || [];
			const [dependencyLink] =
				tsquery.query<ts.Identifier>(
					injectConstructorParam,
					"Decorator > CallExpression:has(Identifier[name='Inject']) Identifier:not([name='Inject'])",
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
			const isOptional = InjectParser.hasOptionalDecoratorOnParameter(
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
				isOptional,
			});
		}

		// Parse properties with @Inject decorator
		const injectPropertyParams = tsquery.query<ts.PropertyDeclaration>(
			classDeclaration,
			`PropertyDeclaration:has(Decorator > CallExpression > Identifier[name="Inject"])`,
		);

		for (const injectPropertyParam of injectPropertyParams) {
			const [dependencyStringName] =
				tsquery.query<ts.StringLiteral>(
					injectPropertyParam,
					"Decorator > CallExpression:has(Identifier[name='Inject']) StringLiteral",
				) || [];
			const [dependencyLink] =
				tsquery.query<ts.Identifier>(
					injectPropertyParam,
					"Decorator > CallExpression:has(Identifier[name='Inject']) Identifier:not([name='Inject'])",
				) || [];

			const dependencyName = dependencyStringName || dependencyLink;

			if (!dependencyName) {
				continue;
			}

			const start = injectPropertyParam.getStart();
			const end = injectPropertyParam.getEnd();
			const parameterName = injectPropertyParam.name.getText();
			const parameterType =
				InjectParser.getPropertyTypeNode(injectPropertyParam);
			const isOptional =
				InjectParser.hasOptionalDecoratorOnProperty(injectPropertyParam);

			params.push({
				name: dependencyName,
				location: "property",
				declaration: injectPropertyParam,
				start,
				end,
				length: end - start,
				parameterName,
				parameterType,
				isOptional,
			});
		}

		return params;
	}

	/**
	 * Checks if a constructor parameter has the @Optional() decorator
	 *
	 * @param param - The parameter declaration to check
	 * @returns True if the parameter has @Optional decorator
	 */
	private static hasOptionalDecoratorOnParameter(
		param: ts.ParameterDeclaration,
	): boolean {
		if (!param.modifiers) {
			return false;
		}

		for (const modifier of param.modifiers) {
			if (ts.isDecorator(modifier)) {
				const expression = modifier.expression;
				// Handle @Optional() - call expression
				if (ts.isCallExpression(expression)) {
					const identifier = expression.expression;
					if (ts.isIdentifier(identifier) && identifier.text === "Optional") {
						return true;
					}
				}
				// Handle @Optional - identifier (without parentheses)
				else if (
					ts.isIdentifier(expression) &&
					expression.text === "Optional"
				) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Checks if a property has the @Optional() decorator
	 *
	 * @param property - The property declaration to check
	 * @returns True if the property has @Optional decorator
	 */
	private static hasOptionalDecoratorOnProperty(
		property: ts.PropertyDeclaration,
	): boolean {
		if (!property.modifiers) {
			return false;
		}

		for (const modifier of property.modifiers) {
			if (ts.isDecorator(modifier)) {
				const expression = modifier.expression;
				// Handle @Optional() - call expression
				if (ts.isCallExpression(expression)) {
					const identifier = expression.expression;
					if (ts.isIdentifier(identifier) && identifier.text === "Optional") {
						return true;
					}
				}
				// Handle @Optional - identifier (without parentheses)
				else if (
					ts.isIdentifier(expression) &&
					expression.text === "Optional"
				) {
					return true;
				}
			}
		}

		return false;
	}

	private static getParameterTypeNode(param: ts.ParameterDeclaration) {
		return param.type;
	}

	private static getPropertyTypeNode(property: ts.PropertyDeclaration) {
		return property.type;
	}
}
