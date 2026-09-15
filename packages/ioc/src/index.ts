// Re-export shared types and errors
export { ContainerNotCompiledError } from "@nexus-ioc/shared";
export type { ModuleRefGetOptions } from "./core/module-ref";
export { ModuleRef } from "./core/module-ref";
export { NexusApplication } from "./core/nexus-applications";
export { Global } from "./decorators/global";
export { Inject } from "./decorators/inject";
export { Injectable } from "./decorators/injectable";
export { Module } from "./decorators/module";
export { Optional } from "./decorators/optional";
export {
	BootstrapError,
	LazyModuleGraphError,
	LazyModuleLoadError,
} from "./errors";
export * from "./interfaces";
export type { ForwardRef } from "./utils/forward-ref";
export { forwardRef } from "./utils/forward-ref";
export * from "./utils/helpers";
export type { LazyModuleOptions } from "./utils/lazy-module";
export { isLazyModule, lazy } from "./utils/lazy-module";
