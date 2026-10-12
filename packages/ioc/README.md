# @nexus-ioc/core

[![npm version](https://img.shields.io/npm/v/@nexus-ioc/core.svg)](https://www.npmjs.com/package/@nexus-ioc/core)
[![npm downloads](https://img.shields.io/npm/dm/@nexus-ioc/core.svg)](https://www.npmjs.com/package/@nexus-ioc/core)
[![npm downloads](https://img.shields.io/npm/dt/@nexus-ioc/core.svg)](https://www.npmjs.com/package/@nexus-ioc/core)
[![License: MIT](https://img.shields.io/npm/l/@nexus-ioc/core.svg)](https://github.com/Isqanderm/ioc/blob/main/LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@nexus-ioc/core)](https://bundlephobia.com/package/@nexus-ioc/core)
[![CI](https://github.com/Isqanderm/ioc/actions/workflows/ci.yml/badge.svg)](https://github.com/Isqanderm/ioc/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Isqanderm/ioc/branch/main/graph/badge.svg)](https://codecov.io/gh/Isqanderm/ioc)
[![Dependencies](https://img.shields.io/librariesio/release/npm/@nexus-ioc/core)](https://libraries.io/npm/@nexus-ioc%2Fcore)
[![GitHub stars](https://img.shields.io/github/stars/Isqanderm/ioc.svg?style=social&label=Star)](https://github.com/Isqanderm/ioc)
[![GitHub issues](https://img.shields.io/github/issues/Isqanderm/ioc.svg)](https://github.com/Isqanderm/ioc/issues)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Isqanderm/ioc/blob/main/CONTRIBUTING.md)

Nexus IoC is a powerful and flexible Inversion of Control (IoC) container for TypeScript applications. Inspired by Angular and NestJS, it leverages decorators to provide a simple and efficient way to manage dependencies and modules.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [get() vs resolve()](#get-vs-resolve)
- [Lifecycle and close()](#lifecycle-and-close)
- [Lazy Modules](#lazy-modules)
- [Migrating to the synchronous get()](#migrating-to-the-synchronous-get)
- [Testing](#testing)
- [License](#license)
- [Author](#author)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)
- [Wiki](#wiki)

## Features

- **Modular Architecture**: Easily create and manage modules.
- **Dependency Injection**: Use decorators to inject dependencies into your classes.
- **Lifecycle Management**: Manage the lifecycle of your components seamlessly.
- **Asynchronous Module Loading**: Load modules asynchronously for improved performance.

## Installation

```bash
npm install nexus-ioc reflect-metadata
```

## Quick Start

### Step 1: Define Your Modules and Providers

Create a module and a provider using decorators.

```typescript
import { NsModule, Injectable, Inject } from 'nexus-ioc';

@Injectable()
class DependencyService {
  public readonly name = 'World';
}

@Injectable()
export class AppService {
  constructor(
    @Inject(DependencyService)
    private readonly dependencyService: DependencyService,
  ) {
  }

  getHello(): string {
    return `Hello ${this.dependencyService.name}!`;
  }
}

@NsModule({
  providers: [AppService, DependencyService],
})
export class AppModule {}
```

### Step 2: Create an Application

Create and bootstrap your application.

```typescript
import { NexusApplications } from 'nexus-ioc';
import { AppModule, AppService } from './app.module';

async function bootstrap() {
  const app = await NexusApplications
    .create(AppModule)
    .bootstrap();

  const appService = app.get<AppService>(AppService);

  console.log(appService?.getHello());
}

bootstrap();

```

`get()` is synchronous: singletons are already created when `bootstrap()`
resolves.

## get() vs resolve()

- `app.get(token)` is synchronous and returns an already created singleton.
- `await app.resolve(token)` creates the instance on demand. Use it for
  `Transient` and `Scoped` providers and for providers in lazy mode.

```typescript
const singleton = app.get<AppService>(AppService);
const transient = await app.resolve<TransientService>(TransientService);

// Pass { optional: true } to get undefined instead of an error for an
// unknown token.
const maybe = app.get<AppService>(AppService, { optional: true });
```

`get()` throws:

- `ProviderNotFoundError` — the token is not a provider in this container
  (or its parent). With `{ optional: true }` it returns `undefined` instead.
- `ProviderScopeError` — the provider is `Transient` or `Scoped`; use
  `resolve()`.
- `ProviderNotInstantiatedError` — the singleton has not been created yet
  (`.lazy()` mode, or a lazy module that is not loaded); use `resolve()` or
  `load()` first.
- `ContainerClosedError` — the container is closed or closing.
- `ContainerNotCompiledError` — `bootstrap()` has not run yet. The parent is
  not consulted in this case.

A token found in this container is always answered here; only unknown tokens
are looked up in the parent (set with `setParent()`). Falsy `useValue` values
(`undefined`, `null`, `0`, `false`) are returned as they are.

`resolve()` takes the same `{ optional }` option. It throws
`ProviderNotFoundError`, `ContainerClosedError` and
`ContainerNotCompiledError` the same way.

## Lifecycle and close()

`onModuleInit` runs during `bootstrap()`. `await app.close()` runs
`onModuleDestroy` on every provider in reverse creation order:

```typescript
@Injectable()
class Connection implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.socket.end();
  }
}

await app.close();
```

- A hook that throws does not stop the others. After all of them have run,
  `close()` throws one `AggregateError` with every failure.
- `close()` is idempotent: it returns the same promise on every call, and a
  failed close keeps returning the same rejected promise.
- It first waits for in-flight lazy module loads. A lazy loader that never
  settles makes `close()` hang.
- From the moment `close()` is called (before the in-flight loads have
  drained), `get`, `resolve`, `load` and `unload` (including through a
  `ModuleRef`) throw `ContainerClosedError`. A load that was already in
  flight still finishes, and its singletons are destroyed with the rest.
- `close()` detaches the parent and does not close child containers. A service
  that subscribed to a parent service must unsubscribe in `onModuleDestroy`.
- A `resolve()` that is still in flight when `close()` is called is not
  awaited, so await your `resolve()` calls before closing.

## Lazy Modules

Declare a module import as lazy to keep it out of the initial bundle. The
module is loaded into the same container on demand and its providers become
resolvable afterwards.

```typescript
import { lazy, Module, NexusApplication } from '@nexus-ioc/core';

export const FeatureLazy = lazy(() =>
  import('./feature/feature.module').then((m) => m.FeatureModule),
);

@Module({ imports: [CoreModule, FeatureLazy] })
export class AppModule {}

const app = await NexusApplication.create(AppModule).bootstrap();
const ref = await app.load(FeatureLazy);
const service = ref.get<FeatureService>(FeatureService);
```

`lazy()` also takes a `name`, used in diagnostics, in error messages and, by
the Vite plugin, for chunk naming. Without it every ref is called
`"LazyModule"`, so name the ones you want to recognize:

```typescript
export const FeatureLazy = lazy(
  () => import('./feature/feature.module').then((m) => m.FeatureModule),
  { name: 'Feature' },
);
```

Rules:

- Eager providers cannot depend on providers of a not yet loaded module;
  `bootstrap()` reports it as a missing provider.
- Loading is idempotent: the loader runs once per `lazy()` ref.
- Modules already in the container (for example a `SharedModule` imported by
  both the root and the lazy module) are reused, so singletons are shared.
- A lazy module that registers a token another module already provides fails
  with `PROVIDER_TOKEN_CONFLICT` and is rolled back.

### ModuleRef.get() and ModuleRef.resolve()

`ModuleRef.get()` is synchronous and `ModuleRef.resolve()` is async, with the
same split as on the application: `get()` for singletons, `resolve()` for
`Transient`, `Scoped` and lazy-mode providers. Both are strict by default: they see the module's own providers and
what its imports (and global modules) export to them, and return `undefined`
for every other token — including tokens that do exist elsewhere in the
container. Pass `{ strict: false }` to look the token up in the whole
container instead. Either way the result is `T | undefined`, so check it
(`resolve()` returns `Promise<T | undefined>`):

```typescript
const own = ref.get<FeatureService>(FeatureService); // visible: instance
const other = ref.get<UnrelatedService>(UnrelatedService); // undefined
const anywhere = ref.get<UnrelatedService>(UnrelatedService, {
  strict: false,
});
```

### Errors

- `LazyModuleLoadError` — the loader rejected (a failed dynamic import, for
  example) or did not return a class decorated with `@Module()`. Nothing is
  added to the graph and the ref may be loaded again.
- `LazyModuleGraphError` — the module loaded but its dependency graph is
  invalid (a missing dependency, a cycle, a token conflict). Its `errors`
  property carries the graph errors, and the segment is rolled back entirely,
  so the container is left exactly as it was.

### Loading from a service

To load from a service, inject the built-in `LazyModuleLoader`:

```typescript
@Injectable()
class OrdersService {
  constructor(@Inject(LazyModuleLoader) private readonly loader: LazyModuleLoader) {}

  async check(order: Order) {
    const ref = await this.loader.load(FraudLazy);
    const fraud = ref.get<FraudService>(FraudService);
    return fraud?.check(order);
  }
}
```

Under `@nexus-ioc/testing` the same loader is registered by `Test.compile()`,
so services that inject it work in tests; the `Test` instance itself also has
`load(ref)` once it is compiled.

### Unloading

```typescript
const ref = await app.load(FeatureLazy);
// ... later ...
const { destroyedModules, destroyedProviders } = await app.unload(ref);
```

- `app.unload(ref)`, `ref.unload()`, and `LazyModuleLoader.unload(ref)` all do the
  same thing; use whichever is convenient at the call site.
- Only what nothing else still needs is destroyed: a module shared with
  another loaded segment, a `@Global()` module another segment depends on, or
  a nested lazy module loaded from inside the one being unloaded, are all left
  running.
- `onModuleDestroy` runs on affected singletons in reverse initialization
  order. `ref.loaded` becomes `false`, and `ref.get()` and `ref.resolve()` return
  `undefined` for every token afterward — the ref does not come back to life; loading the
  same `lazy()` ref again returns a new `ModuleRef`.
- Unloading a ref that was never loaded, or unloading it twice, is a no-op:
  `{ destroyedModules: [], destroyedProviders: [] }`. After `app.close()`,
  unloading rejects with `ContainerClosedError`.
- Not handled: an instance obtained via `app.get()` or `ref.get()` and held
  outside the container (for example in a closure) keeps working as a plain
  object after its module is destroyed — the same contract as an Angular
  injector destroyed while a component still holds an already-injected
  instance. A `get()` call racing an unload that destroys the same provider
  mid-resolution is not guarded against. Likewise, calling `load()` on a ref
  while an `unload()` of that same ref is in flight, without awaiting the
  unload first, can return a `ModuleRef` for a segment that is about to be
  destroyed — this race is not guarded against either.

## Testing

### Installation

```bash
npm install @nexus-ioc/testing
```

### Usage 

```typescript
import { Injectable } from '@nexus-ioc/core';
import { Test } from '@nexus-ioc/testing';

describe('AppModule', () => {
  it('should create instance', async () => {
    @Injectable()
    class AppService {}

    const appModule = await Test.createModule({
      providers: [AppService],
    }).compile();

    const appService = appModule.get<AppService>(AppService);
    expect(appService).toBeInstanceOf(AppService);
  });
});
```

`Test.compile()` instantiates all singletons and runs `onModuleInit`, so an
error in `onModuleInit` or in a factory surfaces from `compile()`. `Test.get`
is synchronous and `Test.resolve` is async, both with `{ optional }`. The
module container that `compile()` returns has the same `get()` / `resolve()`
pair, so `moduleRef.get<X>(X)` needs no `await`.
`Test.load()` warms the loaded module.

## Migrating to the synchronous get()

- `get()` no longer returns a promise: drop the `await` for singletons and use
  `await resolve()` for `Transient`, `Scoped` and lazy-mode providers.
- `get()` now throws instead of returning `undefined` for unknown tokens. Pass
  `{ optional: true }` to keep the old `undefined` result.
- `ModuleRef.get()` is synchronous too; the async variant is
  `ModuleRef.resolve()`.
- `Test.compile()` now instantiates singletons and runs `onModuleInit`, so
  errors from them surface from `compile()`.
- The module container returned by `compile()` has a synchronous `get()` and
  a new async `resolve()`. Its `get()` throws `ProviderNotFoundError` for an
  unknown token instead of resolving to `undefined` (pass
  `{ optional: true }`), and throws `ProviderScopeError` for `Transient` and
  `Scoped` providers: use `await moduleRef.resolve(X)` for those.
- `get()` and `resolve()` called before `bootstrap()` throw
  `ContainerNotCompiledError` instead of `ProviderNotFoundError`.
- `.lazy()` is deprecated: lazy modules (`lazy()` / `load()`) cover the
  startup-time use case, and in `.lazy()` mode `get()` throws
  `ProviderNotInstantiatedError`.
- The CLI service-spec template now generates `moduleRef.get<X>(X)` without
  `await`.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Author

Isqanderm (Aleksandr Melnik) - [LinkedIn](www.linkedin.com/in/isqander-melnik)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Acknowledgements

Special thanks to the developers of Angular and NestJS for the inspiration.

## Wiki

For more detailed documentation, please visit the [Wiki](https://github.com/Isqanderm/ioc/wiki).
