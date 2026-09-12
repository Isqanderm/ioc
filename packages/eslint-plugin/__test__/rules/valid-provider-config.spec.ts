import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../../src/rules/valid-provider-config";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
	languageOptions: {
		parserOptions: {
			projectService: {
				allowDefaultProject: ["*.ts"],
			},
			tsconfigRootDir: __dirname,
		},
	},
});

ruleTester.run("valid-provider-config", rule, {
	valid: [
		{
			name: "module with @NsModule decorator",
			code: `
				import { NsModule } from '@nexus-ioc/core';
				
				@NsModule({
					providers: [],
				})
				class AppModule {}
			`,
		},
		{
			name: "class not ending with Module",
			code: `
				class UserService {}
			`,
		},
	],
	invalid: [
		{
			name: "class ending with Module but no @NsModule",
			code: `
				class AppModule {}
			`,
			errors: [
				{
					messageId: "moduleRequired",
					data: {
						className: "AppModule",
					},
				},
			],
		},
	],
});
