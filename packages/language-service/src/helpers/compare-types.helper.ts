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

	// Проверяем специальные случаи для null и undefined
	if (
		literalType.flags & ts.TypeFlags.Null ||
		literalType.flags & ts.TypeFlags.Undefined ||
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
