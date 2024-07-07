import "reflect-metadata";
import {
	type ClassProvider,
	type DynamicModule,
	type FactoryProvider,
	INJECTABLE_OPTIONS,
	INJECTABLE_WATERMARK,
	type InjectionToken,
	MODULE_GLOBAL_WATERMARK,
	type Module,
	type Provider,
	Scope,
	type Type,
	type ValueProvider,
} from "../interfaces";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function isFunctionProvider(target: Provider): target is Type<any> {
	return typeof target === "function";
}

export function isClassProvider(target: Provider): target is ClassProvider {
	return !!(target as ClassProvider).useClass;
}

export function isValueProvider(target: Provider): target is ValueProvider {
	return !!(target as ValueProvider).useValue;
}

export function isFactoryProvider(target: Provider): target is FactoryProvider {
	return !!(target as FactoryProvider).useFactory;
}

export function getProviderToken(target: Provider): InjectionToken {
	if (isFunctionProvider(target)) {
		return target;
	}

	return target.provide;
}

export function isProvider(provider: Provider): provider is Provider {
	return Reflect.getMetadata(INJECTABLE_WATERMARK, provider) || false;
}

export function getDependencyToken(target: Provider): InjectionToken {
	if (isFunctionProvider(target)) {
		return target;
	}

	return target as unknown as InjectionToken;
}

export function isDynamicModule(
	module: Module | DynamicModule,
): module is DynamicModule {
	return "module" in module;
}

export function isGlobalModule(target: Module): boolean {
	return Reflect.getMetadata(MODULE_GLOBAL_WATERMARK, target) === true;
}

export function getModuleLabel(module: Module | DynamicModule): string {
	if (isDynamicModule(module)) {
		return module.module.name;
	}

	return module.name;
}

export function getProviderScope(target: Provider): Scope {
	if (isClassProvider(target) || isFactoryProvider(target)) {
		return target.scope || Scope.Singleton;
	}

	if (isValueProvider(target)) {
		return Scope.Singleton;
	}

	return Reflect.getMetadata(INJECTABLE_OPTIONS, target) || Scope.Singleton;
}

export function getProviderName(target: Provider): string {
	const token = getProviderToken(target);

	// @ts-ignore
	return token.name || token;
}
