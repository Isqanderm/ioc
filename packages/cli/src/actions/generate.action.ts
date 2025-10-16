import * as fs from "node:fs";
import * as path from "node:path";
import prettier from "prettier";
import { Project } from "ts-morph";
import type { Input } from "../commands/command.input";
import { ModuleTemplate } from "../templates/module.template";
import { ServiceSpecTemplate } from "../templates/service-spec.template";
import { ServiceTemplate } from "../templates/service.template";
import { AbstractAction } from "./abstract.action";

export class GenerateAction extends AbstractAction {
	private readonly project = new Project();

	async handler(inputs: Input[], options: Input[]) {
		let outputDir = process.cwd();
		let name = "";
		let type = "";
		const createOptions: { skipImport?: boolean; spec?: boolean } = options.reduce((prev, next) => {
			prev[next.name] = next.value;
			return prev;
		}, {});

		for (const input of inputs) {
			if (input.name === "path") {
				outputDir = path.resolve(outputDir, input.value as string);
			} else if (input.name === "name") {
				name = input.value as string;
			} else if (input.name === "type") {
				type = input.value as string;
			}
		}

		const moduleName = this.capitalize(name);

		if (type === "module") {
			await this.generateModule(name, outputDir, {
				providers: [],
				addImports: [],
			});
			console.log(`Generating module: ${name}`);
		} else if (type === "service") {
			console.log(`Generating service: ${name}`);
			await this.generateProvider(name, outputDir);

			if (this.ifModuleExist(name, outputDir) && !createOptions.skipImport) {
				await this.generateModule(name, outputDir, {
					providers: [`${this.capitalize(name)}Service`],
					addImports: [`import { ${moduleName}Service } from './${name}.service';`],
				});
			}

			if (!createOptions.spec) {
				await this.generateServiceSpec(name, outputDir);
			}
		}

		await this.project.save();
	}

	private async generateProvider(name: string, outputDir: string) {
		const filePath = path.join(outputDir, `${name}.service.ts`);
		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});
		const moduleName = this.capitalize(name);
		const serviceTemplate = new ServiceTemplate({ name: moduleName });
		const sourceText = serviceTemplate.generate();

		const formattedText = await this.prettify(sourceText, {
			filepath: filePath,
		});

		sourceFile.replaceWithText(formattedText);
	}

	public async generateModule(
		name: string,
		outputDir: string,
		moduleArgs: { providers: string[]; addImports: string[] },
	) {
		const filePath = path.join(outputDir, `${name}.module.ts`);
		const moduleName = this.capitalize(name);

		if (this.ifModuleExist(name, outputDir)) {
			const sourceFile = this.project.addSourceFileAtPath(filePath);

			const moduleTemplate = new ModuleTemplate({ name: moduleName }, sourceFile.getText());

			moduleTemplate.addProvider(moduleArgs.providers);

			const sourceText = `
				import { NsModule } from '@nexus-ioc/core';
				${moduleArgs.addImports.join("\n")}
				
				${moduleTemplate.generate()}
			`;

			const formattedText = await this.prettify(sourceText, {
				filepath: filePath,
			});

			sourceFile.replaceWithText(formattedText);
		} else {
			const moduleTemplate = new ModuleTemplate({ name: moduleName });
			const sourceFile = this.project.createSourceFile(filePath, "", {
				overwrite: true,
			});

			moduleTemplate.addProvider(moduleArgs.providers);

			const sourceText = `
				import { NsModule } from '@nexus-ioc/core';
				${moduleArgs.addImports.join("\n")}
				
				${moduleTemplate.generate()}
			`;
			const formattedText = await this.prettify(sourceText, {
				filepath: filePath,
			});

			sourceFile.replaceWithText(formattedText);
		}
	}

	public async generateServiceSpec(name: string, outputDir: string) {
		const filePath = path.join(outputDir, `${name}.service.spec.ts`);
		const sourceFile = this.project.createSourceFile(filePath, "", {
			overwrite: true,
		});
		const moduleName = this.capitalize(name);
		const serviceTemplate = new ServiceSpecTemplate({ name: moduleName });
		const sourceText = serviceTemplate.generate();

		const formattedText = await this.prettify(sourceText, {
			filepath: filePath,
		});

		sourceFile.replaceWithText(formattedText);
	}

	private ifModuleExist(name: string, outputDir: string) {
		const filePath = path.join(outputDir, `${name}.module.ts`);

		return fs.existsSync(filePath);
	}

	private capitalize(str: string) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	private async prettify(text: string, options: { filepath: string }) {
		return prettier.format(text, options);
	}
}
