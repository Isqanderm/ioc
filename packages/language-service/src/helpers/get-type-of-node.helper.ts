import * as ts from "typescript/lib/tsserverlibrary";

export function getTypeOfNode(
	node: ts.Node,
	checker: ts.TypeChecker,
): ts.Type | undefined {
	// 1) Если это класс (ClassDeclaration)
	if (ts.isClassDeclaration(node) && node.name) {
		const symbol = checker.getSymbolAtLocation(node.name);
		if (symbol) {
			// Вместо конструктора (typeof ClassName) вернём «экземплярный» тип (ClassName)
			return checker.getDeclaredTypeOfSymbol(symbol);
		}
	}

	// 2) Если это интерфейс (InterfaceDeclaration)
	if (ts.isInterfaceDeclaration(node) && node.name) {
		const symbol = checker.getSymbolAtLocation(node.name);
		if (symbol) {
			return checker.getDeclaredTypeOfSymbol(symbol);
		}
	}

	// 3) Если это type-алиас (TypeAliasDeclaration)
	if (ts.isTypeAliasDeclaration(node) && node.name) {
		const symbol = checker.getSymbolAtLocation(node.name);
		if (symbol) {
			return checker.getDeclaredTypeOfSymbol(symbol);
		}
	}

	// 4) Если это переменная (VariableStatement)
	//    Обычно берём первую декларацию (если в одном statement объявлено несколько переменных).
	if (ts.isVariableStatement(node)) {
		const [decl] = node.declarationList.declarations;
		if (!decl) {
			return undefined;
		}

		// Если есть инициализатор, получим тип именно из инициализатора
		if (decl.initializer) {
			return checker.getTypeAtLocation(decl.initializer);
		}

		// Иначе — из имени
		return checker.getTypeAtLocation(decl.name);
	}

	// 5) Если это функция (FunctionDeclaration)
	if (ts.isFunctionDeclaration(node) && node.name) {
		const symbol = checker.getSymbolAtLocation(node.name);
		if (symbol) {
			return checker.getTypeOfSymbolAtLocation(symbol, node);
		}
	}

	// ... при необходимости обрабатываем другие случаи (EnumDeclaration, etc.)

	// 6) По умолчанию берём тип текущего узла
	return checker.getTypeAtLocation(node);
}
