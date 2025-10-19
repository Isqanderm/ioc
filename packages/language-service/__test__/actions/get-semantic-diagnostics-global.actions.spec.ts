import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as ts from "typescript/lib/tsserverlibrary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSemanticDiagnosticsActions } from "../../src/actions/get-semantic-diagnostics.actions";
import type { NsLanguageService } from "../../src/language-service/ns-language-service";
import type { Logger } from "../../src/logger";

describe("getSemanticDiagnosticsActions - @Global() Modules", () => {
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

		languageService = ts.createLanguageService(host, ts.createDocumentRegistry());

		tsNsLs = {
			tsLS: languageService,
			logger: mockLogger,
			project: {} as ts.server.Project,
			_host: {} as ts.server.ServerHost,
			config: {},
			getConfigOptions: () => ({ debug: false, logPath: "" }),
		} as unknown as NsLanguageService;
	}

	it("should not report error for dependency provided by global module", () => {
		const files = {
			"config.service.ts": `
import { Injectable } from "@nexus-ioc/core";

@Injectable()
export class ConfigService {
  getApiKey(): string {
    return "api-key";
  }
}
`,
			"config.module.ts": `
import { Global, NsModule } from "@nexus-ioc/core";
import { ConfigService } from "./config.service";

@Global()
@NsModule({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
`,
			"user.service.ts": `
import { Injectable, Inject } from "@nexus-ioc/core";
import { ConfigService } from "./config.service";

@Injectable()
export class UserService {
  constructor(@Inject(ConfigService) private config: ConfigService) {}
}
`,
			"user.module.ts": `
import { NsModule } from "@nexus-ioc/core";
import { UserService } from "./user.service";

@NsModule({
  providers: [UserService],
  exports: [],
})
export class UserModule {}
`,
			"app.module.ts": `
import { NsModule } from "@nexus-ioc/core";
import { ConfigModule } from "./config.module";
import { UserModule } from "./user.module";

@NsModule({
  imports: [ConfigModule, UserModule],
})
export class AppModule {}
`,
		};

		const filePaths = createTestFiles(files);
		setupLanguageService(filePaths);

		const userServicePath = path.join(tempDir, "user.service.ts");
		const diagnostics = getSemanticDiagnosticsActions(userServicePath, tsNsLs);

		// Should not have error about missing ConfigService
		const missingDependencyError = diagnostics.find(
			(d) =>
				d.messageText &&
				typeof d.messageText === "string" &&
				d.messageText.includes("missing dependency") &&
				d.messageText.includes("ConfigService"),
		);

		expect(missingDependencyError).toBeUndefined();
	});

	it("should report error for dependency NOT provided by global module", () => {
		const files = {
			"config.service.ts": `
import { Injectable } from "@nexus-ioc/core";

@Injectable()
export class ConfigService {
  getApiKey(): string {
    return "api-key";
  }
}
`,
			"logger.service.ts": `
import { Injectable } from "@nexus-ioc/core";

@Injectable()
export class LoggerService {
  log(message: string): void {
    console.log(message);
  }
}
`,
			"config.module.ts": `
import { Global, NsModule } from "@nexus-ioc/core";
import { ConfigService } from "./config.service";

@Global()
@NsModule({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
`,
			"user.service.ts": `
import { Injectable, Inject } from "@nexus-ioc/core";
import { ConfigService } from "./config.service";
import { LoggerService } from "./logger.service";

@Injectable()
export class UserService {
  constructor(
    @Inject(ConfigService) private config: ConfigService,
    @Inject(LoggerService) private logger: LoggerService
  ) {}
}
`,
			"user.module.ts": `
import { NsModule } from "@nexus-ioc/core";
import { UserService } from "./user.service";

@NsModule({
  providers: [UserService],
  exports: [],
})
export class UserModule {}
`,
		};

		const filePaths = createTestFiles(files);
		setupLanguageService(filePaths);

		const userServicePath = path.join(tempDir, "user.service.ts");
		const diagnostics = getSemanticDiagnosticsActions(userServicePath, tsNsLs);

		// Should NOT have error about ConfigService (provided by global module)
		const configServiceError = diagnostics.find(
			(d) =>
				d.messageText &&
				typeof d.messageText === "string" &&
				d.messageText.includes("missing dependency") &&
				d.messageText.includes("ConfigService"),
		);
		expect(configServiceError).toBeUndefined();

		// Should HAVE error about LoggerService (not provided anywhere)
		const loggerServiceError = diagnostics.find(
			(d) =>
				d.messageText &&
				typeof d.messageText === "string" &&
				d.messageText.includes("missing dependency") &&
				d.messageText.includes("LoggerService"),
		);
		expect(loggerServiceError).toBeDefined();
	});

	it("should handle orphan service with global module dependency", () => {
		const files = {
			"config.service.ts": `
import { Injectable } from "@nexus-ioc/core";

@Injectable()
export class ConfigService {
  getApiKey(): string {
    return "api-key";
  }
}
`,
			"config.module.ts": `
import { Global, NsModule } from "@nexus-ioc/core";
import { ConfigService } from "./config.service";

@Global()
@NsModule({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
`,
			"orphan.service.ts": `
import { Injectable, Inject } from "@nexus-ioc/core";
import { ConfigService } from "./config.service";

@Injectable()
export class OrphanService {
  constructor(@Inject(ConfigService) private config: ConfigService) {}
}
`,
		};

		const filePaths = createTestFiles(files);
		setupLanguageService(filePaths);

		const orphanServicePath = path.join(tempDir, "orphan.service.ts");
		const diagnostics = getSemanticDiagnosticsActions(orphanServicePath, tsNsLs);

		// Should NOT have error about ConfigService (provided by global module)
		const missingDependencyError = diagnostics.find(
			(d) =>
				d.messageText &&
				typeof d.messageText === "string" &&
				d.messageText.includes("missing dependency") &&
				d.messageText.includes("ConfigService"),
		);

		expect(missingDependencyError).toBeUndefined();
	});

	it("should handle multiple global modules", () => {
		const files = {
			"config.service.ts": `
import { Injectable } from "@nexus-ioc/core";

@Injectable()
export class ConfigService {}
`,
			"logger.service.ts": `
import { Injectable } from "@nexus-ioc/core";

@Injectable()
export class LoggerService {}
`,
			"config.module.ts": `
import { Global, NsModule } from "@nexus-ioc/core";
import { ConfigService } from "./config.service";

@Global()
@NsModule({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
`,
			"logger.module.ts": `
import { Global, NsModule } from "@nexus-ioc/core";
import { LoggerService } from "./logger.service";

@Global()
@NsModule({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
`,
			"user.service.ts": `
import { Injectable, Inject } from "@nexus-ioc/core";
import { ConfigService } from "./config.service";
import { LoggerService } from "./logger.service";

@Injectable()
export class UserService {
  constructor(
    @Inject(ConfigService) private config: ConfigService,
    @Inject(LoggerService) private logger: LoggerService
  ) {}
}
`,
			"user.module.ts": `
import { NsModule } from "@nexus-ioc/core";
import { UserService } from "./user.service";

@NsModule({
  providers: [UserService],
  exports: [],
})
export class UserModule {}
`,
		};

		const filePaths = createTestFiles(files);
		setupLanguageService(filePaths);

		const userServicePath = path.join(tempDir, "user.service.ts");
		const diagnostics = getSemanticDiagnosticsActions(userServicePath, tsNsLs);

		// Should not have errors for either ConfigService or LoggerService
		const missingDependencyErrors = diagnostics.filter(
			(d) =>
				d.messageText &&
				typeof d.messageText === "string" &&
				d.messageText.includes("missing dependency"),
		);

		expect(missingDependencyErrors).toHaveLength(0);
	});
});

