import {
	type HashUtilInterface,
	type InjectionToken,
	type Module,
	type NexusApplicationInterface,
	NodeTypeEnum,
	type ScannerPluginInterface,
	Scope,
} from "../interfaces";
import { HashUtil } from "../utils/hash-utils";
import { Container } from "./modules/container";

export class NexusApplications implements NexusApplicationInterface {
	private hashUtil: HashUtilInterface = new HashUtil();
	private isAsyncContainer = false;
	private readonly container = new Container(this.hashUtil);
	private readonly scannerPlugins: ScannerPluginInterface[] = [];
	private _parentContainer: NexusApplicationInterface | null = null;

	private constructor(
		private readonly rootModule: Module,
		options?: { hashFn: new () => HashUtilInterface },
	) {
		if (options?.hashFn) {
			this.hashUtil = new options.hashFn();
		}
	}

	static create(
		rootModule: Module,
		options?: { hashFn: new () => HashUtilInterface },
	) {
		return new NexusApplications(rootModule, options);
	}

	public async bootstrap(): Promise<this> {
		await this.container.run(this.rootModule);

		for (const scannerPlugin of this.scannerPlugins) {
			await scannerPlugin.scan(this.container.graph);
		}

		if (!this.isAsyncContainer) {
			for (const [token, node] of this.container.graph.nodes) {
				if (
					node.type === NodeTypeEnum.PROVIDER &&
					node.scope === Scope.Singleton
				) {
					await this.container.get(token);
				}
			}
		}

		return this;
	}

	public addScannerPlugin(
		scanner: ScannerPluginInterface | ScannerPluginInterface[],
	): this {
		const plugins = Array.isArray(scanner) ? scanner : [scanner];
		this.scannerPlugins.push(...plugins);
		return this;
	}

	public async get<T>(token: InjectionToken) {
		const dependency = await this.container.get<T>(token);

		if (!dependency) {
			return this._parentContainer?.get<T>(token);
		}

		return dependency;
	}

	public get errors() {
		return this.container.errors;
	}

	public async(): this {
		this.isAsyncContainer = true;
		return this;
	}

	public setParent(parentContainer: NexusApplicationInterface) {
		this._parentContainer = parentContainer;
		return this;
	}
}
