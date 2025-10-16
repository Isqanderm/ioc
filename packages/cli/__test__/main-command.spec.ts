import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

describe("CLI Commands", () => {
	const cliPath = path.resolve(__dirname, "../dist/index.js");

	it("should run generate service with spec", () => {
		cp.execSync(`node ${cliPath} generate service auth __test__/apps/auth`);

		const authModuleFolderPath = path.resolve(__dirname, "apps/auth");
		const isModuleFileExist = fs.existsSync(path.resolve(authModuleFolderPath, "auth.module.ts"));
		const isServiceFileExist = fs.existsSync(path.resolve(authModuleFolderPath, "auth.service.ts"));
		const isServiceSpecFileExist = fs.existsSync(
			path.resolve(authModuleFolderPath, "auth.service.spec.ts"),
		);

		expect(isServiceFileExist).toBe(true);
		expect(isModuleFileExist).toBe(false);
		expect(isServiceSpecFileExist).toBe(true);

		cp.execSync(`rm -rf ${path.resolve(__dirname, "apps")}`);
	});

	it("should run generate service without spec", () => {
		cp.execSync(`node ${cliPath} generate service auth __test__/apps/auth --no-spec`);

		const authModuleFolderPath = path.resolve(__dirname, "apps/auth");
		const isModuleFileExist = fs.existsSync(path.resolve(authModuleFolderPath, "auth.module.ts"));
		const isServiceFileExist = fs.existsSync(path.resolve(authModuleFolderPath, "auth.service.ts"));
		const isServiceSpecFileExist = fs.existsSync(
			path.resolve(authModuleFolderPath, "auth.service.spec.ts"),
		);

		expect(isServiceFileExist).toBe(true);
		expect(isModuleFileExist).toBe(false);
		expect(isServiceSpecFileExist).toBe(false);

		cp.execSync(`rm -rf ${path.resolve(__dirname, "apps")}`);
	});

	it("should run generate module", () => {
		cp.execSync(`node ${cliPath} generate module auth __test__/apps/auth`);

		const authModuleFolderPath = path.resolve(__dirname, "apps/auth");
		const isModuleFileExist = fs.existsSync(path.resolve(authModuleFolderPath, "auth.module.ts"));

		expect(isModuleFileExist).toBe(true);

		cp.execSync(`rm -rf ${path.resolve(__dirname, "apps")}`);
	});

	it("should run generate module with service", () => {
		cp.execSync(`node ${cliPath} generate module auth __test__/apps/auth`);

		const authModuleFolderPath = path.resolve(__dirname, "apps/auth");
		const isModuleFileExist = fs.existsSync(path.resolve(authModuleFolderPath, "auth.module.ts"));

		expect(isModuleFileExist).toBe(true);

		cp.execSync(`node ${cliPath} generate service auth __test__/apps/auth`);

		const isServiceFileExist = fs.existsSync(path.resolve(authModuleFolderPath, "auth.service.ts"));
		const isServiceSpecFileExist = fs.existsSync(
			path.resolve(authModuleFolderPath, "auth.service.spec.ts"),
		);

		expect(isServiceFileExist).toBe(true);
		expect(isServiceSpecFileExist).toBe(true);

		cp.execSync(`rm -rf ${path.resolve(__dirname, "apps")}`);
	});
});
