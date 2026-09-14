import * as path from "node:path";
import * as ts from "typescript";

const DEFAULT_COMPILER_OPTIONS: ts.CompilerOptions = {
	target: ts.ScriptTarget.ES2022,
	module: ts.ModuleKind.CommonJS,
	moduleResolution: ts.ModuleResolutionKind.NodeJs,
	experimentalDecorators: true,
	emitDecoratorMetadata: true,
	skipLibCheck: true,
	esModuleInterop: true,
	allowJs: false,
};

/**
 * Builds a `ts.Program` for the given entry file(s), the shared prerequisite
 * for every `type-checker` semantic-analysis entry point (`createNexusAnalyzer`
 * et al). Centralized here so tsconfig-loading/path-alias-resolution logic
 * isn't duplicated across every consumer that starts from "entry file(s) on
 * disk + optional tsconfig path" (CLIs, static visualizers, ...).
 *
 * When `tsConfigPath` is omitted, `ts.findConfigFile` looks for the nearest
 * `tsconfig.json` starting from the first entry file's directory; if none is
 * found, falls back to sane defaults.
 */
export function createNexusProgram(
	entryFileNames: readonly string[],
	tsConfigPath?: string,
): ts.Program {
	const options = resolveCompilerOptions(entryFileNames, tsConfigPath);
	return ts.createProgram({
		rootNames: [...entryFileNames],
		options,
	});
}

function resolveCompilerOptions(
	entryFileNames: readonly string[],
	tsConfigPath?: string,
): ts.CompilerOptions {
	const resolvedTsConfigPath =
		tsConfigPath ??
		(entryFileNames[0]
			? ts.findConfigFile(
					path.dirname(entryFileNames[0]),
					ts.sys.fileExists,
					"tsconfig.json",
				)
			: undefined);

	if (!resolvedTsConfigPath) {
		return DEFAULT_COMPILER_OPTIONS;
	}

	const configFile = ts.readConfigFile(resolvedTsConfigPath, ts.sys.readFile);
	if (configFile.error) {
		return DEFAULT_COMPILER_OPTIONS;
	}

	const parsed = ts.parseJsonConfigFileContent(
		configFile.config,
		ts.sys,
		path.dirname(resolvedTsConfigPath),
	);

	return { ...DEFAULT_COMPILER_OPTIONS, ...parsed.options };
}
