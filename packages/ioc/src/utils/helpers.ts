import "reflect-metadata";
import { InvalidScopeError } from "../errors/provider-errors";
import {
	type ClassProvider,
	type DynamicModule,
	type FactoryProvider,
	INJECTABLE_OPTIONS,
	INJECTABLE_WATERMARK,
	MODULE_GLOBAL_WATERMARK,
	type Provider,
	type ProviderToken,
	Scope,
	type Type,
	type ValueProvider,
} from "../interfaces";

export function isFunctionProvider(target: Provider): target is Type {
	return typeof target === "function";
}

export function isModule(target: Type | ProviderToken): target is Type {
	return typeof target === "function";
}

export function isFunctionToken(target: ProviderToken): target is Type {
	return typeof target === "function";
}

export function isClassProvider(target: Provider): target is ClassProvider {
	return !!(target as ClassProvider).useClass;
}

export function isValueProvider(target: Provider): target is ValueProvider {
	// Check if target has 'useValue' property (even if it's null or undefined)
	return "useValue" in (target as object);
}

export function isFactoryProvider(target: Provider): target is FactoryProvider {
	return !!(target as FactoryProvider).useFactory;
}

export function getProviderToken(target: Provider): ProviderToken {
	if (isFunctionProvider(target)) {
		return target;
	}

	return target.provide;
}

export function isProvider(provider: Provider): provider is Provider {
	return Reflect.getMetadata(INJECTABLE_WATERMARK, provider) || false;
}

export function getDependencyToken(target: Provider): ProviderToken {
	if (isFunctionProvider(target)) {
		return target;
	}

	return target as unknown as ProviderToken;
}

export function isDynamicModule(
	module: Type | DynamicModule,
): module is DynamicModule {
	return "module" in module;
}

export function isGlobalModule(target: Type): boolean {
	return Reflect.getMetadata(MODULE_GLOBAL_WATERMARK, target) === true;
}

export function getModuleLabel(module: Type | DynamicModule): string {
	if (isDynamicModule(module)) {
		return module.module.name;
	}

	return module.name;
}

export function getProviderScope(target: Provider): Scope {
	const scope = declaredScope(target) ?? Scope.Singleton;
	if (scope !== Scope.Singleton && scope !== Scope.Transient) {
		throw new InvalidScopeError(getProviderToken(target), scope);
	}
	return scope;
}

/** The scope a provider declares, or undefined when it declares none. */
function declaredScope(target: Provider): Scope | undefined {
	if (isFactoryProvider(target)) {
		return target.scope;
	}

	if (isClassProvider(target)) {
		// A Singleton (0) on the class falls through to the provider object,
		// so `{ useClass, scope: Scope.Transient }` overrides it.
		return (
			Reflect.getMetadata(INJECTABLE_OPTIONS, target.useClass)?.scope ||
			target.scope
		);
	}

	if (isValueProvider(target)) {
		return Scope.Singleton;
	}

	return Reflect.getMetadata(INJECTABLE_OPTIONS, target)?.scope;
}
