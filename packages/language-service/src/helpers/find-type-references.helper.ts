import * as ts from "typescript/lib/tsserverlibrary";
import type { Logger } from "../logger";

export type TypeReference = {
	fileName: string;
	textSpan: ts.TextSpan[];
	isDefinition: boolean;
};

export const findTypeReferences = (
	typeNode: ts.ClassDeclaration | ts.TypeReferenceNode | ts.Identifier,
	languageService: ts.LanguageService,
	logger: Logger,
): TypeReference[] => {
	const typeChecker = languageService.getProgram()?.getTypeChecker();
	let identifier: ts.Identifier | undefined;
	let sourceFile: ts.SourceFile | null = null;

	if (!typeChecker) {
		logger.log("[findTypeReferences] typeChecker is not define");
		return [];
	}

	if (ts.isClassDeclaration(typeNode) && typeNode.name) {
		identifier = typeNode.name;
		sourceFile = typeNode.getSourceFile();
	} else if (
		ts.isTypeReferenceNode(typeNode) &&
		ts.isIdentifier(typeNode.typeName)
	) {
		identifier = typeNode.typeName;
		sourceFile = typeNode.getSourceFile();
	} else if (ts.isIdentifier(typeNode)) {
		identifier = typeNode;
		sourceFile = identifier.getSourceFile();
	} else {
		throw new Error(
			"Unsupported node type. Only ClassDeclaration, TypeReferenceNode, and Identifier are supported.",
		);
	}

	if (!sourceFile) {
		throw new Error("sourceFile not define");
	}

	const identifierPosition = identifier.getStart();
	const references =
		languageService.findReferences(sourceFile.fileName, identifierPosition) ||
		[];
	const result: Record<string, TypeReference> = {};

	for (const ref of references) {
		for (const refDetail of ref.references) {
			const typeReference = result[refDetail.fileName] || {
				fileName: refDetail.fileName,
				textSpan: [],
				isDefinition: refDetail.isDefinition || false,
			};

			typeReference.textSpan.push(refDetail.textSpan);

			result[refDetail.fileName] = typeReference;
		}
	}

	return Object.values(result);
};
