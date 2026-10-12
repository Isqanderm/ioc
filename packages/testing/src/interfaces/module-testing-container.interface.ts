import type {
	ContainerBaseInterface,
	GetOptions,
	LazyModule,
	ModuleContainerInterface,
	ModuleMetadata,
	ModulePluginInterface,
	ModuleRef,
	ProviderToken,
	UnloadResult,
} from "@nexus-ioc/core";

export interface ModuleTestingContainerInterface<_T extends ModuleMetadata>
	extends Omit<ContainerBaseInterface, "get" | "resolve" | "hasProvider">,
		ModulePluginInterface {
	setModuleDecorator(
		decorator: <M extends ModuleMetadata = ModuleMetadata>(
			metadata: M,
		) => ClassDecorator,
	): this;

	get<T>(token: ProviderToken): T;
	get<T>(token: ProviderToken, options: { optional: true }): T | undefined;
	get<T>(token: ProviderToken, options: { optional?: false }): T;
	get<T>(token: ProviderToken, options: GetOptions): T | undefined;

	resolve<T>(token: ProviderToken): Promise<T>;
	resolve<T>(
		token: ProviderToken,
		options: { optional: true },
	): Promise<T | undefined>;
	resolve<T>(token: ProviderToken, options: { optional?: false }): Promise<T>;
	resolve<T>(token: ProviderToken, options: GetOptions): Promise<T | undefined>;

	compile(): Promise<ModuleContainerInterface>;

	load(lazyModule: LazyModule): Promise<ModuleRef>;

	unload(ref: ModuleRef): Promise<UnloadResult>;
}
