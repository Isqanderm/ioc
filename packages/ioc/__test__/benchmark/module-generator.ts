import { Injectable, NsModule } from "../../src";

function generateAppModule(moduleCount: number) {
	const providers = [];
	const modules = [];

	for (let i = 1; i <= moduleCount; i++) {
		const ProviderClass = class {};
		Object.defineProperty(ProviderClass, "name", { value: `Service${i}` });
		Injectable()(ProviderClass);
		providers.push(ProviderClass);
	}

	for (let i = 1; i <= moduleCount; i++) {
		const importedModules = [];
		const moduleProviders = [];

		for (let j = 0; j < 3; j++) {
			const providerIndex = Math.floor(Math.random() * providers.length);
			moduleProviders.push(providers[providerIndex]);
		}

		for (let k = 0; k < 2; k++) {
			const moduleIndex = Math.floor(Math.random() * modules.length);
			if (modules[moduleIndex]) {
				importedModules.push(modules[moduleIndex]);
			}
		}

		const ModuleClass = class {};
		Object.defineProperty(ModuleClass, "name", { value: `Module${i}` });

		NsModule({
			providers: moduleProviders,
			imports: importedModules,
		})(ModuleClass);

		modules.push(ModuleClass);
	}

	// Главный модуль, который импортирует все остальные сгенерированные модули
	const AppModule = class {};
	NsModule({
		imports: modules,
	})(AppModule);

	return AppModule;
}

export { generateAppModule };
