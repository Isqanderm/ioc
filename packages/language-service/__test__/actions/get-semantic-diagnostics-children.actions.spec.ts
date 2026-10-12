import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as ts from "typescript/lib/tsserverlibrary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSemanticDiagnosticsActions } from "../../src/actions/get-semantic-diagnostics.actions";
import type { NsLanguageService } from "../../src/language-service/ns-language-service";
import type { Logger } from "../../src/logger";

describe("getSemanticDiagnosticsActions - child modules (children)", () => {
	let tempDir: string;
	let mockLogger: Logger;
	let languageService: ts.LanguageService;
	let tsNsLs: NsLanguageService;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ns-module-test-"));

		mockLogger = {
			log: vi.fn(),
		} as unknown as Logger;
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	function createTestFiles(files: Record<string, string>) {
		const filePaths: string[] = [];

		for (const [fileName, content] of Object.entries(files)) {
			const filePath = path.join(tempDir, fileName);
			fs.writeFileSync(filePath, content, "utf-8");
			filePaths.push(filePath);
		}

		return filePaths;
	}

	function setupLanguageService(filePaths: string[]) {
		const compilerOptions: ts.CompilerOptions = {
			target: ts.ScriptTarget.ES2020,
			module: ts.ModuleKind.CommonJS,
			strict: true,
			esModuleInterop: true,
			skipLibCheck: true,
			forceConsistentCasingInFileNames: true,
		};

		const host: ts.LanguageServiceHost = {
			getScriptFileNames: () => filePaths,
			getScriptVersion: () => "1",
			getScriptSnapshot: (fileName) => {
				if (!fs.existsSync(fileName)) {
					return undefined;
				}
				return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, "utf-8"));
			},
			getCurrentDirectory: () => tempDir,
			getCompilationSettings: () => compilerOptions,
			getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
			fileExists: (fileName) => fs.existsSync(fileName),
			readFile: (fileName) => {
				if (fs.existsSync(fileName)) {
					return fs.readFileSync(fileName, "utf-8");
				}
				return undefined;
			},
			readDirectory: ts.sys.readDirectory,
			directoryExists: ts.sys.directoryExists,
			getDirectories: ts.sys.getDirectories,
		};

		languageService = ts.createLanguageService(
			host,
			ts.createDocumentRegistry(),
		);

		tsNsLs = {
			tsLS: languageService,
			logger: mockLogger,
			project: {} as ts.server.Project,
			_host: {} as ts.server.ServerHost,
			config: {},
			getConfigOptions: () => ({ debug: false, logPath: "" }),
		} as unknown as NsLanguageService;
	}

	const HTTP = {
		"http.service.ts": `
import { Injectable } from "@nexus-ioc/core";

@Injectable()
export class HttpService {}
`,
		"secret.service.ts": `
import { Injectable } from "@nexus-ioc/core";

@Injectable()
export class SecretService {}
`,
		"http.module.ts": `
import { Module } from "@nexus-ioc/core";
import { HttpService } from "./http.service";
import { SecretService } from "./secret.service";

@Module({
  providers: [HttpService, SecretService],
  exports: [HttpService],
})
export class HttpModule {}
`,
		"app-config.service.ts": `
import { Injectable } from "@nexus-ioc/core";

@Injectable()
export class AppConfigService {}
`,
		"profile.store.ts": `
import { Injectable, Inject } from "@nexus-ioc/core";
import { HttpService } from "./http.service";
import { SecretService } from "./secret.service";
import { AppConfigService } from "./app-config.service";

@Injectable()
export class ProfileStore {
  constructor(
    @Inject(HttpService) private http: HttpService,
    @Inject(SecretService) private secret: SecretService,
    @Inject(AppConfigService) private config: AppConfigService,
  ) {}
}
`,
		"profile.module.ts": `
import { Module } from "@nexus-ioc/core";
import { ProfileStore } from "./profile.store";

@Module({
  providers: [ProfileStore],
})
export class ProfileModule {}
`,
	};

	function missingFor(dependency: string, files: Record<string, string>) {
		const filePaths = createTestFiles(files);
		setupLanguageService(filePaths);
		const diagnostics = getSemanticDiagnosticsActions(
			path.join(tempDir, "profile.store.ts"),
			tsNsLs,
		);
		return diagnostics.filter(
			(d) =>
				typeof d.messageText === "string" &&
				d.messageText.includes("missing dependency") &&
				d.messageText.includes(dependency),
		);
	}

	const APP_DIRECT = `
import { Module } from "@nexus-ioc/core";
import { HttpModule } from "./http.module";
import { ProfileModule } from "./profile.module";
import { AppConfigService } from "./app-config.service";

@Module({
  imports: [HttpModule],
  providers: [AppConfigService],
  children: [ProfileModule],
})
export class AppModule {}
`;

	const APP_LAZY = `
import { lazy, Module } from "@nexus-ioc/core";
import { HttpModule } from "./http.module";
import { AppConfigService } from "./app-config.service";

@Module({
  imports: [HttpModule],
  providers: [AppConfigService],
  children: [lazy(() => import("./profile.module").then((m) => m.ProfileModule))],
})
export class AppModule {}
`;

	it("accepts a dependency exported by an import of the declaring module", () => {
		expect(
			missingFor("HttpService", { ...HTTP, "app.module.ts": APP_DIRECT }),
		).toEqual([]);
	});

	it("accepts a provider of the declaring module itself", () => {
		expect(
			missingFor("AppConfigService", { ...HTTP, "app.module.ts": APP_DIRECT }),
		).toEqual([]);
	});

	it("still reports a provider the declaring module cannot see", () => {
		expect(
			missingFor("SecretService", { ...HTTP, "app.module.ts": APP_DIRECT }),
		).toHaveLength(1);
	});

	it("follows a lazy() child the same way", () => {
		const files = { ...HTTP, "app.module.ts": APP_LAZY };
		expect(missingFor("HttpService", files)).toEqual([]);
	});

	it("still reports a parent dependency when the module is not declared as a child", () => {
		const files = {
			...HTTP,
			"app.module.ts": APP_DIRECT.replace("children: [ProfileModule],", ""),
		};
		expect(missingFor("HttpService", files)).toHaveLength(1);
	});

	const PROFILE_WITH_DATA_MODULE = {
		"profile.module.ts": `
import { Module } from "@nexus-ioc/core";
import { ProfileDataModule } from "./profile-data.module";

@Module({ imports: [ProfileDataModule] })
export class ProfileModule {}
`,
		"profile-data.module.ts": `
import { Module } from "@nexus-ioc/core";
import { ProfileStore } from "./profile.store";

@Module({ providers: [ProfileStore], exports: [ProfileStore] })
export class ProfileDataModule {}
`,
	};

	it("applies the fallback to a module imported by the declared child root", () => {
		const files = {
			...HTTP,
			...PROFILE_WITH_DATA_MODULE,
			"app.module.ts": APP_DIRECT,
		};
		expect(missingFor("HttpService", files)).toEqual([]);
		expect(missingFor("SecretService", files)).toHaveLength(1);
	});

	it("applies the fallback through a lazy() child root's imports", () => {
		const files = {
			...HTTP,
			...PROFILE_WITH_DATA_MODULE,
			"app.module.ts": APP_LAZY,
		};
		expect(missingFor("AppConfigService", files)).toEqual([]);
	});

	it("keeps the diagnostic when the child module is also imported outside a child scope", () => {
		const files = {
			...HTTP,
			"app.module.ts": APP_DIRECT,
			"other.module.ts": `
import { Module } from "@nexus-ioc/core";
import { ProfileModule } from "./profile.module";

@Module({ imports: [ProfileModule] })
export class OtherModule {}
`,
		};
		expect(missingFor("HttpService", files)).toHaveLength(1);
	});

	it("keeps the diagnostic for an imported module that is also imported outside a child scope", () => {
		const files = {
			...HTTP,
			...PROFILE_WITH_DATA_MODULE,
			"app.module.ts": APP_DIRECT,
			"other.module.ts": `
import { Module } from "@nexus-ioc/core";
import { ProfileDataModule } from "./profile-data.module";

@Module({ imports: [ProfileDataModule] })
export class OtherModule {}
`,
		};
		expect(missingFor("HttpService", files)).toHaveLength(1);
	});
});
