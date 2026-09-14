import type {
	NexusApplication,
	NexusClass,
	NexusProvider,
	NexusToken,
} from "@nexus-ioc/type-checker";
import * as ts from "typescript";
import type {
	GraphModuleNode,
	GraphProviderDependency,
	GraphProviderNode,
	NexusGraphModel,
} from "./nexus-graph-model";

/**
 * Builds the string-keyed `NexusGraphModel` the analyzers in this package
 * operate on, from `@nexus-ioc/type-checker`'s semantic `NexusApplication`.
 *
 * `application.classes[0]` is always the entry point's own class (see
 * `NexusApplicationAnalyzer.analyze`, which seeds and processes it first).
 */
export function buildNexusGraphModel(
	application: NexusApplication,
	program: ts.Program,
): NexusGraphModel {
	const checker = program.getTypeChecker();
	const classBySymbol = indexClassesBySymbol(
		application.classes,
		program,
		checker,
	);

	const modules = new Map<string, GraphModuleNode>();
	for (const nexusClass of application.classes) {
		if (!nexusClass.module) continue;

		const name = moduleName(nexusClass);
		modules.set(name, {
			name,
			path: nexusClass.source.fileName,
			isGlobal: nexusClass.isGlobal,
			imports: nexusClass.module.imports.map((entry) =>
				renderToken(entry.module),
			),
			exports: nexusClass.module.exports.map((entry) =>
				renderToken(entry.token),
			),
			providers: nexusClass.module.providers.map((provider) =>
				buildProviderNode(provider, classBySymbol),
			),
		});
	}

	return {
		entryModuleName: moduleName(application.classes[0]),
		modules,
	};
}

function moduleName(nexusClass: NexusClass | undefined): string {
	if (!nexusClass) return "";
	return (
		nexusClass.name ??
		`<anonymous:${nexusClass.source.fileName}:${nexusClass.source.start}>`
	);
}

function buildProviderNode(
	provider: NexusProvider,
	classBySymbol: Map<ts.Symbol, NexusClass>,
): GraphProviderNode {
	const implementationToken =
		provider.kind === "useClass" ? provider.useClass : provider.provide;
	const dependencies = resolveClassDependencies(
		implementationToken,
		classBySymbol,
	);

	return {
		token: renderToken(provider.provide),
		type: renderProviderType(provider.kind),
		scope: provider.scope ? renderToken(provider.scope) : undefined,
		useClass:
			provider.kind === "useClass" ? renderToken(provider.useClass) : undefined,
		dependencies:
			provider.kind === "useFactory"
				? provider.factoryInject.map(
						(token): GraphProviderDependency => ({
							token: renderToken(token),
							optional: false,
						}),
					)
				: dependencies,
	};
}

function resolveClassDependencies(
	token: NexusToken | undefined,
	classBySymbol: Map<ts.Symbol, NexusClass>,
): GraphProviderDependency[] {
	if (token?.kind !== "reference") return [];

	const nexusClass = classBySymbol.get(token.symbol);
	if (!nexusClass) return [];

	return nexusClass.dependencies.map((dependency) => ({
		token: renderToken(dependency.token),
		optional: dependency.optional,
	}));
}

function renderProviderType(
	kind: NexusProvider["kind"],
): GraphProviderNode["type"] {
	switch (kind) {
		case "class":
			return "Class";
		case "useClass":
			return "UseClass";
		case "useValue":
			return "UseValue";
		case "useFactory":
			return "UseFactory";
	}
}

function renderToken(token: NexusToken | undefined): string {
	if (!token) return "<unknown>";
	switch (token.kind) {
		case "string":
			return token.value;
		case "reference":
			return token.symbol.getName();
		case "symbol":
			return token.declaration ? token.declaration.getName() : "<symbol>";
		case "expression":
			return "<expression>";
	}
}

function indexClassesBySymbol(
	classes: readonly NexusClass[],
	program: ts.Program,
	checker: ts.TypeChecker,
): Map<ts.Symbol, NexusClass> {
	const map = new Map<ts.Symbol, NexusClass>();
	for (const nexusClass of classes) {
		const symbol = classSymbol(nexusClass, program, checker);
		if (symbol) map.set(symbol, nexusClass);
	}
	return map;
}

function classSymbol(
	nexusClass: NexusClass,
	program: ts.Program,
	checker: ts.TypeChecker,
): ts.Symbol | undefined {
	const sourceFile = program.getSourceFile(nexusClass.source.fileName);
	if (!sourceFile) return undefined;

	const declaration = findClassDeclarationAtSpan(
		sourceFile,
		nexusClass.source.start,
	);
	if (!declaration?.name) return undefined;

	return checker.getSymbolAtLocation(declaration.name);
}

function findClassDeclarationAtSpan(
	node: ts.Node,
	start: number,
): ts.ClassDeclaration | undefined {
	if (ts.isClassDeclaration(node) && node.getStart() === start) return node;

	for (const child of node.getChildren()) {
		if (child.getFullStart() > start || child.getEnd() < start) continue;
		const match = findClassDeclarationAtSpan(child, start);
		if (match) return match;
	}

	return undefined;
}
