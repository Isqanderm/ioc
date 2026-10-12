import type {
	ContainerBaseInterface,
	GetOptions,
	InjectionToken,
	LazyModule,
	ModuleContainerInterface,
	ModuleMetadata,
	ModulePluginInterface,
	ModuleRef,
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

	get<T>(token: InjectionToken): T;
	get<T>(token: InjectionToken, options: GetOptions): T | undefined;

	resolve<T>(token: InjectionToken): Promise<T>;
	resolve<T>(
		token: InjectionToken,
		options: GetOptions,
	): Promise<T | undefined>;

	compile(): Promise<ModuleContainerInterface>;

	load(lazyModule: LazyModule): Promise<ModuleRef>;

	unload(ref: ModuleRef): Promise<UnloadResult>;
}
