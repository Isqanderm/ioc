import * as p from "node:path";
import type ts from "typescript";
import type {
	AbsoluteFsPath,
	ConfigurationHost,
	FileStats,
	PathSegment,
	PathString,
} from "./types";

/**
 * Used to read configuration files.
 *
 * A language service parse configuration host is independent of the adapter
 * because signatures of calls like `FileSystem#readFile` are a bit stricter
 * than those on the adapter.
 */
export class ParseConfigHost implements ConfigurationHost {
	constructor(private readonly serverHost: ts.server.ServerHost) {}

	exists(path: AbsoluteFsPath): boolean {
		return (
			this.serverHost.fileExists(path) || this.serverHost.directoryExists(path)
		);
	}
	readFile(path: AbsoluteFsPath): string {
		const content = this.serverHost.readFile(path);
		if (content === undefined) {
			throw new Error(
				`LanguageServiceFS#readFile called on unavailable file ${path}`,
			);
		}
		return content;
	}
	lstat(path: AbsoluteFsPath): FileStats {
		return {
			isFile: () => {
				return this.serverHost.fileExists(path);
			},
			isDirectory: () => {
				return this.serverHost.directoryExists(path);
			},
			isSymbolicLink: () => {
				throw new Error(
					"LanguageServiceFS#lstat#isSymbolicLink not implemented",
				);
			},
		};
	}

	readdir(path: AbsoluteFsPath): PathSegment[] {
		return this.serverHost.readDirectory(
			path,
			undefined,
			undefined,
			undefined,
			/* depth */ 1,
		) as PathSegment[];
	}

	pwd(): AbsoluteFsPath {
		return this.serverHost.getCurrentDirectory() as AbsoluteFsPath;
	}

	extname(path: AbsoluteFsPath | PathSegment): string {
		return p.extname(path);
	}

	resolve(...paths: string[]): AbsoluteFsPath {
		return p.resolve(...paths) as AbsoluteFsPath;
	}

	dirname<T extends PathString>(file: T): T {
		return p.dirname(file) as T;
	}

	join<T extends PathString>(basePath: T, ...paths: string[]): T {
		return p.join(basePath, ...paths) as T;
	}
}
