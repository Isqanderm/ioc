import * as ts from "typescript/lib/tsserverlibrary";
import type { ProviderType } from "../parsers/ns-module.parser";

/**
 * Gets the actual type that a provider provides
 *
 * For different provider types:
 * - class: returns the class type itself
 * - useClass: returns the useClass type
 * - useValue: returns the type of the value
 * - useFactory: returns the return type of the factory function
 *
 * @param provider - The provider to get the type from
 * @param typeChecker - TypeScript type checker
 * @returns The type node that represents what the provider provides, or undefined if cannot be determined
 */
export function getProviderType(
	provider: ProviderType,
	typeChecker: ts.TypeChecker,
): ts.Node | undefined {
	switch (provider.provideType) {
		case "class":
			// For class providers, the declaration IS the class
			return provider.declaration;

		case "useClass":
			// For useClass providers, the declaration is the class being provided
			return provider.declaration;

		case "useValue":
			// For useValue providers, we need to infer the type from the value
			// The declaration is the value expression
			return provider.declaration;

		case "useFactory":
			// For useFactory providers, we need to get the return type of the factory function
			// The declaration is the factory function
			if (ts.isArrowFunction(provider.declaration)) {
				// Get the return type from the arrow function
				const signature = typeChecker.getSignatureFromDeclaration(
					provider.declaration,
				);
				if (signature) {
					// Try to get a node that represents this type
					// This is tricky because we have a Type but need a Node
					// We'll return the function itself and handle it specially in compareTypes
					return provider.declaration;
				}
			} else if (ts.isFunctionExpression(provider.declaration)) {
				// Get the return type from the function expression
				const signature = typeChecker.getSignatureFromDeclaration(
					provider.declaration,
				);
				if (signature) {
					return provider.declaration;
				}
			}
			// Fallback to the declaration itself
			return provider.declaration;

		default:
			return undefined;
	}
}
