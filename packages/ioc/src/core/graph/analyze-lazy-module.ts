import { type LazyModule, NodeTypeEnum } from "../../interfaces";

/**
 * Placeholder graph node for a `lazy()` import. It carries no providers.
 * `isProviderExported` never looks through it, so eager providers cannot
 * depend on anything the lazy module will provide.
 */
export class AnalyzeLazyModule {
	private _loaded = false;
	private _moduleToken: string | null = null;

	constructor(private readonly _lazyModule: LazyModule) {}

	public get type(): NodeTypeEnum.LAZY {
		return NodeTypeEnum.LAZY;
	}

	public get id(): symbol {
		return this._lazyModule.id;
	}

	public get label(): string {
		return this._lazyModule.name;
	}

	public get lazyModule(): LazyModule {
		return this._lazyModule;
	}

	public get loaded(): boolean {
		return this._loaded;
	}

	/** Token of the real module node once loaded; null before. */
	public get moduleToken(): string | null {
		return this._moduleToken;
	}

	public markLoaded(moduleToken: string): void {
		this._loaded = true;
		this._moduleToken = moduleToken;
	}

	public get node() {
		return {
			type: this.type,
			id: this.id,
			label: this.label,
			loaded: this.loaded,
			moduleToken: this.moduleToken,
		};
	}
}
