import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as ts from "typescript/lib/tsserverlibrary";
import * as fs from "node:fs";
import * as path from "node:path";
import { getSemanticDiagnosticsActions } from "../../src/actions/get-semantic-diagnostics.actions";
import type { NsLanguageService } from "../../src/language-service/ns-language-service";

describe("getSemanticDiagnosticsActions - Circular Dependencies", () => {
	let tempFilePath: string;
	let tsNsLs: NsLanguageService;
	const mockLogger = {
		log: () => {},
	};

	beforeEach(() => {
		tempFilePath = path.join(__dirname, `temp-circular-${Date.now()}.ts`);
	});

	afterEach(() => {
		if (fs.existsSync(tempFilePath)) {
			fs.unlinkSync(tempFilePath);
		}
	});

	it("should detect simple circular dependency (A -> B -> A)", () => {
		const code = `
import { Injectable, Inject } from "@nexus-ioc/core";

@Injectable()
export class ServiceA {
  constructor(@Inject(ServiceB) private serviceB: ServiceB) {}
}

@Injectable()
export class ServiceB {
  constructor(@Inject(ServiceA) private serviceA: ServiceA) {}
}
    `;

		fs.writeFileSync(tempFilePath, code);

		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.ES2015,
			module: ts.ModuleKind.CommonJS,
		});

		const languageService = ts.createLanguageService({
			getCompilationSettings: () => program.getCompilerOptions(),
			getScriptFileNames: () => [tempFilePath],
			getScriptVersion: () => "1",
			getScriptSnapshot: (fileName) => {
				if (!fs.existsSync(fileName)) {
					return undefined;
				}
				return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, "utf8"));
			},
			getCurrentDirectory: () => process.cwd(),
			getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
		});

		tsNsLs = {
			tsLS: languageService,
			logger: mockLogger,
		} as unknown as NsLanguageService;

		const diagnostics = getSemanticDiagnosticsActions(tempFilePath, tsNsLs);

		// Filter for circular dependency errors only
		const circularErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("Circular dependency detected"),
		);

		expect(circularErrors).toHaveLength(1);
		expect(circularErrors[0].messageText).toContain("ServiceA -> ServiceB -> ServiceA");
		expect(circularErrors[0].messageText).toContain("forwardRef()");
		expect(circularErrors[0].code).toBe(9998);
	});

	it("should detect longer circular dependency (A -> B -> C -> A)", () => {
		const code = `
import { Injectable, Inject } from "@nexus-ioc/core";

@Injectable()
export class ServiceA {
  constructor(@Inject(ServiceB) private serviceB: ServiceB) {}
}

@Injectable()
export class ServiceB {
  constructor(@Inject(ServiceC) private serviceC: ServiceC) {}
}

@Injectable()
export class ServiceC {
  constructor(@Inject(ServiceA) private serviceA: ServiceA) {}
}
    `;

		fs.writeFileSync(tempFilePath, code);

		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.ES2015,
			module: ts.ModuleKind.CommonJS,
		});

		const languageService = ts.createLanguageService({
			getCompilationSettings: () => program.getCompilerOptions(),
			getScriptFileNames: () => [tempFilePath],
			getScriptVersion: () => "1",
			getScriptSnapshot: (fileName) => {
				if (!fs.existsSync(fileName)) {
					return undefined;
				}
				return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, "utf8"));
			},
			getCurrentDirectory: () => process.cwd(),
			getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
		});

		tsNsLs = {
			tsLS: languageService,
			logger: mockLogger,
		} as unknown as NsLanguageService;

		const diagnostics = getSemanticDiagnosticsActions(tempFilePath, tsNsLs);

		// Filter for circular dependency errors only
		const circularErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("Circular dependency detected"),
		);

		expect(circularErrors).toHaveLength(1);
		expect(circularErrors[0].messageText).toContain("ServiceA -> ServiceB -> ServiceC -> ServiceA");
	});

	it("should NOT detect circular dependency when optional dependency breaks the cycle", () => {
		const code = `
import { Injectable, Inject, Optional } from "@nexus-ioc/core";

@Injectable()
export class ServiceA {
  constructor(@Inject(ServiceB) private serviceB: ServiceB) {}
}

@Injectable()
export class ServiceB {
  constructor(
    @Inject(ServiceA)
    @Optional()
    private serviceA?: ServiceA
  ) {}
}
    `;

		fs.writeFileSync(tempFilePath, code);

		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.ES2015,
			module: ts.ModuleKind.CommonJS,
		});

		const languageService = ts.createLanguageService({
			getCompilationSettings: () => program.getCompilerOptions(),
			getScriptFileNames: () => [tempFilePath],
			getScriptVersion: () => "1",
			getScriptSnapshot: (fileName) => {
				if (!fs.existsSync(fileName)) {
					return undefined;
				}
				return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, "utf8"));
			},
			getCurrentDirectory: () => process.cwd(),
			getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
		});

		tsNsLs = {
			tsLS: languageService,
			logger: mockLogger,
		} as unknown as NsLanguageService;

		const diagnostics = getSemanticDiagnosticsActions(tempFilePath, tsNsLs);

		// Filter for circular dependency errors only
		const circularErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("Circular dependency detected"),
		);

		expect(circularErrors).toHaveLength(0);
	});

	it("should NOT detect circular dependency in linear dependency chain", () => {
		const code = `
import { Injectable, Inject } from "@nexus-ioc/core";

@Injectable()
export class ServiceA {
  constructor(@Inject(ServiceB) private serviceB: ServiceB) {}
}

@Injectable()
export class ServiceB {
  constructor(@Inject(ServiceC) private serviceC: ServiceC) {}
}

@Injectable()
export class ServiceC {
  // No dependencies
}
    `;

		fs.writeFileSync(tempFilePath, code);

		const program = ts.createProgram([tempFilePath], {
			target: ts.ScriptTarget.ES2015,
			module: ts.ModuleKind.CommonJS,
		});

		const languageService = ts.createLanguageService({
			getCompilationSettings: () => program.getCompilerOptions(),
			getScriptFileNames: () => [tempFilePath],
			getScriptVersion: () => "1",
			getScriptSnapshot: (fileName) => {
				if (!fs.existsSync(fileName)) {
					return undefined;
				}
				return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, "utf8"));
			},
			getCurrentDirectory: () => process.cwd(),
			getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
		});

		tsNsLs = {
			tsLS: languageService,
			logger: mockLogger,
		} as unknown as NsLanguageService;

		const diagnostics = getSemanticDiagnosticsActions(tempFilePath, tsNsLs);

		// Filter for circular dependency errors only
		const circularErrors = diagnostics.filter((d) =>
			d.messageText.toString().includes("Circular dependency detected"),
		);

		expect(circularErrors).toHaveLength(0);
	});
});

