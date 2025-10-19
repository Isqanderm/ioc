import { describe, expect, it } from "vitest";
import * as ts from "typescript/lib/tsserverlibrary";
import { getSemanticDiagnosticsActions } from "../../src/actions/get-semantic-diagnostics.actions";
import { NsLanguageService } from "../../src/language-service/ns-language-service";
import { Logger } from "../../src/logger";

describe("getSemanticDiagnosticsActions - Property Injection", () => {
	const mockLogger = new Logger({ debug: false });

	/**
	 * Helper function to create a test program with multiple files
	 */
	function createTestProgram(files: Record<string, string>) {
		const fileNames = Object.keys(files);
		const compilerOptions: ts.CompilerOptions = {
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.CommonJS,
			experimentalDecorators: true,
			emitDecoratorMetadata: true,
		};

		const compilerHost = ts.createCompilerHost(compilerOptions);
		const originalGetSourceFile = compilerHost.getSourceFile;

		compilerHost.getSourceFile = (fileName, languageVersion) => {
			if (files[fileName]) {
				return ts.createSourceFile(fileName, files[fileName], languageVersion);
			}
			return originalGetSourceFile(fileName, languageVersion);
		};

		return ts.createProgram(fileNames, compilerOptions, compilerHost);
	}

	/**
	 * Helper function to create NsLanguageService for testing
	 */
	function createNsLanguageService(program: ts.Program) {
		const mockProject = {
			getProjectName: () => "test-project",
		} as ts.server.Project;

		const mockHost = {} as ts.server.ServerHost;

		const languageService: ts.LanguageService = {
			getProgram: () => program,
			getSemanticDiagnostics: () => [],
		} as unknown as ts.LanguageService;

		return new NsLanguageService(
			mockProject,
			mockHost,
			languageService,
			{ debug: false },
			mockLogger,
		);
	}

	it("should NOT report error when property dependency is provided in module", () => {
		const files = {
			"database.service.ts": `
import { Injectable } from '@nexus-ioc/core';

@Injectable()
export class DatabaseService {
  connect() { return 'connected'; }
}
`,
			"user.service.ts": `
import { Injectable, Inject } from '@nexus-ioc/core';
import { DatabaseService } from './database.service';

@Injectable()
export class UserService {
  @Inject(DatabaseService)
  private db!: DatabaseService;

  getUsers() {
    return this.db.connect();
  }
}
`,
			"app.module.ts": `
import { NsModule } from '@nexus-ioc/core';
import { DatabaseService } from './database.service';
import { UserService } from './user.service';

@NsModule({
  providers: [DatabaseService, UserService]
})
export class AppModule {}
`,
		};

		const program = createTestProgram(files);
		const tsNsLs = createNsLanguageService(program);

		const diagnostics = getSemanticDiagnosticsActions(
			"user.service.ts",
			tsNsLs,
		);

		expect(diagnostics).toHaveLength(0);
	});

	it("should report error when property dependency is NOT provided in module", () => {
		const files = {
			"database.service.ts": `
import { Injectable } from '@nexus-ioc/core';

@Injectable()
export class DatabaseService {
  connect() { return 'connected'; }
}
`,
			"user.service.ts": `
import { Injectable, Inject } from '@nexus-ioc/core';
import { DatabaseService } from './database.service';

@Injectable()
export class UserService {
  @Inject(DatabaseService)
  private db!: DatabaseService;

  getUsers() {
    return this.db.connect();
  }
}
`,
			"app.module.ts": `
import { NsModule } from '@nexus-ioc/core';
import { UserService } from './user.service';

@NsModule({
  providers: [UserService]
})
export class AppModule {}
`,
		};

		const program = createTestProgram(files);
		const tsNsLs = createNsLanguageService(program);

		const diagnostics = getSemanticDiagnosticsActions(
			"user.service.ts",
			tsNsLs,
		);

		expect(diagnostics.length).toBeGreaterThan(0);
		expect(diagnostics[0].messageText).toContain("missing dependency");
		expect(diagnostics[0].messageText).toContain("DatabaseService");
	});

	it("should NOT report error for optional property dependency", () => {
		const files = {
			"cache.service.ts": `
import { Injectable } from '@nexus-ioc/core';

@Injectable()
export class CacheService {
  get() { return 'cached'; }
}
`,
			"user.service.ts": `
import { Injectable, Inject, Optional } from '@nexus-ioc/core';
import { CacheService } from './cache.service';

@Injectable()
export class UserService {
  @Inject(CacheService)
  @Optional()
  private cache?: CacheService;

  getUsers() {
    return this.cache?.get() || 'no-cache';
  }
}
`,
			"app.module.ts": `
import { NsModule } from '@nexus-ioc/core';
import { UserService } from './user.service';

@NsModule({
  providers: [UserService]
})
export class AppModule {}
`,
		};

		const program = createTestProgram(files);
		const tsNsLs = createNsLanguageService(program);

		const diagnostics = getSemanticDiagnosticsActions(
			"user.service.ts",
			tsNsLs,
		);

		expect(diagnostics).toHaveLength(0);
	});

	it("should handle mixed constructor and property injection", () => {
		const files = {
			"database.service.ts": `
import { Injectable } from '@nexus-ioc/core';

@Injectable()
export class DatabaseService {
  connect() { return 'connected'; }
}
`,
			"cache.service.ts": `
import { Injectable } from '@nexus-ioc/core';

@Injectable()
export class CacheService {
  get() { return 'cached'; }
}
`,
			"user.service.ts": `
import { Injectable, Inject } from '@nexus-ioc/core';
import { DatabaseService } from './database.service';
import { CacheService } from './cache.service';

@Injectable()
export class UserService {
  @Inject(CacheService)
  private cache!: CacheService;

  constructor(
    @Inject(DatabaseService)
    private db: DatabaseService
  ) {}

  getUsers() {
    return this.db.connect() + this.cache.get();
  }
}
`,
			"app.module.ts": `
import { NsModule } from '@nexus-ioc/core';
import { DatabaseService } from './database.service';
import { CacheService } from './cache.service';
import { UserService } from './user.service';

@NsModule({
  providers: [DatabaseService, CacheService, UserService]
})
export class AppModule {}
`,
		};

		const program = createTestProgram(files);
		const tsNsLs = createNsLanguageService(program);

		const diagnostics = getSemanticDiagnosticsActions(
			"user.service.ts",
			tsNsLs,
		);

		expect(diagnostics).toHaveLength(0);
	});

	it("should report error when property dependency is provided by imported module", () => {
		const files = {
			"database.service.ts": `
import { Injectable } from '@nexus-ioc/core';

@Injectable()
export class DatabaseService {
  connect() { return 'connected'; }
}
`,
			"database.module.ts": `
import { NsModule } from '@nexus-ioc/core';
import { DatabaseService } from './database.service';

@NsModule({
  providers: [DatabaseService],
  exports: [DatabaseService]
})
export class DatabaseModule {}
`,
			"user.service.ts": `
import { Injectable, Inject } from '@nexus-ioc/core';
import { DatabaseService } from './database.service';

@Injectable()
export class UserService {
  @Inject(DatabaseService)
  private db!: DatabaseService;

  getUsers() {
    return this.db.connect();
  }
}
`,
			"app.module.ts": `
import { NsModule } from '@nexus-ioc/core';
import { DatabaseModule } from './database.module';
import { UserService } from './user.service';

@NsModule({
  imports: [DatabaseModule],
  providers: [UserService]
})
export class AppModule {}
`,
		};

		const program = createTestProgram(files);
		const tsNsLs = createNsLanguageService(program);

		const diagnostics = getSemanticDiagnosticsActions(
			"user.service.ts",
			tsNsLs,
		);

		expect(diagnostics).toHaveLength(0);
	});

	it("should handle property injection with string tokens", () => {
		const files = {
			"user.service.ts": `
import { Injectable, Inject } from '@nexus-ioc/core';

@Injectable()
export class UserService {
  @Inject('DATABASE_CONFIG')
  private config!: any;

  getConfig() {
    return this.config;
  }
}
`,
			"app.module.ts": `
import { NsModule } from '@nexus-ioc/core';
import { UserService } from './user.service';

@NsModule({
  providers: [
    UserService,
    { provide: 'DATABASE_CONFIG', useValue: { host: 'localhost' } }
  ]
})
export class AppModule {}
`,
		};

		const program = createTestProgram(files);
		const tsNsLs = createNsLanguageService(program);

		const diagnostics = getSemanticDiagnosticsActions(
			"user.service.ts",
			tsNsLs,
		);

		expect(diagnostics).toHaveLength(0);
	});
});

