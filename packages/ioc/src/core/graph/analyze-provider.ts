import {
	type Edge,
	EdgeTypeEnum,
	type ModuleContainerInterface,
	NodeTypeEnum,
	type Provider,
} from "../../interfaces";
import { getProviderScope, getProviderToken, isFunctionToken } from "../../utils/helpers";

export abstract class AnalyzeProvider {
	private readonly _token = getProviderToken(this.provider);
	private readonly _label = isFunctionToken(this._token) ? this._token.name : this._token;
	private readonly _scope = getProviderScope(this.provider);

	constructor(
		protected readonly provider: Provider,
		protected readonly module: ModuleContainerInterface,
	) {}

	public get type(): NodeTypeEnum.PROVIDER {
		return NodeTypeEnum.PROVIDER;
	}

	public get id() {
		return this._token;
	}

	public get label() {
		return this._label.toString();
	}

	public get metatype(): Provider {
		return this.provider;
	}

	public get moduleContainer() {
		return this.module;
	}

	public get scope() {
		return this._scope;
	}

	public get node() {
		return {
			type: this.type,
			id: this.id,
			label: this.label,
			metatype: this.metatype,
			moduleContainer: this.moduleContainer,
			scope: this.scope,
		};
	}

	public get edge(): Edge {
		return {
			type: EdgeTypeEnum.PROVIDER,
			source: this.id,
			target: this.module.token,
			metadata: {
				unreached: false,
				isCircular: false,
			},
		};
	}
}
