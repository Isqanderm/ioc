import * as ts from "typescript/lib/tsserverlibrary";
import { getTypeOfNode } from "./get-type-of-node.helper";

export function compareTypes(
	keywordNode: ts.Node | undefined, // Узел с типом (например, StringKeyword, NumberKeyword и т.д.)
	literalNode: ts.Node | undefined, // Узел с литералом или выражением
	typeChecker: ts.TypeChecker,
): boolean {
	if (!keywordNode || !literalNode) {
		return false;
	}

	const keywordType = getTypeOfNode(keywordNode, typeChecker);
	const literalType = getTypeOfNode(literalNode, typeChecker);

	if (!keywordType || !literalType) {
		return false;
	}

	// Reject if the provider type (literalType) is null or undefined
	// This prevents providers from providing null/undefined values
	if (
		literalType.flags & ts.TypeFlags.Null ||
		literalType.flags & ts.TypeFlags.Undefined
	) {
		return false;
	}

	// For optional parameters (Type | undefined), we need to handle union types
	// The parameter type might be a union type like "LoggerService | undefined"
	// The provider type should be just "LoggerService"
	// TypeScript's isTypeAssignableTo handles this correctly:
	// LoggerService IS assignable to LoggerService | undefined

	// Check if the parameter type is a union type (e.g., Type | undefined for optional params)
	if (keywordType.flags & ts.TypeFlags.Union) {
		// For union types, check if the provider type is assignable to the union
		// This handles cases like: LoggerService (provider) -> LoggerService | undefined (parameter)
		return typeChecker.isTypeAssignableTo(literalType, keywordType);
	}

	// For non-union types, reject if the parameter type is null or undefined
	// This prevents parameters from being typed as just null or undefined
	if (
		keywordType.flags & ts.TypeFlags.Null ||
		keywordType.flags & ts.TypeFlags.Undefined
	) {
		return false;
	}

	// Проверяем, можно ли привести тип литерала к базовому типу
	return typeChecker.isTypeAssignableTo(literalType, keywordType);
}

// Специализированные функции для удобства использования
export const compareStringTypes = compareTypes;
export const compareNumberTypes = compareTypes;
export const compareBooleanTypes = compareTypes;
export const compareBigIntTypes = compareTypes;
export const compareSymbolTypes = compareTypes;
