import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StaticGraphVisualizer } from "../static-visualizer";

describe("StaticGraphVisualizer", () => {
	let dir: string;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "static-visualizer-test-"));
	});

	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	function writeFixture(): { entryPath: string } {
		// The fixture lives outside the monorepo's node_modules resolution
		// chain (a plain os.tmpdir() directory), so point "@nexus-ioc/core" at
		// the built package directly via `paths` rather than relying on
		// ambient node_modules resolution.
		const coreTypesDir = path.dirname(
			path.resolve(__dirname, "../../../ioc/dist/types/index.d.ts"),
		);
		fs.writeFileSync(
			path.join(dir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					target: "ES2021",
					module: "CommonJS",
					experimentalDecorators: true,
					skipLibCheck: true,
					baseUrl: ".",
					paths: { "@nexus-ioc/core": [path.join(coreTypesDir, "index")] },
				},
			}),
		);
		fs.writeFileSync(
			path.join(dir, "database.module.ts"),
			`import { NsModule } from "@nexus-ioc/core";

@NsModule({
  providers: [{ provide: "DATABASE", useValue: {} }],
  exports: ["DATABASE"],
})
export class DatabaseModule {}
`,
		);
		fs.writeFileSync(
			path.join(dir, "app.module.ts"),
			`import { Injectable, Inject, NsModule } from "@nexus-ioc/core";
import { DatabaseModule } from "./database.module";

@Injectable()
class ApiService {
  constructor(@Inject("DATABASE") db: unknown) {}
}

@NsModule({ imports: [DatabaseModule], providers: [ApiService] })
export class AppModule {}
`,
		);
		const entryPath = path.join(dir, "entry.ts");
		fs.writeFileSync(
			entryPath,
			`import { AppModule } from "./app.module";

class Bootstrap {
  static create(_module: unknown): Bootstrap {
    return new Bootstrap();
  }
  bootstrap(): void {}
}

new Bootstrap();
Bootstrap.create(AppModule).bootstrap();
`,
		);
		return { entryPath };
	}

	it("builds a GraphOutput for a real multi-module fixture", () => {
		const { entryPath } = writeFixture();
		const visualizer = new StaticGraphVisualizer(entryPath, {
			tsConfigPath: path.join(dir, "tsconfig.json"),
		});

		const output = visualizer.toJson();

		expect(output.metadata.rootModule).toBe("AppModule");
		const moduleNames = output.modules.map((m) => m.name).sort();
		expect(moduleNames).toEqual(["AppModule", "DatabaseModule"]);
	});

	it("throws a clear error when the entry file has no bootstrap call", () => {
		const entryPath = path.join(dir, "entry.ts");
		fs.writeFileSync(
			path.join(dir, "tsconfig.json"),
			JSON.stringify({ compilerOptions: { experimentalDecorators: true } }),
		);
		fs.writeFileSync(entryPath, "export class NotAModule {}\n");

		const visualizer = new StaticGraphVisualizer(entryPath, {
			tsConfigPath: path.join(dir, "tsconfig.json"),
		});

		expect(() => visualizer.toJson()).toThrow("No entry module found");
	});
});
