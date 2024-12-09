// Сравнение типа StringKeyword и StringLiteral
import type ts from "typescript/lib/tsserverlibrary";
import { getTypeOfNode } from "./get-type-of-node.helper";

export function compareStringTypes(
	keywordNode: ts.Node, // Узел с типом string (StringKeyword)
	literalNode: ts.Node, // Узел со строковым литералом (StringLiteral)
	typeChecker: ts.TypeChecker,
): boolean {
	const keywordType = getTypeOfNode(keywordNode, typeChecker);
	const literalType = getTypeOfNode(literalNode, typeChecker);

	if (!keywordType || !literalType) {
		return false;
	}

	// Проверяем, можно ли строковый литерал привести к string
	return typeChecker.isTypeAssignableTo(literalType, keywordType);
}
