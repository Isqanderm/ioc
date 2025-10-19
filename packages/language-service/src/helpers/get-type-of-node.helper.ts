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

	// 6) Если это arrow function или function expression (для useFactory)
	if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
		const signature = checker.getSignatureFromDeclaration(node);
		if (signature) {
			// Return the return type of the function
			return checker.getReturnTypeOfSignature(signature);
		}
	}

	// 7) Special handling for TypeReferenceNode (e.g., DatabaseService, LoggerService)
	// This is important for comparing reference types between providers and parameters
	if (ts.isTypeReferenceNode(node)) {
		const parent = node.parent;

		// If the parent is a parameter declaration with a question token
		if (ts.isParameter(parent) && parent.questionToken && parent.type === node) {
			// Get the type from the parameter declaration, which includes the | undefined
			return checker.getTypeAtLocation(parent);
		}

		// If the parent is a property declaration with a question token
		if (ts.isPropertyDeclaration(parent) && parent.questionToken && parent.type === node) {
			// Get the type from the property declaration, which includes the | undefined
			return checker.getTypeAtLocation(parent);
		}

		// For non-optional type references, get the type from the type reference node
		// This ensures we get the correct instance type for class references
		return checker.getTypeAtLocation(node);
	}

	// 8) Special handling for other type nodes from optional parameters/properties
	// This applies to any type node (KeywordTypeNode, etc.)
	const parent = node.parent;

	// If the parent is a parameter declaration with a question token
	if (ts.isParameter(parent) && parent.questionToken && parent.type === node) {
		// Get the type from the parameter declaration, which includes the | undefined
		return checker.getTypeAtLocation(parent);
	}

	// If the parent is a property declaration with a question token
	if (ts.isPropertyDeclaration(parent) && parent.questionToken && parent.type === node) {
		// Get the type from the property declaration, which includes the | undefined
		return checker.getTypeAtLocation(parent);
	}

	// ... при необходимости обрабатываем другие случаи (EnumDeclaration, etc.)

	// 9) Special handling for Identifier nodes (e.g., DatabaseService in providers array)
	// When an identifier references a class, we need to get the instance type, not the constructor type
	if (ts.isIdentifier(node)) {
		const symbol = checker.getSymbolAtLocation(node);
		if (symbol) {
			// Check if this symbol represents a class
			const declarations = symbol.getDeclarations();
			if (declarations && declarations.length > 0) {
				const firstDecl = declarations[0];
				// If it's a class declaration, return the instance type
				if (ts.isClassDeclaration(firstDecl)) {
					return checker.getDeclaredTypeOfSymbol(symbol);
				}
			}
		}
	}

	// 10) По умолчанию берём тип текущего узла
	return checker.getTypeAtLocation(node);
}
