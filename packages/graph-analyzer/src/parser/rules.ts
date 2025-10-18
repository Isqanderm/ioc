import type * as ts from "typescript";

let entryModule: null | string = null;

export const rules = [
	{
		rule: "CallExpression",
		callback(nodes: ts.Node[], _file: ts.SourceFile) {
			if (entryModule) {
				return;
			}

			for (const node of nodes) {
				const text = node.getText();
				const match = text.match(/\.create\((\w+)\)/);

				if (match) {
					entryModule = match[1];
					return;
				}
			}
		},
	},
	{
		name: "findNsModuleDecorators",
		rule: 'Decorator[expression.expression.name="NsModule"]',
		callback(nodes: ts.Node[], _file: ts.SourceFile) {
			for (const node of nodes) {
				const text = node.getText();
				const match = text.match(/imports:\s*\[([^\]]+)\]/);

				if (match) {
					const modules: string[] = match[1].split(",").map((m) => m.trim());

					console.log("modules: ", modules);
				}
			}
		},
	},
];
