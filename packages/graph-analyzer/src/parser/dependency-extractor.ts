import * as ts from "typescript";

/**
 * Represents a dependency extracted from a class
 */
export interface Dependency {
	/** Type of dependency: constructor parameter or property */
	type: "constructor" | "property";
	/** Parameter index (for constructor dependencies) */
	index?: number;
	/** Property key (for property dependencies) */
	key?: string;
	/** The dependency token (class name, string, or symbol) */
	token: string;
	/** Type of the token */
	tokenType: "class" | "string" | "symbol";
	/** Whether the dependency is optional */
	optional: boolean;
	/** Whether the dependency has an explicit @Inject decorator */
	hasExplicitDecorator: boolean;
	/** Raw AST text for debugging */
	raw?: string;
}

/**
 * Extracts dependency injection metadata from TypeScript class declarations
 * using static AST parsing (no runtime execution required)
 */
export class DependencyExtractor {
	/**
	 * Extract all dependencies from a class declaration
	 * @param classDeclaration The TypeScript class declaration node
	 * @param sourceFile The source file containing the class
	 * @returns Array of extracted dependencies
	 */
	public extractDependencies(
		classDeclaration: ts.ClassDeclaration,
		sourceFile: ts.SourceFile,
	): Dependency[] {
		const dependencies: Dependency[] = [];

		// Extract constructor dependencies
		const constructorDeps = this.extractConstructorDependencies(
			classDeclaration,
			sourceFile,
		);
		dependencies.push(...constructorDeps);

		// Extract property dependencies
		const propertyDeps = this.extractPropertyDependencies(
			classDeclaration,
			sourceFile,
		);
		dependencies.push(...propertyDeps);

		// Extract TC39 Stage 3 static dependencies (if present)
		const staticDeps = this.extractStaticDependencies(
			classDeclaration,
			sourceFile,
		);
		if (staticDeps.length > 0) {
			// Static dependencies override decorator-based dependencies
			return staticDeps;
		}

		return dependencies;
	}

	/**
	 * Extract dependencies from constructor parameters with @Inject decorators
	 * or from TypeScript type annotations (Reflection-based DI)
	 */
	private extractConstructorDependencies(
		classDeclaration: ts.ClassDeclaration,
		sourceFile: ts.SourceFile,
	): Dependency[] {
		const dependencies: Dependency[] = [];
		const constructorNode = this.findConstructor(classDeclaration);

		if (!constructorNode || !constructorNode.parameters) {
			return dependencies;
		}

		constructorNode.parameters.forEach((param, index) => {
			const injectDecorator = this.findInjectDecorator(param);

			if (injectDecorator) {
				// Explicit @Inject decorator found
				const { token, tokenType } = this.extractTokenFromDecorator(
					injectDecorator,
					sourceFile,
				);
				const optional = this.hasOptionalDecorator(param);

				dependencies.push({
					type: "constructor",
					index,
					token,
					tokenType,
					optional,
					hasExplicitDecorator: true,
					raw: param.getText(sourceFile),
				});
			} else {
				// No @Inject decorator - try to extract from TypeScript type annotation
				// This supports Reflection-based DI (emitDecoratorMetadata)
				const typeInfo = this.extractTypeFromParameter(param, sourceFile);
				if (typeInfo) {
					const optional = this.isParameterOptional(param);

					dependencies.push({
						type: "constructor",
						index,
						token: typeInfo.token,
						tokenType: typeInfo.tokenType,
						optional,
						hasExplicitDecorator: false,
						raw: param.getText(sourceFile),
					});
				}
			}
		});

		return dependencies;
	}

	/**
	 * Extract dependencies from class properties with @Inject decorators
	 */
	private extractPropertyDependencies(
		classDeclaration: ts.ClassDeclaration,
		sourceFile: ts.SourceFile,
	): Dependency[] {
		const dependencies: Dependency[] = [];

		for (const member of classDeclaration.members) {
			if (!ts.isPropertyDeclaration(member)) {
				continue;
			}

			const injectDecorator = this.findInjectDecorator(member);

			if (injectDecorator) {
				const { token, tokenType } = this.extractTokenFromDecorator(
					injectDecorator,
					sourceFile,
				);
				const optional = this.hasOptionalDecorator(member);
				const key = this.getPropertyName(member);

				if (key) {
					dependencies.push({
						type: "property",
						key,
						token,
						tokenType,
						optional,
						hasExplicitDecorator: true,
						raw: member.getText(sourceFile),
					});
				}
			}
		}

		return dependencies;
	}

	/**
	 * Extract dependencies from TC39 Stage 3 static dependencies array
	 * Example: static dependencies = [{ index: 0, token: DatabaseService, optional: false }]
	 */
	private extractStaticDependencies(
		classDeclaration: ts.ClassDeclaration,
		sourceFile: ts.SourceFile,
	): Dependency[] {
		const dependencies: Dependency[] = [];

		for (const member of classDeclaration.members) {
			if (
				!ts.isPropertyDeclaration(member) ||
				!this.hasStaticModifier(member)
			) {
				continue;
			}

			const propertyName = this.getPropertyName(member);
			if (propertyName !== "dependencies") {
				continue;
			}

			// Found static dependencies property
			if (member.initializer && ts.isArrayLiteralExpression(member.initializer)) {
				for (const element of member.initializer.elements) {
					if (ts.isObjectLiteralExpression(element)) {
						const dep = this.parseStaticDependencyObject(element, sourceFile);
						if (dep) {
							dependencies.push(dep);
						}
					}
				}
			}
		}

		return dependencies;
	}

	/**
	 * Parse a single static dependency object
	 * Example: { index: 0, token: DatabaseService, optional: false }
	 */
	private parseStaticDependencyObject(
		obj: ts.ObjectLiteralExpression,
		sourceFile: ts.SourceFile,
	): Dependency | null {
		let index: number | undefined;
		let token: string | undefined;
		let tokenType: "class" | "string" | "symbol" = "class";
		let optional = false;

		for (const prop of obj.properties) {
			if (!ts.isPropertyAssignment(prop)) {
				continue;
			}

			const name = this.getPropertyName(prop);
			const value = prop.initializer;

			if (name === "index" && ts.isNumericLiteral(value)) {
				index = Number.parseInt(value.text, 10);
			} else if (name === "token") {
				if (ts.isIdentifier(value)) {
					token = value.text;
					tokenType = "class";
				} else if (ts.isStringLiteral(value)) {
					token = value.text;
					tokenType = "string";
				}
			} else if (name === "optional" && value.kind === ts.SyntaxKind.TrueKeyword) {
				optional = true;
			}
		}

		if (index !== undefined && token) {
			return {
				type: "constructor",
				index,
				token,
				tokenType,
				optional,
				hasExplicitDecorator: true, // Static dependencies are explicit
				raw: obj.getText(sourceFile),
			};
		}

		return null;
	}

	/**
	 * Find the constructor in a class declaration
	 */
	private findConstructor(
		classDeclaration: ts.ClassDeclaration,
	): ts.ConstructorDeclaration | undefined {
		for (const member of classDeclaration.members) {
			if (ts.isConstructorDeclaration(member)) {
				return member;
			}
		}
		return undefined;
	}

	/**
	 * Find @Inject decorator on a parameter or property
	 */
	private findInjectDecorator(
		node: ts.ParameterDeclaration | ts.PropertyDeclaration,
	): ts.Decorator | undefined {
		if (!node.modifiers) {
			return undefined;
		}

		for (const modifier of node.modifiers) {
			if (ts.isDecorator(modifier)) {
				const expression = modifier.expression;
				if (ts.isCallExpression(expression)) {
					const identifier = expression.expression;
					if (ts.isIdentifier(identifier) && identifier.text === "Inject") {
						return modifier;
					}
				}
			}
		}

		return undefined;
	}

	/**
	 * Check if a parameter or property has @Optional decorator
	 */
	private hasOptionalDecorator(
		node: ts.ParameterDeclaration | ts.PropertyDeclaration,
	): boolean {
		if (!node.modifiers) {
			return false;
		}

		for (const modifier of node.modifiers) {
			if (ts.isDecorator(modifier)) {
				const expression = modifier.expression;
				if (ts.isCallExpression(expression)) {
					const identifier = expression.expression;
					if (ts.isIdentifier(identifier) && identifier.text === "Optional") {
						return true;
					}
				} else if (ts.isIdentifier(expression) && expression.text === "Optional") {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Extract the token from @Inject decorator
	 * Handles: @Inject(ClassName), @Inject('string'), @Inject(Symbol.for('key'))
	 */
	private extractTokenFromDecorator(
		decorator: ts.Decorator,
		sourceFile: ts.SourceFile,
	): { token: string; tokenType: "class" | "string" | "symbol" } {
		const expression = decorator.expression;

		if (!ts.isCallExpression(expression) || expression.arguments.length === 0) {
			return { token: "unknown", tokenType: "class" };
		}

		const arg = expression.arguments[0];

		// String literal: @Inject('TOKEN')
		if (ts.isStringLiteral(arg)) {
			return { token: arg.text, tokenType: "string" };
		}

		// Identifier (class): @Inject(DatabaseService)
		if (ts.isIdentifier(arg)) {
			return { token: arg.text, tokenType: "class" };
		}

		// Symbol: @Inject(Symbol.for('key'))
		if (ts.isCallExpression(arg)) {
			const callExpr = arg;
			if (
				ts.isPropertyAccessExpression(callExpr.expression) &&
				ts.isIdentifier(callExpr.expression.expression) &&
				callExpr.expression.expression.text === "Symbol"
			) {
				// Extract the symbol key
				if (
					callExpr.arguments.length > 0 &&
					ts.isStringLiteral(callExpr.arguments[0])
				) {
					return {
						token: `Symbol.for('${callExpr.arguments[0].text}')`,
						tokenType: "symbol",
					};
				}
			}
		}

		// Fallback: use the full text
		return { token: arg.getText(sourceFile), tokenType: "class" };
	}

	/**
	 * Get property name from a property declaration or assignment
	 */
	private getPropertyName(
		node: ts.PropertyDeclaration | ts.PropertyAssignment,
	): string | undefined {
		if (ts.isIdentifier(node.name)) {
			return node.name.text;
		}
		if (ts.isStringLiteral(node.name)) {
			return node.name.text;
		}
		return undefined;
	}

	/**
	 * Check if a property has static modifier
	 */
	private hasStaticModifier(node: ts.PropertyDeclaration): boolean {
		if (!node.modifiers) {
			return false;
		}
		return node.modifiers.some(
			(modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword,
		);
	}

	/**
	 * Extract type information from a constructor parameter's type annotation
	 * Used for Reflection-based DI when no @Inject decorator is present
	 */
	private extractTypeFromParameter(
		param: ts.ParameterDeclaration,
		sourceFile: ts.SourceFile,
	): { token: string; tokenType: "class" | "string" | "symbol" } | null {
		if (!param.type) {
			return null;
		}

		// Handle TypeReference (e.g., DatabaseService, LoggerService)
		if (ts.isTypeReferenceNode(param.type)) {
			const typeName = param.type.typeName;
			if (ts.isIdentifier(typeName)) {
				return {
					token: typeName.text,
					tokenType: "class",
				};
			}
		}

		// Handle other type nodes if needed
		return null;
	}

	/**
	 * Check if a parameter is optional (has ? modifier or default value)
	 */
	private isParameterOptional(param: ts.ParameterDeclaration): boolean {
		// Check for ? modifier (e.g., param?: Type)
		if (param.questionToken) {
			return true;
		}

		// Check for default value (e.g., param = defaultValue)
		if (param.initializer) {
			return true;
		}

		return false;
	}

	/**
	 * Infer token type from token string
	 */
	private inferTokenType(token: string): "class" | "string" | "symbol" {
		if (token.startsWith("Symbol.for(")) {
			return "symbol";
		}
		// If it starts with uppercase, likely a class
		if (token[0] === token[0].toUpperCase()) {
			return "class";
		}
		return "string";
	}
}

