import type ts from "typescript/lib/tsserverlibrary";
import type { Logger } from "../logger";
import type { CompilerOptions } from "./types";

function parseNsCompilerOptions(config: PluginConfig): CompilerOptions {
	return {
		debug: false,
		logPath: "./nexus-ioc-plugin.log",
		...config,
	};
}

export type PluginConfig = {
	debug?: boolean;
	logPath?: string;
};

export class NsLanguageService {
	private options: CompilerOptions;

	constructor(
		private readonly project: ts.server.Project,
		private readonly host: ts.server.ServerHost,
		private readonly _tsLS: ts.LanguageService,
		private readonly config: PluginConfig,
		private readonly _logger: Logger,
	) {
		this.options = parseNsCompilerOptions(config);
		const projectName = project.getProjectName();

		_logger.log(
			`Nexus-IoC compiler options for ${projectName}: ${JSON.stringify(this.options)}`,
		);
	}

	get logger(): Logger {
		return this._logger;
	}

	get tsLS(): ts.LanguageService {
		return this._tsLS;
	}

	public getConfigOptions(): CompilerOptions {
		return this.options;
	}
}
