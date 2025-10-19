import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../../src/rules/check-dependency-types";

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

ruleTester.run("check-dependency-types", rule, {
	valid: [
		{
			name: "class with @Injectable and @Inject",
			code: `
				import { Injectable, Inject } from '@nexus-ioc/core';
				
				@Injectable()
				class UserService {
					constructor(@Inject('Logger') private logger: any) {}
				}
			`,
		},
		{
			name: "class without @Inject",
			code: `
				class UserService {
					constructor(private logger: any) {}
				}
			`,
		},
	],
	invalid: [
		{
			name: "class with @Inject but no @Injectable",
			code: `
				import { Inject } from '@nexus-ioc/core';
				
				class UserService {
					constructor(@Inject('Logger') private logger: any) {}
				}
			`,
			errors: [
				{
					messageId: "injectableRequired",
					data: {
						className: "UserService",
					},
				},
			],
		},
	],
});
