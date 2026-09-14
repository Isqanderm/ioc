import * as ts from "typescript/lib/tsserverlibrary";
import { describe, expect, it } from "vitest";
import { ModulesParser } from "../src";

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
