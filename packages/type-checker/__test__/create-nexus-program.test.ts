import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { createNexusProgram } from "../src";

function makeTempDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "nexus-program-test-"));
}

describe("createNexusProgram", () => {
	it("builds a program using compiler options from a real tsconfig.json", () => {
		const dir = makeTempDir();
		const entryPath = path.join(dir, "main.ts");
		fs.writeFileSync(entryPath, "export class AppModule {}\n");
		fs.writeFileSync(
			path.join(dir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					target: "ES2020",
					module: "CommonJS",
					experimentalDecorators: true,
					strict: true,
				},
			}),
		);

		const program = createNexusProgram(
			[entryPath],
			path.join(dir, "tsconfig.json"),
		);

		expect(program.getSourceFile(entryPath)).toBeDefined();
		expect(program.getCompilerOptions().strict).toBe(true);

		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("falls back to sane defaults when no tsconfig is found", () => {
		const dir = makeTempDir();
		const entryPath = path.join(dir, "main.ts");
		fs.writeFileSync(entryPath, "export class AppModule {}\n");

		const program = createNexusProgram([entryPath]);

		expect(program.getSourceFile(entryPath)).toBeDefined();
		expect(program.getCompilerOptions().experimentalDecorators).toBe(true);

		fs.rmSync(dir, { recursive: true, force: true });
	});
});
