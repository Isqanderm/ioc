import type * as ts from "typescript";

let entryModule: null | string = null;
const graph = new Map<string, [{ name: string; file: ts.SourceFile }]>();

export const rules = [
	{
		rule: "CallExpression",
		callback(nodes: ts.Node[], file: ts.SourceFile) {
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
		callback(nodes: ts.Node[], file: ts.SourceFile) {
			for (const node of nodes) {
				const text = node.getText();
				const match = text.match(/imports:\s*\[([^\]]+)\]/);

				if (match) {
					const result: { name: string; file: ts.SourceFile }[] = [];
					const modules: string[] = match[1]
						.split(",")
						.map((module) => module.trim());

					for (const module of modules) {
						// graph.set(module, result);
					}

					// graph.set(module, result);
					console.log("modules: ", modules);
				}
			}
		},
	},
];
