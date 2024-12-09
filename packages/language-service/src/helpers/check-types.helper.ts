import * as ts from "typescript/lib/tsserverlibrary";
import type { Logger } from "../logger";

export const checkTypesHelper = (
	type1: ts.Node,
	type2: ts.Node,
	typeChecker: ts.TypeChecker,
	logger: Logger,
): boolean => {
	// Получаем символы для type1 и type2
	const symbol1 = ts.isIdentifier(type1)
		? typeChecker.getSymbolAtLocation(type1)
		: typeChecker.getTypeAtLocation(type1).getSymbol();

	const symbol2 = ts.isIdentifier(type2)
		? typeChecker.getSymbolAtLocation(type2)
		: typeChecker.getTypeAtLocation(type2).getSymbol();

	if (!symbol1 || !symbol2) {
		return false;
	}

	if (ts.isIdentifier(type1) && ts.isIdentifier(type2)) {
		return (
			symbol1.escapedName === symbol2.escapedName &&
			symbol1.declarations?.[-1]?.getSourceFile().fileName ===
				symbol2.declarations?.[-1]?.getSourceFile().fileName
		);
	}

	// Получаем типы по символам
	const typeLocation1 = typeChecker.getTypeOfSymbolAtLocation(symbol1, type1);
	const typeLocation2 = typeChecker.getTypeOfSymbolAtLocation(symbol2, type2);

	// Проверяем, что типы взаимно совместимы
	return (
		typeChecker.isTypeAssignableTo(typeLocation1, typeLocation2) &&
		typeChecker.isTypeAssignableTo(typeLocation2, typeLocation1)
	);
};
