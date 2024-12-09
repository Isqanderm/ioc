import type * as ts from "typescript/lib/tsserverlibrary";

export const getTypeOfNode = (
	node: ts.Node,
	typeChecker: ts.TypeChecker,
): ts.Type | undefined => {
	try {
		return typeChecker.getTypeAtLocation(node);
	} catch (error) {
		console.error("Failed to get type:", error);
		return undefined;
	}
};
