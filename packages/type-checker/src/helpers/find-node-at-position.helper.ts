import ts from "typescript/lib/tsserverlibrary";

export const findNodeAtPosition = (
	sourceFile: ts.SourceFile,
	position: number,
): ts.Node | undefined => {
	function find(node: ts.Node): ts.Node | undefined {
		if (position >= node.getStart() && position <= node.getEnd()) {
			return ts.forEachChild(node, find) || node;
		}

		return undefined;
	}
	return find(sourceFile);
};
