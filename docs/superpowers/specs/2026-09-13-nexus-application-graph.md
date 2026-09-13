# Nexus Application Graph — Spec

## Goal

Extend the Nexus semantic layer (`@nexus-ioc/type-checker`) so `NexusApplication`
becomes a real, module-aware dependency graph instead of a graph of classes
reachable only through direct `@Inject(ClassRef)` edges. The graph must be able
to answer "which provider satisfies this dependency token", respecting module
`imports`/`exports` scoping and `@Global()` modules, and must detect dependency
cycles by TypeScript symbol identity rather than class-name strings.

## Background

- `NexusAnalyzer` / `NexusClass` (already merged, `src/analysis/nexus-analyzer.ts`,
  `src/analysis/nexus-semantic-model.ts`) turn a single class declaration into an
  AST-independent semantic model: decorators, dependencies, injection tokens
  resolved via `ts.TypeChecker` (symbol identity, alias resolution).
- `NexusApplicationAnalyzer` / `NexusApplication` (already merged,
  `src/analysis/nexus-application-analyzer.ts`,
  `src/analysis/nexus-application-model.ts`) do BFS reachability from an entry
  point class, but only follow `NexusDependency.token.kind === "reference"`
  edges. They never look at `@NsModule({ imports, providers, exports })`
  metadata — `NexusClass.isModule` / `isGlobal` are booleans only, the
  decorator argument itself is never parsed.
- A parallel implementation of this exact problem already exists and is in
  production: `packages/language-service/src/actions/get-semantic-diagnostics.actions.ts`,
  built entirely on a legacy AST/tsquery stack (`NsModuleParser`,
  `NsModulesParser`, `InjectParser`, `CircularDependencyDetectorHelper`,
  `checkTypesHelper`, `compareTypes`, `findTypeReferences`). That code already
  resolves providers against module imports/exports/globals and detects
  cycles, but matches classes **by name string**
  (`circular-dependency-detector.helper.ts:104-119`), which is the exact
  fragility class `NexusClass` was built to eliminate via symbol identity.

## Requirements

1. Model `@NsModule({ providers, imports, exports })` metadata semantically on
   `NexusClass`, matching the real runtime shapes in
   `packages/ioc/src/interfaces/module-types.interface.ts`
   (`Provider = ClassProvider | ValueProvider | FactoryProvider | Type`) and
   `packages/ioc/src/interfaces/module-metadata.interface.ts`
   (`imports: (Module | DynamicModule)[]`, `exports: (InjectionToken | Module)[]`).
   No AST nodes in the public shape — same discipline as `NexusClass` /
   `NexusDependency`.
2. `NexusApplicationAnalyzer` traversal must also discover classes reachable
   only through module structure — `imports` entries and provider class
   references (`providers: [FooService]` / `{ useClass: FooService }`) — not
   only through direct `@Inject()` references. Today a service registered only
   via a module's `providers` array, and never directly `@Inject()`-ed by
   name, is invisible to the graph.
3. Build a new `NexusApplicationGraph` that, for every class's dependency
   token, resolves the concrete `NexusProvider` that satisfies it, respecting:
   (a) the owning module's own providers, (b) providers exported (directly or
   transitively re-exported) by modules it imports, (c) providers exported by
   any `@Global()` module anywhere in the program. Unresolved *required*
   dependencies are reported explicitly; optional ones are not.
4. Detect dependency cycles across this resolved provider graph using
   `ts.Symbol`/token identity, not class-name strings.
5. Keep the public API AST-free and deterministic — same class/property
   naming and testing discipline as `nexus-application-analyzer.ts`.

## Out of scope (follow-up plans)

- Migrating `packages/language-service` off the legacy parser stack onto this
  new model, and deleting `NsModuleParser` / `NsModulesParser` /
  `InjectParser` / `InjectableParser` / `CircularDependencyDetectorHelper` /
  `checkTypesHelper` / `compareTypes` / `findTypeReferences`.
- `Scope.Singleton/Request/Transient` instance semantics — only captured as
  inert token metadata on `NexusProvider`, never interpreted.
- ESLint rules or compiler code generation consuming the graph.
