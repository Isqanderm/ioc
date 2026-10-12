import * as ts from "typescript/lib/tsserverlibrary";
import { describe, expect, it } from "vitest";
import { type ILanguageServiceLike, ModuleParser, ModulesParser } from "../src";

function createSourceFile(source: string): ts.SourceFile {
	return ts.createSourceFile(
		"/nexus-test.ts",
		source,
		ts.ScriptTarget.ES2022,
		true,
	);
}

describe("ModulesParser", () => {
	it("recognizes classes decorated with @Module(...)", () => {
		const sourceFile = createSourceFile(`
			import { Module } from "@nexus-ioc/core";

			@Module({})
			class AppModule {}
		`);

		const modules = ModulesParser.execute(sourceFile);

		expect(modules).toHaveLength(1);
		expect(modules[0].name?.getText()).toBe("AppModule");
	});

	it("does not recognize a bare @NsModule(...) decorator anymore", () => {
		const sourceFile = createSourceFile(`
			import { NsModule } from "@nexus-ioc/core";

			@NsModule({})
			class AppModule {}
		`);

		const modules = ModulesParser.execute(sourceFile);

		expect(modules).toHaveLength(0);
	});
});

describe("ModuleParser children", () => {
	function parse(source: string) {
		const sourceFile = createSourceFile(source);
		return ModuleParser.execute(
			ModulesParser.execute(sourceFile),
			{} as ts.TypeChecker,
			{} as ILanguageServiceLike,
		);
	}

	it("gives a module without children an empty list", () => {
		const [module] = parse(`
			@Module({})
			class AppModule {}
		`);
		expect(module.children).toEqual([]);
	});

	it("parses direct and lazy() children down to the child class identifier", () => {
		const [module] = parse(`
			const SettingsLazy = lazy(async () => (await import("./settings")).SettingsModule);

			@Module({
				children: [
					ProfileModule,
					lazy(() => import("./billing").then((m) => m.BillingModule)),
					SettingsLazy,
					lazy(() => load()),
				],
			})
			class AppModule {}
		`);
		expect(
			module.children.map((child) => [
				child.declaration.getText(),
				child.isLazy,
			]),
		).toEqual([
			["ProfileModule", false],
			["BillingModule", true],
			["SettingsModule", true],
		]);
	});
});
