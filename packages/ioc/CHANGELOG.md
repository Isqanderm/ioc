# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## Unreleased

### BREAKING CHANGES

- `useFactory` must return synchronously. A factory that returns a promise (any thenable) throws `AsyncFactoryError`, which names the token, at `bootstrap()`, at lazy `resolve()` and from `inject()`; move async setup into an `onModuleInit` (of the provided class, or of the object the factory returns), or create the value before bootstrap and register it with `useValue`. Singletons are created in declaration order.
- `AsyncProviderInjectionError` is removed, because an async factory can no longer be created.
- `Scope.Scoped` is removed. Only `Singleton` and `Transient` remain; `Transient` keeps the numeric value 2. Use `Transient`, or a child container (`createChild`) for per-request state. A scope value that is not a `Scope` member (such as `1`, the old `Scoped`) throws the new `InvalidScopeError` at bootstrap.
- `NexusApplication.get()` is synchronous and returns bootstrapped singletons. It throws `ProviderNotFoundError`, `ProviderScopeError` (Transient), `ProviderNotInstantiatedError` (lazy mode or not yet loaded), `ContainerClosedError` or `ContainerNotCompiledError` (before `bootstrap()`); pass `{ optional: true }` to get `undefined` for unknown tokens.
- `ModuleRef.get()` is synchronous too. It returns `undefined` for tokens the module cannot see (strict by default) and after `unload()`; for visible tokens it throws the same errors as `NexusApplication.get()`.
- New async `resolve()` on `NexusApplication` and `ModuleRef` creates Transient and lazy-mode providers on demand.
- `@nexus-ioc/testing`: `Test.compile()` instantiates singletons and runs `onModuleInit`; `Test.get` is sync, `Test.resolve` is async.
- The module container returned by `Test.compile()` has a sync `get()` (same contract as `Test.get`, throws `ProviderNotFoundError` for unknown tokens unless `{ optional: true }`) and a new async `resolve()`.
- `NexusApplication.get()`/`resolve()` before `bootstrap()` throw `ContainerNotCompiledError` (previously `ProviderNotFoundError` or a parent lookup).
- The `InjectionToken` type is renamed to `ProviderToken<T>` with no alias; `InjectionToken` is now a class (see Features).
- `get()`/`resolve()` infer the result type from the token. For string and symbol tokens the result is `unknown` unless you pass `<T>` or the expected type supplies it.
- `ProviderToken<T>` no longer includes `Function`, and `Abstract<T>` is now an abstract construct signature (`abstract new (...args) => T`). A plain function, or a class unrelated to `T` (`get<Foo>(Bar)`), is a compile error instead of inferring `any`.
- Classes with a `private` or `protected` constructor can no longer be used as tokens, because the container cannot construct them. Use an `InjectionToken` instead.
- `NexusApplication.setParent()`, `getParent()` and the parent fallback they enabled are removed. The only way to get a child container is `parent.createChild(...)`. Migrate `NexusApplication.create(X).setParent(app).bootstrap()` by declaring `X` in `children` of the module that owns it and calling `await app.createChild(X)`. A child now sees what its declaring module sees in the parent, not the whole parent.
- `close()` now closes the live child containers first (newest first, their errors join the `AggregateError`); it no longer leaves them running. Unloading a lazy module closes the children declared by the modules it destroys, and `UnloadResult` has a new `closedChildren` count.

### Changed

- An `@Optional()` static dependency is injected only when its provider is visible from the consumer's module (own providers, imports, or a `@Global()` module). A provider in a module the consumer cannot see, whether present at bootstrap or loaded later, used to be injected anyway; it is now `undefined`, as with `inject(token, { optional: true })`.
- New public `Edge.metadata.lateBound` field: marks a static `@Optional()` edge whose target did not exist (or was not visible) when it was compiled. It is injected only while the target exists and is visible, and then pins the target's module on unload.

### Features

- New `@Module({ children })` and `app.createChild(child, { providers })`: child containers with their own singletons and lifetime, created from a class, a `DynamicModule` (`ProfileModule.forProfile(id)`) or a `lazy()` ref declared in `children`. A child sees what its declaring module sees in the parent, recursively; its own providers win. `@Inject` of a parent Transient gives a new parent-created instance, and `inject()` of one throws `ProviderScopeError`. A child may be declared by one module only (`CHILD_DECLARED_TWICE` otherwise). New errors: `ChildModuleNotDeclaredError`; `createChild` also throws `ContainerNotCompiledError`, `ContainerClosedError` and `LazyModuleLoadError`. See the README section "Child containers".
- `@nexus-ioc/type-checker` and `@nexus-ioc/graph-analyzer` follow `children`, and the language service accounts for child scopes when reporting missing dependencies.
- New `inject(token)`, `inject(token, { optional: true })` and `inject(token, options)` in `@nexus-ioc/core`, usable synchronously while the container creates a provider (field initializers, constructor, a synchronous factory). Outside that it throws `InjectionContextError`; cycles throw `CircularInjectionError`. `inject()` dependencies are runtime graph edges (they protect lazy-module unload), and the type-checker and graph-analyzer report them with `location: "inject"`. `ProviderNotFoundError` has an optional `requestedBy`.
- New `InjectionToken<T>` class: `new InjectionToken<Config>("CONFIG")`. Tokens are compared by identity and work with `useValue`/`useFactory`/`useClass`, `@Inject`, `@Optional` and module `exports`. Error messages and graph labels use `toString()` (`InjectionToken CONFIG`).
- `get()`/`resolve()` on `NexusApplication`, `ModuleRef`, `Test` and the `Test.compile()` result infer `T` from class tokens (including abstract classes) and `InjectionToken<T>`.
- The type-checker and graph-analyzer treat an `InjectionToken` constant as one token across re-exports.
- `close()` is idempotent and error-tolerant: it runs `onModuleDestroy` in reverse creation order, throws one `AggregateError` if hooks fail, detaches the parent, and makes `get`/`resolve`/`load`/`unload` throw `ContainerClosedError` from the moment it is called (a `ModuleRef` throws it for visible tokens and still returns `undefined` for tokens it cannot see), while in-flight lazy loads still finish and are destroyed.

### Fixed

- `Container.replaceModule(Old, New)` is remembered, so it also replaces `Old` when `Old` is not registered yet (it used to store `New` as an orphan). Later `addModule`/`getModule` of `Old`, or of a `DynamicModule` of `Old`, resolve to `New`; chains are followed and cycles stop. A module that re-exports a replaced module class exports the replacement, and replacements apply to everything that container adds later, lazy modules included. Call it before `run()`/`bootstrap()`: replacing after `run()` and then loading a lazy module that imports the original fails with a duplicate-token error.
- Unloading a lazy module no longer destroys a provider that an eager or earlier-loaded consumer holds through a static `@Optional() @Inject()` edge compiled before the provider was visible to it. Loading the module that makes it visible now records the consumer's module as a referrer, so the provider's module stays alive until the consumer's module unloads, as with `inject()`. The result no longer depends on load order.
- A `@Global()` module that re-exports a module class (`@Global() @Module({ imports: [Inner], exports: [Inner] })`) now exposes `Inner`'s exports to every module, as a direct export does.

### Notes

- New `ProviderUnloadedError`: a `resolve()` that is still creating a singleton when an unload destroys its module rejects with it; the new instance is destroyed (its `onModuleDestroy` is called on a best-effort basis) instead of cached. After `close()` the same case rejects with `ContainerClosedError`.
- Unloading a lazy module runs every `onModuleDestroy` even if some throw and rejects with one `AggregateError`, like `close()`. The module is unloaded anyway (`ref.loaded` is `false`) and can be loaded again; previously a throwing hook left it impossible to reload.
- `NexusApplication.create(root, { hashFn })` now uses the given hash class (it was ignored) and passes it on to child containers.
- Concurrent `resolve()` of the same singleton creates it once. Under `.lazy()`, or while a `load()` warm-up is still creating a singleton, `inject()` of it throws `ProviderNotInstantiatedError`.
- Async `onModuleInit` is still supported: it is awaited at bootstrap, `inject()`ed dependencies finish their init before the requester's `onModuleInit`, a singleton whose init fails is evicted, `get()` throws `ProviderNotInstantiatedError` while an init is in flight, and a wrapped init error has `.cause`.

### Deprecations

- `.lazy()` is deprecated in favor of lazy modules (`lazy()` / `load()`).

## [0.6.1](https://github.com/Isqanderm/ioc/compare/@nexus-ioc/core@0.6.0...@nexus-ioc/core@0.6.1) (2025-10-17)

### Bug Fixes

- add publishConfig for scoped packages to enable NPM publishing ([839da89](https://github.com/Isqanderm/ioc/commit/839da890ee9e7dce21c4492643acecc0381c64b0))

# [0.6.0](https://github.com/Isqanderm/ioc/compare/@nexus-ioc/core@0.5.0...@nexus-ioc/core@0.6.0) (2025-10-17)

### Features

- add .npmignore files to exclude unnecessary files from NPM packages ([d136e8c](https://github.com/Isqanderm/ioc/commit/d136e8cae32d5dd76eecc691a95b5e9265449d4c))

# 0.5.0 (2025-10-17)

### Bug Fixes

- **all packages:** update deps, fix ioc graph analyzer, remove plugins from ioc graph ([33058a0](https://github.com/Isqanderm/ioc/commit/33058a0da18ed4b0e4a924607a97796233d23ca0)), closes [#34](https://github.com/Isqanderm/ioc/issues/34)
- correct property injection tests with missing decorators ([f4045e3](https://github.com/Isqanderm/ioc/commit/f4045e39fe9ba58f7d938dcda6f656b56b7ed6d4))
- **ioc:** enable property inject ([a93e6c8](https://github.com/Isqanderm/ioc/commit/a93e6c8d5e4bd790d938f19dbf3956097e2197b9))
- **ioc:** fix module export logic ([79a09ab](https://github.com/Isqanderm/ioc/commit/79a09abe4a8512697a843d3e5a42035cf5eeee82)), closes [#34](https://github.com/Isqanderm/ioc/issues/34)
- **packages:** fix build ([8160275](https://github.com/Isqanderm/ioc/commit/816027551b630769a3d53157f9a330a0873e6cb5)), closes [#34](https://github.com/Isqanderm/ioc/issues/34)
- replace Object.hasOwn with compatible alternative in shared.utils.ts ([5691c8a](https://github.com/Isqanderm/ioc/commit/5691c8a8ab5f2e0f4a58fb4ea121b5865599bd2d))
- resolve all linting errors across packages ([d21f9f6](https://github.com/Isqanderm/ioc/commit/d21f9f6a981a57085909c9877a2af124b74c76b2))
- resolve TypeScript compilation errors ([58655a6](https://github.com/Isqanderm/ioc/commit/58655a69e86383c9fe6ac80f94c0050526520ad7))
- use 'in' operator instead of Object.prototype.hasOwnProperty.call ([31f7339](https://github.com/Isqanderm/ioc/commit/31f73393127b23ac75f3722d542a14b226393764))

### Features

- **graph-visualizer:** add graph-visualizer package ([69bb005](https://github.com/Isqanderm/ioc/commit/69bb00585c395d7766675d1a4620320efed14736))
- **ioc:** add a new api for container inheritance ([#45](https://github.com/Isqanderm/ioc/issues/45)) ([7fb4be6](https://github.com/Isqanderm/ioc/commit/7fb4be612a55aab7f4d364767515584101a2aeb5)), closes [#44](https://github.com/Isqanderm/ioc/issues/44)
- **ioc:** add errors on compile step ([a9ab869](https://github.com/Isqanderm/ioc/commit/a9ab86933977e5eae472efa65436161e1900e34a))
- **ioc:** add Optional decorator ([1092db9](https://github.com/Isqanderm/ioc/commit/1092db9886d9c358ffe0bce685321729644d1692)), closes [#32](https://github.com/Isqanderm/ioc/issues/32)
- **ioc:** add resolve circular dependency ([3c2df88](https://github.com/Isqanderm/ioc/commit/3c2df885b584eb1f4446985f2857574e8dbcd2f3)), closes [#12](https://github.com/Isqanderm/ioc/issues/12)
- **ioc:** collect compile container errors ([f018f0d](https://github.com/Isqanderm/ioc/commit/f018f0d1d4da5c3cee9ed76d58efe03c5dfdc385))
- Resolve circular dependency, add CI/CD, and comprehensive testing ([#47](https://github.com/Isqanderm/ioc/issues/47)) ([da45982](https://github.com/Isqanderm/ioc/commit/da45982d1be52488b10fc75b68c96d69817ccec4))
- **testing:** move testing helpers to new package ([4cd98d1](https://github.com/Isqanderm/ioc/commit/4cd98d11cc9e707b64d31618bd0c078d8c4b8a8a))

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.1.14](https://github.com/Isqanderm/ioc/compare/v0.1.13...v0.1.14) (2024-07-17)

### [0.1.13](https://github.com/Isqanderm/ioc/compare/v0.1.11...v0.1.13) (2024-07-16)

### [0.1.12](https://github.com/Isqanderm/ioc/compare/v0.1.11...v0.1.12) (2024-07-16)

### [0.1.11](https://github.com/Isqanderm/ioc/compare/v0.1.10...v0.1.11) (2024-07-16)

### [0.1.10](https://github.com/Isqanderm/ioc/compare/v0.1.9...v0.1.10) (2024-07-16)

### Features

- **graph-visualizer:** add graph-visualizer package ([69bb005](https://github.com/Isqanderm/ioc/commit/69bb00585c395d7766675d1a4620320efed14736))
- **graph:** add container inheritance ([e5c0571](https://github.com/Isqanderm/ioc/commit/e5c05711f301314ec545881a6356db7c9f0de612)), closes [#21](https://github.com/Isqanderm/ioc/issues/21)

### [0.1.9](https://github.com/Isqanderm/ioc/compare/v0.1.8...v0.1.9) (2024-07-07)

### Features

- **graph:** add new graph hooks and api for container ([a082f3e](https://github.com/Isqanderm/ioc/commit/a082f3e48450995cdd8f4761e8a0e6a7330b05b1))

### [0.1.8](https://github.com/Isqanderm/ioc/compare/v0.1.7...v0.1.8) (2024-07-03)

### [0.1.7](https://github.com/Isqanderm/ioc/compare/v0.1.6...v0.1.7) (2024-07-02)

### Features

- **container:** add forRoot/forRootAsync ([533c1c4](https://github.com/Isqanderm/ioc/commit/533c1c4a6bc99a611584574e5b4717416f86af0f))

### [0.1.6](https://github.com/Isqanderm/ioc/compare/v0.1.5...v0.1.6) (2024-07-02)

### Features

- **container:** add forFeature/forFeatureAsync ([427d2df](https://github.com/Isqanderm/ioc/commit/427d2dfaa1792746c68c6909ecec35a5805024ae))

### [0.1.5](https://github.com/Isqanderm/ioc/compare/v0.1.4...v0.1.5) (2024-07-01)

### [0.1.4](https://github.com/Isqanderm/ioc/compare/v0.1.3...v0.1.4) (2024-06-30)

### 0.1.3 (2024-06-30)

### Features

- **application:** create first version of app ([086e0ff](https://github.com/Isqanderm/ioc/commit/086e0ff1fad889c253b7bf25e134f0048976c1eb))

### 0.1.2 (2024-06-30)

### Features

- **application:** create first version of app ([086e0ff](https://github.com/Isqanderm/ioc/commit/086e0ff1fad889c253b7bf25e134f0048976c1eb))

### 0.1.1 (2024-06-30)

### Features

- **application:** create first version of app ([086e0ff](https://github.com/Isqanderm/ioc/commit/086e0ff1fad889c253b7bf25e134f0048976c1eb))
