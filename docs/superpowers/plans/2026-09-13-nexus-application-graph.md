# Nexus Application Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `@nexus-ioc/type-checker` a real, module-aware application
graph — `NexusModule` semantic metadata on `NexusClass`, module-structure-aware
reachability in `NexusApplicationAnalyzer`, and a new
`NexusApplicationGraphBuilder` that resolves dependency tokens to concrete
providers (own module → imported modules' exports → global modules) and
detects cycles by symbol identity.

**Architecture:** Extend the existing `NexusAnalyzer`/`NexusClass` semantic
model with `NexusProvider`/`NexusModule` types parsed via `ts.TypeChecker`
(no AST leakage, same discipline as existing decorator/dependency parsing).
Extend `NexusApplicationAnalyzer`'s BFS to also traverse module `imports` and
provider-class edges. Add a new, separate `NexusApplicationGraphBuilder` that
consumes the resulting `NexusApplication` and produces a
`NexusApplicationGraph` of resolved/unresolved dependencies and cycles.

**Tech Stack:** TypeScript (`typescript` compiler API via
`typescript/lib/tsserverlibrary`), Vitest, pnpm workspace
(`packages/type-checker`, built against `packages/ioc/dist/types/index.d.ts`).

**Spec:** `docs/superpowers/specs/2026-09-13-nexus-application-graph.md`

## Global Constraints

- No `ts.Node`/AST types in any public `Nexus*` shape — only
  `NexusSourceSpan`, `ts.Symbol` (via `NexusToken`), and plain data.
- Class/provider identity is always `ts.Symbol`-based (via
  `checker.getSymbolAtLocation` + alias resolution), never a name string.
- `@NsModule` metadata keys are exactly `imports` / `providers` / `exports`
  (`packages/ioc/src/interfaces/validate-module-keys.ts:12-16`) — no other
  keys exist and none should be modeled.
- `Provider = ClassProvider | ValueProvider | FactoryProvider | Type<T>`
  (`packages/ioc/src/interfaces/module-types.interface.ts:55-172`).
- `ModuleMetadata.imports: (Module | DynamicModule)[]`,
  `ModuleMetadata.exports: (InjectionToken | Module)[]`
  (`packages/ioc/src/interfaces/module-metadata.interface.ts`).
- Tests build a real `ts.Program` against
  `packages/ioc/dist/types/index.d.ts` (see existing
  `__test__/nexus-analyzer.test.ts` and
  `__test__/nexus-application-analyzer.test.ts` harnesses) — run
  `pnpm --filter @nexus-ioc/ioc build` first if that dist is stale.
- Run tests with `pnpm --filter @nexus-ioc/type-checker test` from repo root,
  or `pnpm vitest run` from `packages/type-checker`.

---

### Task 1: `NexusProvider`/`NexusModule` types + provider parsing in `NexusAnalyzer`

**Files:**
- Modify: `packages/type-checker/src/analysis/nexus-semantic-model.ts`
- Modify: `packages/type-checker/src/analysis/nexus-analyzer.ts`
- Test: `packages/type-checker/__test__/nexus-analyzer.test.ts`

**Interfaces:**
- Produces: `NexusProviderKind = "class" | "useClass" | "useValue" | "useFactory"`,
  `NexusProvider { kind, provide: NexusToken, useClass?: NexusToken,
  factoryInject: readonly NexusToken[], scope?: NexusToken, source: NexusSourceSpan }`,
  `NexusAnalyzer.getModuleProviders(node: ts.ClassDeclaration): NexusProvider[]`
  (private helpers `getModuleDecoratorArgument`, `getObjectLiteralArrayProperty`,
  `findProperty`, `resolveProvider` — used by Task 2's `getModule()`).

- [ ] **Step 1: Write the failing test**

Add to `packages/type-checker/__test__/nexus-analyzer.test.ts`, inside the
`SOURCE` template string, after the existing `GlobalModule` class:

```ts
import {
  Global as NexusGlobal,
  Inject as Dependency,
  Injectable as Service,
  NsModule as Module,
  Optional as Maybe,
  Scope,
} from "@nexus-ioc/core";

@Service()
class ProviderModuleService {}

@Service()
class ProviderModuleServiceImpl {}

@Module({
  providers: [
    ProviderModuleService,
    { provide: ProviderModuleService, useClass: ProviderModuleServiceImpl, scope: Scope.Transient },
    { provide: "CONFIG", useValue: { debug: true } },
    { provide: "DATABASE", useFactory: (config: unknown) => config, inject: ["CONFIG", DependencyA] },
  ],
})
class ProviderModule {}
```

(Add the `Scope` import to the existing `@nexus-ioc/core` import list instead
of duplicating the import statement; `DependencyA` already exists earlier in
`SOURCE`.)

Then add the test itself, in the `describe("NexusAnalyzer", ...)` block:

```ts
it("parses @NsModule providers into semantic NexusProvider entries", () => {
  const { program, sourceFile } = createProgram();
  const analyzer = createNexusAnalyzer(program);

  const providers = analyzer.getModuleProviders(
    getClass(sourceFile, "ProviderModule"),
  );

  expect(providers).toHaveLength(4);

  const [classProvider, useClassProvider, useValueProvider, useFactoryProvider] =
    providers;

  expect(classProvider.kind).toBe("class");
  expect(classProvider.provide).toMatchObject({ kind: "reference" });
  expect(classProvider.factoryInject).toEqual([]);

  expect(useClassProvider.kind).toBe("useClass");
  expect(useClassProvider.provide).toMatchObject({ kind: "reference" });
  expect(useClassProvider.useClass).toMatchObject({ kind: "reference" });
  expect(useClassProvider.scope).toMatchObject({ kind: "reference" });

  expect(useValueProvider.kind).toBe("useValue");
  expect(useValueProvider.provide).toMatchObject({ kind: "string", value: "CONFIG" });
  expect(useValueProvider.useClass).toBeUndefined();

  expect(useFactoryProvider.kind).toBe("useFactory");
  expect(useFactoryProvider.provide).toMatchObject({ kind: "string", value: "DATABASE" });
  expect(useFactoryProvider.factoryInject).toHaveLength(2);
  expect(useFactoryProvider.factoryInject[0]).toMatchObject({ kind: "string", value: "CONFIG" });
  expect(useFactoryProvider.factoryInject[1]).toMatchObject({ kind: "reference" });

  for (const provider of providers) {
    expect(provider).not.toHaveProperty("declaration");
    expect(provider).not.toHaveProperty("expression");
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-analyzer`
Expected: FAIL — `analyzer.getModuleProviders is not a function`

- [ ] **Step 3: Add the types**

In `packages/type-checker/src/analysis/nexus-semantic-model.ts`, append:

```ts
export type NexusProviderKind = "class" | "useClass" | "useValue" | "useFactory";

export type NexusProvider = {
	kind: NexusProviderKind;
	provide: NexusToken;
	useClass?: NexusToken;
	factoryInject: readonly NexusToken[];
	scope?: NexusToken;
	source: NexusSourceSpan;
};
```

- [ ] **Step 4: Implement provider parsing in `NexusAnalyzer`**

In `packages/type-checker/src/analysis/nexus-analyzer.ts`, add `NexusProvider`
to the existing type-only import and re-export blocks (lines 2-18), then add
these public/private members (near `getInjectedMembers`):

```ts
public getModuleProviders(node: ts.ClassDeclaration): NexusProvider[] {
	const metadata = this.getModuleDecoratorArgument(node);
	if (!metadata) return [];

	const array = this.getObjectLiteralArrayProperty(metadata, "providers");
	if (!array) return [];

	return array.elements.flatMap((element) => this.resolveProvider(element));
}

private getModuleDecoratorArgument(
	node: ts.ClassDeclaration,
): ts.ObjectLiteralExpression | undefined {
	if (!ts.canHaveDecorators(node)) return undefined;

	for (const decorator of ts.getDecorators(node) ?? []) {
		if (this.resolveDecoratorKind(decorator) !== "NsModule") continue;
		if (!ts.isCallExpression(decorator.expression)) continue;

		const [argument] = decorator.expression.arguments;
		if (argument && ts.isObjectLiteralExpression(argument)) return argument;
	}

	return undefined;
}

private getObjectLiteralArrayProperty(
	metadata: ts.ObjectLiteralExpression,
	name: "providers" | "imports" | "exports",
): ts.ArrayLiteralExpression | undefined {
	const property = this.findProperty(metadata, name);
	return property && ts.isArrayLiteralExpression(property.initializer)
		? property.initializer
		: undefined;
}

private findProperty(
	object: ts.ObjectLiteralExpression,
	name: string,
): ts.PropertyAssignment | undefined {
	return object.properties.find(
		(item): item is ts.PropertyAssignment =>
			ts.isPropertyAssignment(item) &&
			ts.isIdentifier(item.name) &&
			item.name.text === name,
	);
}

private resolveProvider(element: ts.Expression): NexusProvider[] {
	const source = this.getSourceSpan(element);

	if (!ts.isObjectLiteralExpression(element)) {
		return [
			{
				kind: "class",
				provide: this.resolveToken(element),
				factoryInject: [],
				source,
			},
		];
	}

	const provideProperty = this.findProperty(element, "provide");
	if (!provideProperty) return [];
	const provide = this.resolveToken(provideProperty.initializer);

	const useClassProperty = this.findProperty(element, "useClass");
	const useValueProperty = this.findProperty(element, "useValue");
	const useFactoryProperty = this.findProperty(element, "useFactory");
	const scopeProperty = this.findProperty(element, "scope");
	const scope = scopeProperty
		? this.resolveToken(scopeProperty.initializer)
		: undefined;

	if (useClassProperty) {
		return [
			{
				kind: "useClass",
				provide,
				useClass: this.resolveToken(useClassProperty.initializer),
				factoryInject: [],
				scope,
				source,
			},
		];
	}

	if (useValueProperty) {
		return [{ kind: "useValue", provide, factoryInject: [], source }];
	}

	if (useFactoryProperty) {
		const injectProperty = this.findProperty(element, "inject");
		const factoryInject =
			injectProperty && ts.isArrayLiteralExpression(injectProperty.initializer)
				? injectProperty.initializer.elements.map((item) =>
						this.resolveToken(item),
					)
				: [];

		return [{ kind: "useFactory", provide, factoryInject, scope, source }];
	}

	return [];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-analyzer`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/type-checker/src/analysis/nexus-semantic-model.ts \
  packages/type-checker/src/analysis/nexus-analyzer.ts \
  packages/type-checker/__test__/nexus-analyzer.test.ts
git commit -m "feat(type-checker): parse @NsModule providers into semantic NexusProvider"
```

---

### Task 2: `NexusModule` imports/exports parsing + `NexusAnalyzer.getModule()`

**Files:**
- Modify: `packages/type-checker/src/analysis/nexus-semantic-model.ts`
- Modify: `packages/type-checker/src/analysis/nexus-analyzer.ts`
- Test: `packages/type-checker/__test__/nexus-analyzer.test.ts`

**Interfaces:**
- Consumes: `getModuleDecoratorArgument`, `getObjectLiteralArrayProperty`,
  `findProperty`, `resolveToken`, `resolveAlias` (Task 1 / pre-existing).
- Produces: `NexusModuleImport { module: NexusToken; isDynamic: boolean; source: NexusSourceSpan }`,
  `NexusModuleExport { token: NexusToken; source: NexusSourceSpan }`,
  `NexusModule { providers: readonly NexusProvider[]; imports: readonly NexusModuleImport[]; exports: readonly NexusModuleExport[] }`,
  `NexusAnalyzer.getModule(node: ts.ClassDeclaration): NexusModule | undefined`
  (returns `undefined` when `node` has no `@NsModule(...)` decorator).

- [ ] **Step 1: Write the failing test**

Add to the `SOURCE` fixture in `nexus-analyzer.test.ts`, after `ProviderModule`:

```ts
@Module({})
class LocalImportedModule {}

@Module({
  imports: [LocalImportedModule],
  exports: [ProviderModuleService, "CONFIG"],
})
class ExportingModule {}
```

Add the test:

```ts
it("parses @NsModule imports and exports into semantic tokens", () => {
  const { program, sourceFile } = createProgram();
  const analyzer = createNexusAnalyzer(program);

  const module = analyzer.getModule(getClass(sourceFile, "ExportingModule"));
  if (!module) throw new Error("Expected ExportingModule to be a NexusModule");

  expect(module.imports).toHaveLength(1);
  expect(module.imports[0].isDynamic).toBe(false);
  expect(module.imports[0].module).toMatchObject({ kind: "reference" });
  if (module.imports[0].module.kind !== "reference") throw new Error("unreachable");
  expect(module.imports[0].module.symbol.getName()).toBe("LocalImportedModule");

  expect(module.exports).toHaveLength(2);
  expect(module.exports[0].token).toMatchObject({ kind: "reference" });
  expect(module.exports[1].token).toMatchObject({ kind: "string", value: "CONFIG" });
});

it("returns undefined for getModule() on a non-module class", () => {
  const { program, sourceFile } = createProgram();
  const analyzer = createNexusAnalyzer(program);

  expect(analyzer.getModule(getClass(sourceFile, "ServiceA"))).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-analyzer`
Expected: FAIL — `analyzer.getModule is not a function`

- [ ] **Step 3: Add the types**

Append to `nexus-semantic-model.ts`:

```ts
export type NexusModuleImport = {
	module: NexusToken;
	isDynamic: boolean;
	source: NexusSourceSpan;
};

export type NexusModuleExport = {
	token: NexusToken;
	source: NexusSourceSpan;
};

export type NexusModule = {
	providers: readonly NexusProvider[];
	imports: readonly NexusModuleImport[];
	exports: readonly NexusModuleExport[];
};
```

- [ ] **Step 4: Implement `getModule()` and import/export parsing**

Add `NexusModule`, `NexusModuleExport`, `NexusModuleImport` to the type-only
import/re-export blocks at the top of `nexus-analyzer.ts`, then add:

```ts
public getModule(node: ts.ClassDeclaration): NexusModule | undefined {
	const metadata = this.getModuleDecoratorArgument(node);
	if (!metadata) return undefined;

	return {
		providers: this.getModuleProviders(node),
		imports: this.getModuleImports(metadata),
		exports: this.getModuleExports(metadata),
	};
}

private getModuleImports(
	metadata: ts.ObjectLiteralExpression,
): NexusModuleImport[] {
	const array = this.getObjectLiteralArrayProperty(metadata, "imports");
	if (!array) return [];

	return array.elements.map((element) => ({
		module: this.resolveModuleReference(element),
		isDynamic: ts.isCallExpression(element),
		source: this.getSourceSpan(element),
	}));
}

private getModuleExports(
	metadata: ts.ObjectLiteralExpression,
): NexusModuleExport[] {
	const array = this.getObjectLiteralArrayProperty(metadata, "exports");
	if (!array) return [];

	return array.elements.map((element) => ({
		token: this.resolveToken(element),
		source: this.getSourceSpan(element),
	}));
}

/**
 * Resolves an `imports` array entry to the module class it refers to.
 *
 * A bare class reference (`FooModule`) resolves directly. A dynamic-module
 * call (`FooModule.forRoot(...)`) is resolved through its *return type's*
 * `module` property, so the edge still points at the concrete module class
 * rather than the anonymous `DynamicModule` return value.
 */
private resolveModuleReference(expression: ts.Expression): NexusToken {
	const type = this.checker.getTypeAtLocation(expression);
	const moduleProperty = type.getProperty("module");

	if (moduleProperty) {
		const moduleType = this.checker.getTypeOfSymbolAtLocation(
			moduleProperty,
			expression,
		);
		const symbol = moduleType.getSymbol();
		if (symbol) {
			return {
				kind: "reference",
				symbol: this.resolveAlias(symbol) ?? symbol,
				source: this.getSourceSpan(expression),
			};
		}
	}

	return this.resolveToken(expression);
}
```

Note: `getModule()` returns `undefined` only when there is no `@NsModule(...)`
decorator at all. A class decorated with `@Global()` but not `@NsModule()`
still has `isModule === true` on `NexusClass` (pre-existing behavior) but
`module === undefined` — that quirk is pre-existing and out of scope here.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-analyzer`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/type-checker/src/analysis/nexus-semantic-model.ts \
  packages/type-checker/src/analysis/nexus-analyzer.ts \
  packages/type-checker/__test__/nexus-analyzer.test.ts
git commit -m "feat(type-checker): parse @NsModule imports/exports into NexusModule"
```

---

### Task 3: Wire `NexusModule` into `NexusClass` and public exports

**Files:**
- Modify: `packages/type-checker/src/analysis/nexus-semantic-model.ts`
- Modify: `packages/type-checker/src/analysis/nexus-analyzer.ts`
- Modify: `packages/type-checker/src/index.ts`
- Test: `packages/type-checker/__test__/nexus-analyzer.test.ts`

**Interfaces:**
- Consumes: `NexusAnalyzer.getModule()` (Task 2).
- Produces: `NexusClass.module?: NexusModule` (new optional field, populated
  exactly when `getModule()` returns a value).

- [ ] **Step 1: Write the failing test**

Add to `nexus-analyzer.test.ts`:

```ts
it("attaches module metadata to NexusClass.module for @NsModule classes", () => {
  const { program, sourceFile } = createProgram();
  const analyzer = createNexusAnalyzer(program);

  const exportingModule = analyzer.getClass(getClass(sourceFile, "ExportingModule"));
  expect(exportingModule.module).toBeDefined();
  expect(exportingModule.module?.imports).toHaveLength(1);

  const service = analyzer.getClass(getClass(sourceFile, "ServiceA"));
  expect(service.module).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-analyzer`
Expected: FAIL — `exportingModule.module` is `undefined`

- [ ] **Step 3: Add the field**

In `nexus-semantic-model.ts`, add `module?: NexusModule;` to the `NexusClass`
type (after `isGlobal: boolean;`).

- [ ] **Step 4: Wire it into `getClass()`**

In `nexus-analyzer.ts`, update `getClass()`:

```ts
public getClass(node: ts.ClassDeclaration): NexusClass {
	const decorators = this.getDecorators(node);
	const dependencies = this.getInjectedMembers(node);

	return {
		name: node.name?.text,
		source: this.getSourceSpan(node),
		decorators,
		dependencies,
		isInjectable: decorators.some((item) => item.kind === "Injectable"),
		isModule: decorators.some(
			(item) => item.kind === "NsModule" || item.kind === "Global",
		),
		isGlobal: decorators.some((item) => item.kind === "Global"),
		module: this.getModule(node),
	};
}
```

- [ ] **Step 5: Export the new types**

In `packages/type-checker/src/index.ts`, add `NexusModule`, `NexusModuleImport`,
`NexusModuleExport`, `NexusProvider`, `NexusProviderKind` to the existing
`export type { ... } from "./analysis/nexus-semantic-model";` block, and add
them to the matching re-export block in `nexus-analyzer.ts` (lines 11-18).

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-analyzer`
Expected: PASS

- [ ] **Step 7: Run the full type-checker test suite**

Run: `pnpm --filter @nexus-ioc/type-checker test`
Expected: PASS (confirms `nexus-application-analyzer.test.ts`'s
"returns AST-independent semantic classes" test still passes — it does not
assert against `module`, so an added optional field is safe).

- [ ] **Step 8: Commit**

```bash
git add packages/type-checker/src/analysis/nexus-semantic-model.ts \
  packages/type-checker/src/analysis/nexus-analyzer.ts \
  packages/type-checker/src/index.ts \
  packages/type-checker/__test__/nexus-analyzer.test.ts
git commit -m "feat(type-checker): attach NexusModule metadata to NexusClass"
```

---

### Task 4: Module-structure-aware reachability in `NexusApplicationAnalyzer`

**Files:**
- Modify: `packages/type-checker/src/analysis/nexus-application-analyzer.ts`
- Test: `packages/type-checker/__test__/nexus-application-analyzer.test.ts`

**Interfaces:**
- Consumes: `NexusClass.module` (Task 3).
- Produces: no new public API — `NexusApplicationAnalyzer.analyze()` keeps its
  existing signature, but now also enqueues classes reachable through
  `module.imports[].module` and `module.providers[].provide` /
  `module.providers[].useClass` tokens (in addition to the existing
  `dependency.token` traversal).

**Why:** today a service registered only via `providers: [FooService]` in a
module's `@NsModule(...)`, and never `@Inject()`-ed by name anywhere, is
invisible to `NexusApplication` — the BFS in
`nexus-application-analyzer.ts:36-51` only walks `nexusClass.dependencies`.
Real apps register most services this way, so this is the actual gap between
"class reachability" and "application graph".

- [ ] **Step 1: Write the failing test**

Add a new module file to the `FILES` map in
`nexus-application-analyzer.test.ts` and reference it from `AppModule`,
without adding any direct `@Inject()` reference to the new service:

```ts
[
	"/app/app.module.ts",
	`import { Inject as Dependency, NsModule as Module } from "@nexus-ioc/core";
import { FirstService, SecondService } from "../services";
import { UnreachableService } from "../services/unreachable";
import { CycleA as RootCycleA } from "../services/cycle-a";
import { DatabaseModule } from "../services/database.module";

void UnreachableService;
void RootCycleA;

@Module({ imports: [DatabaseModule] })
export class AppModule {
  constructor(
    @Dependency(FirstService) first: FirstService,
    @Dependency(SecondService) second: SecondService,
  ) {}
}
`,
],
```

```ts
[
	"/services/database.module.ts",
	`import { Injectable as Service, NsModule as Module } from "@nexus-ioc/core";

@Service()
export class DatabaseService {}

@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
`,
],
```

Add the test:

```ts
it("discovers classes reachable only through module imports and providers", () => {
	const { program, entryPoint } = createProgram();
	const analyzer = createNexusAnalyzer(program);
	const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);

	const application = applicationAnalyzer.analyze(entryPoint);
	const names = application.classes.map((item) => item.name);

	expect(names).toContain("DatabaseModule");
	expect(names).toContain("DatabaseService");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-application-analyzer`
Expected: FAIL — `names` does not contain `"DatabaseModule"` / `"DatabaseService"`

- [ ] **Step 3: Implement the extra traversal edges**

Replace the body of `analyze()` in `nexus-application-analyzer.ts` (the
`while` loop and the old `resolveClassFromToken`-only edge logic):

```ts
public analyze(entryPoint: ts.ClassDeclaration): NexusApplication {
	const classes: NexusClass[] = [];
	const visited = new Set<ts.Symbol>();
	const pending: ts.ClassDeclaration[] = [entryPoint];
	const entryPointSymbol = this.getClassSymbol(entryPoint);

	if (entryPointSymbol) {
		visited.add(entryPointSymbol);
	}

	let index = 0;
	while (index < pending.length) {
		const node = pending[index++];
		const nexusClass = this.analyzer.getClass(node);
		classes.push(nexusClass);

		for (const dependency of nexusClass.dependencies) {
			this.enqueue(dependency.token, pending, visited);
		}

		for (const moduleImport of nexusClass.module?.imports ?? []) {
			this.enqueue(moduleImport.module, pending, visited);
		}

		for (const provider of nexusClass.module?.providers ?? []) {
			this.enqueue(provider.provide, pending, visited);
			this.enqueue(provider.useClass, pending, visited);
		}
	}

	return {
		entryPoint: this.getSourceSpan(entryPoint),
		classes,
	};
}

private enqueue(
	token: NexusToken | undefined,
	pending: ts.ClassDeclaration[],
	visited: Set<ts.Symbol>,
): void {
	const next = this.resolveClassFromToken(token);
	if (!next) return;

	const symbol = this.getClassSymbol(next);
	if (!symbol || visited.has(symbol)) return;

	visited.add(symbol);
	pending.push(next);
}
```

(`resolveClassFromToken`, `getClassSymbol`, `getSourceSpan` stay unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-application-analyzer`
Expected: the new test PASSES, but the pre-existing
"discovers reachable Nexus classes across multiple files" test now FAILS,
because `AppModule` in the shared fixture now also imports `DatabaseModule`.
Update its two `toEqual` arrays (`nexus-application-analyzer.test.ts:221-234`)
to append the two new entries, in BFS order (dependency edges are enqueued
before module-import edges, so `DatabaseModule`/`DatabaseService` land after
the existing five):

```ts
expect(application.classes.map((item) => item.name)).toEqual([
	"AppModule",
	"ServiceA",
	"ServiceB",
	"SharedService",
	"LeafService",
	"DatabaseModule",
	"DatabaseService",
]);
expect(application.classes.map((item) => item.source.fileName)).toEqual([
	"/app/app.module.ts",
	"/services/service-a.ts",
	"/services/service-b.ts",
	"/services/shared-service.ts",
	"/services/leaf-service.ts",
	"/services/database.module.ts",
	"/services/database.module.ts",
]);
```

Re-run after this edit: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-application-analyzer`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add packages/type-checker/src/analysis/nexus-application-analyzer.ts \
  packages/type-checker/__test__/nexus-application-analyzer.test.ts
git commit -m "feat(type-checker): traverse module imports and providers as reachability edges"
```

---

### Task 5: `NexusApplicationGraph` model + provider indexing in a new graph builder

**Files:**
- Create: `packages/type-checker/src/analysis/nexus-application-graph-model.ts`
- Create: `packages/type-checker/src/analysis/nexus-application-graph-builder.ts`
- Test: `packages/type-checker/__test__/nexus-application-graph-builder.test.ts`

**Interfaces:**
- Consumes: `NexusApplication`, `NexusClass`, `NexusModule`, `NexusProvider`,
  `NexusToken` (Tasks 1-4), `NexusAnalyzer.getTypeChecker()`.
- Produces: `NexusResolvedDependency { class: NexusClass; dependencyName: string; provider: NexusProvider; providingModule: NexusClass }`,
  `NexusUnresolvedDependency { class: NexusClass; dependencyName: string; token: NexusToken | undefined; source: NexusSourceSpan }`,
  `NexusProviderCycle { path: readonly NexusProvider[] }`,
  `NexusApplicationGraph { resolved: readonly NexusResolvedDependency[]; unresolved: readonly NexusUnresolvedDependency[]; cycles: readonly NexusProviderCycle[] }`,
  `NexusApplicationGraphBuilder` class with a `build(application: NexusApplication): NexusApplicationGraph`
  method (implemented fully in Task 6-7; this task lands the model plus the
  private indexing helpers `indexModulesBySymbol`, `resolveOwnProviderMap`,
  `resolveExportedProviders`, `resolveVisibleProviders`, `classSymbol`, tested
  indirectly through a minimal `build()` that only fills in
  already-resolvable single-module cases).

- [ ] **Step 1: Write the failing test**

Create `packages/type-checker/__test__/nexus-application-graph-builder.test.ts`:

```ts
import * as path from "node:path";
import * as ts from "typescript/lib/tsserverlibrary";
import { describe, expect, it } from "vitest";
import {
	createNexusAnalyzer,
	createNexusApplicationAnalyzer,
	createNexusApplicationGraphBuilder,
} from "../src";

const FILES = new Map<string, string>([
	[
		"/app/app.module.ts",
		`import { Injectable as Service, NsModule as Module } from "@nexus-ioc/core";

@Service()
export class LocalService {}

@Module({ providers: [LocalService] })
export class AppModule {}
`,
	],
]);

function createProgram(
	entryFileName = "/app/app.module.ts",
	entryClassName = "AppModule",
	files = FILES,
): { program: ts.Program; entryPoint: ts.ClassDeclaration } {
	const options: ts.CompilerOptions = {
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.CommonJS,
		moduleResolution: ts.ModuleResolutionKind.NodeJs,
		experimentalDecorators: true,
		strict: true,
		skipLibCheck: true,
	};
	const nexusCoreTypes = path.resolve(
		process.cwd(),
		"../ioc/dist/types/index.d.ts",
	);
	const normalizePath = (fileName: string): string =>
		path.posix.normalize(fileName);

	const defaultHost = ts.createCompilerHost(options, true);
	const host: ts.CompilerHost = {
		...defaultHost,
		getCurrentDirectory: () => "/",
		fileExists: (fileName) => {
			const normalizedFileName = normalizePath(fileName);
			return (
				normalizedFileName === normalizePath(nexusCoreTypes) ||
				files.has(normalizedFileName) ||
				defaultHost.fileExists(fileName)
			);
		},
		directoryExists: (directoryName) => {
			const normalizedDirectory = normalizePath(directoryName);
			if (normalizedDirectory === "/" || normalizedDirectory === ".") {
				return true;
			}
			return (
				[...files.keys()].some((fileName) =>
					normalizePath(fileName).startsWith(`${normalizedDirectory}/`),
				) || defaultHost.directoryExists(directoryName)
			);
		},
		readFile: (fileName) => {
			const normalizedFileName = normalizePath(fileName);
			return normalizedFileName === normalizePath(nexusCoreTypes)
				? defaultHost.readFile(fileName)
				: (files.get(normalizedFileName) ?? defaultHost.readFile(fileName));
		},
		getSourceFile: (fileName, languageVersion) => {
			const normalizedFileName = normalizePath(fileName);
			const text = files.get(normalizedFileName);
			if (text !== undefined) {
				return ts.createSourceFile(normalizedFileName, text, languageVersion, true);
			}
			return defaultHost.getSourceFile(fileName, languageVersion);
		},
		resolveModuleNames: (moduleNames, containingFile) =>
			moduleNames.map((moduleName) => {
				if (moduleName === "@nexus-ioc/core") {
					return {
						resolvedFileName: nexusCoreTypes,
						extension: ts.Extension.Dts,
						isExternalLibraryImport: true,
					};
				}
				return ts.resolveModuleName(moduleName, containingFile, options, host)
					.resolvedModule;
			}),
	};

	const program = ts.createProgram([entryFileName], options, host);
	const sourceFile = program.getSourceFile(entryFileName);
	if (!sourceFile) throw new Error("Entry point source file was not created");

	const entryPoint = sourceFile.statements.find(
		(statement): statement is ts.ClassDeclaration =>
			ts.isClassDeclaration(statement) && statement.name?.text === entryClassName,
	);
	if (!entryPoint) throw new Error(`${entryClassName} not found`);

	return { program, entryPoint };
}

describe("NexusApplicationGraphBuilder", () => {
	it("indexes a module's own providers and finds no dependencies to resolve yet", () => {
		const { program, entryPoint } = createProgram();
		const analyzer = createNexusAnalyzer(program);
		const applicationAnalyzer = createNexusApplicationAnalyzer(analyzer);
		const graphBuilder = createNexusApplicationGraphBuilder(analyzer);

		const application = applicationAnalyzer.analyze(entryPoint);
		const graph = graphBuilder.build(application);

		expect(graph.resolved).toEqual([]);
		expect(graph.unresolved).toEqual([]);
		expect(graph.cycles).toEqual([]);
	});
});
```

(This fixture has no injected dependencies at all, so `resolved`/`unresolved`
are trivially empty — this task only proves the builder exists, compiles,
and returns well-typed empty results; Task 6 adds the real resolution tests.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-application-graph-builder`
Expected: FAIL — module `../src` has no exported member
`createNexusApplicationGraphBuilder`

- [ ] **Step 3: Create the graph model file**

Create `packages/type-checker/src/analysis/nexus-application-graph-model.ts`:

```ts
import type {
	NexusClass,
	NexusProvider,
	NexusSourceSpan,
	NexusToken,
} from "./nexus-semantic-model";

export type NexusResolvedDependency = {
	class: NexusClass;
	dependencyName: string;
	provider: NexusProvider;
	providingModule: NexusClass;
};

export type NexusUnresolvedDependency = {
	class: NexusClass;
	dependencyName: string;
	token: NexusToken | undefined;
	source: NexusSourceSpan;
};

export type NexusProviderCycle = {
	path: readonly NexusProvider[];
};

/**
 * Resolved view of a `NexusApplication`: which provider satisfies each
 * dependency, honoring module `imports`/`exports` scoping and `@Global()`
 * modules, plus any provider dependency cycles found in the process.
 */
export type NexusApplicationGraph = {
	resolved: readonly NexusResolvedDependency[];
	unresolved: readonly NexusUnresolvedDependency[];
	cycles: readonly NexusProviderCycle[];
};
```

- [ ] **Step 4: Create the graph builder skeleton with provider indexing**

Create `packages/type-checker/src/analysis/nexus-application-graph-builder.ts`:

```ts
import * as ts from "typescript";
import type { NexusAnalyzer } from "./nexus-analyzer";
import type { NexusApplication } from "./nexus-application-model";
import type {
	NexusApplicationGraph,
	NexusProviderCycle,
	NexusResolvedDependency,
	NexusUnresolvedDependency,
} from "./nexus-application-graph-model";
import type { NexusClass, NexusProvider, NexusToken } from "./nexus-semantic-model";

/** Stable identity for a dependency token: a string token key, or the
 * underlying `ts.Symbol` for class/symbol tokens. `undefined` means the
 * token cannot be statically matched (e.g. an arbitrary expression). */
type TokenIdentity = string | ts.Symbol;

function getTokenIdentity(token: NexusToken | undefined): TokenIdentity | undefined {
	if (!token) return undefined;
	switch (token.kind) {
		case "string":
			return `string:${token.value}`;
		case "reference":
			return token.symbol;
		case "symbol":
			return token.declaration;
		case "expression":
			return undefined;
		default:
			return undefined;
	}
}

function isSymbolIdentity(identity: TokenIdentity): identity is ts.Symbol {
	return typeof identity !== "string";
}

/** Resolves a `NexusApplication` into a module-scoped dependency graph. */
export class NexusApplicationGraphBuilder {
	public constructor(private readonly analyzer: NexusAnalyzer) {}

	public build(application: NexusApplication): NexusApplicationGraph {
		const moduleClasses = application.classes.filter(
			(item): item is NexusClass & { module: NonNullable<NexusClass["module"]> } =>
				item.module !== undefined,
		);
		const moduleBySymbol = this.indexModulesBySymbol(moduleClasses);
		const globalModules = moduleClasses.filter((item) => item.isGlobal);

		const visibleProvidersByModule = new Map<
			ts.Symbol,
			Map<TokenIdentity, { provider: NexusProvider; owner: NexusClass }>
		>();
		for (const moduleClass of moduleClasses) {
			const symbol = this.classSymbol(moduleClass);
			if (!symbol) continue;
			visibleProvidersByModule.set(
				symbol,
				this.resolveVisibleProviders(moduleClass, moduleBySymbol, globalModules),
			);
		}

		const providingModulesByClassSymbol = this.indexProvidersByClassSymbol(
			moduleClasses,
		);

		const resolved: NexusResolvedDependency[] = [];
		const unresolved: NexusUnresolvedDependency[] = [];

		for (const nexusClass of application.classes) {
			const scopes = this.resolveScopesFor(
				nexusClass,
				providingModulesByClassSymbol,
				visibleProvidersByModule,
				moduleBySymbol,
				globalModules,
			);

			for (const dependency of nexusClass.dependencies) {
				const identity = getTokenIdentity(dependency.token);
				const match =
					identity !== undefined
						? scopes.map((scope) => scope.get(identity)).find(Boolean)
						: undefined;

				if (match) {
					resolved.push({
						class: nexusClass,
						dependencyName: dependency.name,
						provider: match.provider,
						providingModule: match.owner,
					});
				} else if (!dependency.optional) {
					unresolved.push({
						class: nexusClass,
						dependencyName: dependency.name,
						token: dependency.token,
						source: dependency.source,
					});
				}
			}
		}

		return {
			resolved,
			unresolved,
			cycles: this.detectCycles(moduleClasses, providingModulesByClassSymbol),
		};
	}

	private resolveScopesFor(
		nexusClass: NexusClass,
		providingModulesByClassSymbol: Map<ts.Symbol, NexusClass[]>,
		visibleProvidersByModule: Map<
			ts.Symbol,
			Map<TokenIdentity, { provider: NexusProvider; owner: NexusClass }>
		>,
		moduleBySymbol: Map<ts.Symbol, NexusClass>,
		globalModules: readonly NexusClass[],
	): Map<TokenIdentity, { provider: NexusProvider; owner: NexusClass }>[] {
		if (nexusClass.module) {
			const symbol = this.classSymbol(nexusClass);
			const cached = symbol && visibleProvidersByModule.get(symbol);
			return [
				cached ??
					this.resolveVisibleProviders(nexusClass, moduleBySymbol, globalModules),
			];
		}

		const symbol = this.classSymbol(nexusClass);
		const owningModules = symbol
			? (providingModulesByClassSymbol.get(symbol) ?? [])
			: [];

		return owningModules.map((owner) => {
			const ownerSymbol = this.classSymbol(owner);
			const cached = ownerSymbol && visibleProvidersByModule.get(ownerSymbol);
			return (
				cached ??
				this.resolveVisibleProviders(owner, moduleBySymbol, globalModules)
			);
		});
	}

	private indexModulesBySymbol(
		moduleClasses: readonly NexusClass[],
	): Map<ts.Symbol, NexusClass> {
		const map = new Map<ts.Symbol, NexusClass>();
		for (const moduleClass of moduleClasses) {
			const symbol = this.classSymbol(moduleClass);
			if (symbol) map.set(symbol, moduleClass);
		}
		return map;
	}

	/** Maps a provided class's symbol to every module that registers it. */
	private indexProvidersByClassSymbol(
		moduleClasses: readonly NexusClass[],
	): Map<ts.Symbol, NexusClass[]> {
		const map = new Map<ts.Symbol, NexusClass[]>();

		for (const moduleClass of moduleClasses) {
			for (const provider of moduleClass.module?.providers ?? []) {
				const providedSymbol = this.classProviderSymbol(provider);
				if (!providedSymbol) continue;

				const owners = map.get(providedSymbol) ?? [];
				owners.push(moduleClass);
				map.set(providedSymbol, owners);
			}
		}

		return map;
	}

	/** The symbol of the concrete class a provider instantiates, if any
	 * (`kind: "class"` or `"useClass"` only — `useValue`/`useFactory`
	 * provide a token, not a class). */
	private classProviderSymbol(provider: NexusProvider): ts.Symbol | undefined {
		const token =
			provider.kind === "useClass" ? provider.useClass : provider.provide;
		return token?.kind === "reference" ? token.symbol : undefined;
	}

	private resolveOwnProviderMap(
		moduleClass: NexusClass,
	): Map<TokenIdentity, NexusProvider> {
		const map = new Map<TokenIdentity, NexusProvider>();
		for (const provider of moduleClass.module?.providers ?? []) {
			const identity = getTokenIdentity(provider.provide);
			if (identity !== undefined) map.set(identity, provider);
		}
		return map;
	}

	private resolveExportedProviders(
		moduleClass: NexusClass,
		moduleBySymbol: Map<ts.Symbol, NexusClass>,
		visiting: Set<ts.Symbol> = new Set(),
	): Map<TokenIdentity, NexusProvider> {
		const symbol = this.classSymbol(moduleClass);
		if (symbol) {
			if (visiting.has(symbol)) return new Map();
			visiting.add(symbol);
		}

		const ownProviders = this.resolveOwnProviderMap(moduleClass);
		const result = new Map<TokenIdentity, NexusProvider>();

		for (const exportEntry of moduleClass.module?.exports ?? []) {
			const identity = getTokenIdentity(exportEntry.token);
			if (identity === undefined) continue;

			const ownMatch = ownProviders.get(identity);
			if (ownMatch) {
				result.set(identity, ownMatch);
				continue;
			}

			if (isSymbolIdentity(identity)) {
				const referencedModule = moduleBySymbol.get(identity);
				if (referencedModule) {
					for (const [nestedIdentity, provider] of this.resolveExportedProviders(
						referencedModule,
						moduleBySymbol,
						visiting,
					)) {
						result.set(nestedIdentity, provider);
					}
				}
			}
		}

		return result;
	}

	private resolveVisibleProviders(
		moduleClass: NexusClass,
		moduleBySymbol: Map<ts.Symbol, NexusClass>,
		globalModules: readonly NexusClass[],
	): Map<TokenIdentity, { provider: NexusProvider; owner: NexusClass }> {
		const visible = new Map<
			TokenIdentity,
			{ provider: NexusProvider; owner: NexusClass }
		>();

		for (const [identity, provider] of this.resolveOwnProviderMap(moduleClass)) {
			visible.set(identity, { provider, owner: moduleClass });
		}

		for (const importEntry of moduleClass.module?.imports ?? []) {
			const identity = getTokenIdentity(importEntry.module);
			if (identity === undefined || !isSymbolIdentity(identity)) continue;

			const importedModule = moduleBySymbol.get(identity);
			if (!importedModule) continue;

			for (const [exportedIdentity, provider] of this.resolveExportedProviders(
				importedModule,
				moduleBySymbol,
			)) {
				visible.set(exportedIdentity, { provider, owner: importedModule });
			}
		}

		for (const globalModule of globalModules) {
			for (const [exportedIdentity, provider] of this.resolveExportedProviders(
				globalModule,
				moduleBySymbol,
			)) {
				if (!visible.has(exportedIdentity)) {
					visible.set(exportedIdentity, { provider, owner: globalModule });
				}
			}
		}

		return visible;
	}

	private classSymbol(nexusClass: NexusClass): ts.Symbol | undefined {
		// Placeholder until Task 6 wires this to the real class declaration;
		// Task 5 only needs module-to-module identity, resolved via imports/exports
		// tokens which already carry `ts.Symbol`, so this is filled in Task 6.
		return undefined;
	}

	private detectCycles(
		_moduleClasses: readonly NexusClass[],
		_providingModulesByClassSymbol: Map<ts.Symbol, NexusClass[]>,
	): NexusProviderCycle[] {
		return [];
	}
}

export function createNexusApplicationGraphBuilder(
	analyzer: NexusAnalyzer,
): NexusApplicationGraphBuilder {
	return new NexusApplicationGraphBuilder(analyzer);
}
```

> This step intentionally lands with `classSymbol()` stubbed to `undefined`
> and `detectCycles()` stubbed to `[]` — Task 6 replaces `classSymbol` with a
> real symbol lookup (needed for correct provider-ownership indexing) and
> Task 7 implements cycle detection. The test in this task only exercises the
> no-op case, so it is correct as written despite the stubs.

- [ ] **Step 5: Export from the package**

In `packages/type-checker/src/index.ts`, add:

```ts
export {
	createNexusApplicationGraphBuilder,
	NexusApplicationGraphBuilder,
} from "./analysis/nexus-application-graph-builder";
export type {
	NexusApplicationGraph,
	NexusProviderCycle,
	NexusResolvedDependency,
	NexusUnresolvedDependency,
} from "./analysis/nexus-application-graph-model";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-application-graph-builder`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/type-checker/src/analysis/nexus-application-graph-model.ts \
  packages/type-checker/src/analysis/nexus-application-graph-builder.ts \
  packages/type-checker/src/index.ts \
  packages/type-checker/__test__/nexus-application-graph-builder.test.ts
git commit -m "feat(type-checker): add NexusApplicationGraphBuilder skeleton and provider indexing"
```

---

### Task 6: Real `classSymbol()` + dependency resolution across own/import/global scopes

**Files:**
- Modify: `packages/type-checker/src/analysis/nexus-application-graph-builder.ts`
- Test: `packages/type-checker/__test__/nexus-application-graph-builder.test.ts`

**Interfaces:**
- Consumes: `NexusAnalyzer.getProgram()`, `NexusClass.source` (for locating
  the class declaration node from a `NexusClass` by source span).
- Produces: correct `classSymbol()` (no longer a stub) — everything else in
  `build()` becomes live.

**Why `classSymbol` needs the program:** `NexusClass` is AST-free, so the
builder must re-locate the `ts.ClassDeclaration` for a given `NexusClass` by
its `source` span (file name + start) to ask the type checker for its symbol.
This mirrors how `NexusApplicationAnalyzer.getClassSymbol` works, but starting
from a `NexusClass` instead of a `ts.ClassDeclaration`.

- [ ] **Step 1: Write the failing tests**

Add three fixtures to `nexus-application-graph-builder.test.ts`'s `FILES` map
(or a second `FILES2` map + second `createProgram(...)` call, following the
existing helper's `files` parameter) and three tests:

```ts
const MULTI_MODULE_FILES = new Map<string, string>([
	[
		"/app/app.module.ts",
		`import { Injectable as Service, Inject as Dependency, NsModule as Module } from "@nexus-ioc/core";
import { DatabaseModule } from "./database.module";
import { DatabaseService } from "./database.module";

@Service()
export class RepositoryService {
  constructor(@Dependency(DatabaseService) db: DatabaseService) {}
}

@Module({ imports: [DatabaseModule], providers: [RepositoryService] })
export class AppModule {}
`,
	],
	[
		"/app/database.module.ts",
		`import { Injectable as Service, NsModule as Module } from "@nexus-ioc/core";

@Service()
export class DatabaseService {}

@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
`,
	],
]);

const UNRESOLVED_FILES = new Map<string, string>([
	[
		"/app/app.module.ts",
		`import { Injectable as Service, Inject as Dependency, NsModule as Module, Optional as Maybe } from "@nexus-ioc/core";

@Service()
export class OrphanService {
  constructor(
    @Dependency("MISSING_CONFIG") config: unknown,
    @Dependency("MISSING_OPTIONAL") @Maybe() optional: unknown,
  ) {}
}

@Module({ providers: [OrphanService] })
export class AppModule {}
`,
	],
]);

const GLOBAL_MODULE_FILES = new Map<string, string>([
	[
		"/app/app.module.ts",
		`import { Injectable as Service, Inject as Dependency, NsModule as Module } from "@nexus-ioc/core";
import { LoggerModule } from "./logger.module";

@Service()
export class ConsumerService {
  constructor(@Dependency("LOGGER") logger: unknown) {}
}

@Module({ imports: [LoggerModule], providers: [ConsumerService] })
export class AppModule {}
`,
	],
	[
		"/app/logger.module.ts",
		`import { Global as NexusGlobal, NsModule as Module } from "@nexus-ioc/core";

@Module({ providers: [{ provide: "LOGGER", useValue: console }], exports: ["LOGGER"] })
@NexusGlobal()
export class LoggerModule {}
`,
	],
]);
```

```ts
it("resolves a dependency through an imported module's exported provider", () => {
	const { program, entryPoint } = createProgram("/app/app.module.ts", "AppModule", MULTI_MODULE_FILES);
	const analyzer = createNexusAnalyzer(program);
	const application = createNexusApplicationAnalyzer(analyzer).analyze(entryPoint);
	const graph = createNexusApplicationGraphBuilder(analyzer).build(application);

	expect(graph.unresolved).toEqual([]);
	expect(graph.resolved).toHaveLength(1);
	expect(graph.resolved[0].dependencyName).toBe("db");
	expect(graph.resolved[0].providingModule.name).toBe("DatabaseModule");
	expect(graph.resolved[0].provider.kind).toBe("class");
});

it("reports a missing required dependency and skips an unresolved optional one", () => {
	const { program, entryPoint } = createProgram("/app/app.module.ts", "AppModule", UNRESOLVED_FILES);
	const analyzer = createNexusAnalyzer(program);
	const application = createNexusApplicationAnalyzer(analyzer).analyze(entryPoint);
	const graph = createNexusApplicationGraphBuilder(analyzer).build(application);

	expect(graph.resolved).toEqual([]);
	expect(graph.unresolved).toHaveLength(1);
	expect(graph.unresolved[0].dependencyName).toBe("config");
});

it("resolves a dependency exported by a @Global() module without an explicit import", () => {
	const { program, entryPoint } = createProgram("/app/app.module.ts", "AppModule", GLOBAL_MODULE_FILES);
	const analyzer = createNexusAnalyzer(program);
	const application = createNexusApplicationAnalyzer(analyzer).analyze(entryPoint);
	const graph = createNexusApplicationGraphBuilder(analyzer).build(application);

	expect(graph.unresolved).toEqual([]);
	expect(graph.resolved).toHaveLength(1);
	expect(graph.resolved[0].providingModule.name).toBe("LoggerModule");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-application-graph-builder`
Expected: FAIL — `classSymbol()` always returns `undefined`, so nothing
resolves; all three new tests fail (first two expect `resolved`/`unresolved`
entries that never appear because ownership indexing is empty).

- [ ] **Step 3: Implement `classSymbol()`**

Replace the stub in `nexus-application-graph-builder.ts`:

```ts
private classSymbol(nexusClass: NexusClass): ts.Symbol | undefined {
	const sourceFile = this.analyzer
		.getProgram()
		.getSourceFile(nexusClass.source.fileName);
	if (!sourceFile) return undefined;

	const declaration = this.findClassDeclarationAtSpan(
		sourceFile,
		nexusClass.source.start,
	);
	if (!declaration?.name) return undefined;

	return this.analyzer.getTypeChecker().getSymbolAtLocation(declaration.name);
}

private findClassDeclarationAtSpan(
	node: ts.Node,
	start: number,
): ts.ClassDeclaration | undefined {
	if (ts.isClassDeclaration(node) && node.getStart() === start) return node;

	for (const child of node.getChildren()) {
		if (child.getFullStart() > start || child.getEnd() < start) continue;
		const match = this.findClassDeclarationAtSpan(child, start);
		if (match) return match;
	}

	return undefined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-application-graph-builder`
Expected: PASS — all tests, including the Task 5 no-op test.

- [ ] **Step 5: Commit**

```bash
git add packages/type-checker/src/analysis/nexus-application-graph-builder.ts \
  packages/type-checker/__test__/nexus-application-graph-builder.test.ts
git commit -m "feat(type-checker): resolve dependencies across own/imported/global module scopes"
```

---

### Task 7: Provider-cycle detection by symbol identity

**Files:**
- Modify: `packages/type-checker/src/analysis/nexus-application-graph-builder.ts`
- Test: `packages/type-checker/__test__/nexus-application-graph-builder.test.ts`

**Interfaces:**
- Produces: real `detectCycles()` — `NexusApplicationGraph.cycles` is now
  populated for `useFactory` provider `inject` cycles (symbol-identity based,
  replacing the legacy string-based `CircularDependencyDetectorHelper`
  algorithm this graph is meant to eventually subsume).

- [ ] **Step 1: Write the failing test**

Add a fixture with two factory providers in the same module that inject each
other by token, and one test:

```ts
const FACTORY_CYCLE_FILES = new Map<string, string>([
	[
		"/app/app.module.ts",
		`import { NsModule as Module } from "@nexus-ioc/core";

@Module({
  providers: [
    { provide: "A", useFactory: (b: unknown) => b, inject: ["B"] },
    { provide: "B", useFactory: (a: unknown) => a, inject: ["A"] },
  ],
})
export class AppModule {}
`,
	],
]);

it("detects a cycle between two factory providers by token identity", () => {
	const { program, entryPoint } = createProgram("/app/app.module.ts", "AppModule", FACTORY_CYCLE_FILES);
	const analyzer = createNexusAnalyzer(program);
	const application = createNexusApplicationAnalyzer(analyzer).analyze(entryPoint);
	const graph = createNexusApplicationGraphBuilder(analyzer).build(application);

	expect(graph.cycles).toHaveLength(1);
	const [cycle] = graph.cycles;
	const provideValues = cycle.path.map((provider) =>
		provider.provide.kind === "string" ? provider.provide.value : undefined,
	);
	expect(provideValues).toEqual(["A", "B", "A"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-application-graph-builder`
Expected: FAIL — `graph.cycles` is `[]`

- [ ] **Step 3: Implement `detectCycles()`**

Replace the stub:

```ts
private detectCycles(
	moduleClasses: readonly NexusClass[],
): NexusProviderCycle[] {
	const providersByIdentity = new Map<TokenIdentity, NexusProvider>();
	for (const moduleClass of moduleClasses) {
		for (const [identity, provider] of this.resolveOwnProviderMap(moduleClass)) {
			providersByIdentity.set(identity, provider);
		}
	}

	const cycles: NexusProviderCycle[] = [];
	const visited = new Set<TokenIdentity>();
	const stack = new Set<TokenIdentity>();

	const visit = (identity: TokenIdentity, path: NexusProvider[]): void => {
		if (stack.has(identity)) {
			const cycleStart = path.findIndex(
				(provider) => getTokenIdentity(provider.provide) === identity,
			);
			const cyclePath = path.slice(cycleStart);
			const closingProvider = providersByIdentity.get(identity);
			cycles.push({
				path: closingProvider ? [...cyclePath, closingProvider] : cyclePath,
			});
			return;
		}
		if (visited.has(identity)) return;

		visited.add(identity);
		stack.add(identity);

		const provider = providersByIdentity.get(identity);
		if (provider) {
			for (const injectToken of provider.factoryInject) {
				const nextIdentity = getTokenIdentity(injectToken);
				if (nextIdentity !== undefined) {
					visit(nextIdentity, [...path, provider]);
				}
			}
		}

		stack.delete(identity);
	};

	for (const identity of providersByIdentity.keys()) {
		if (!visited.has(identity)) visit(identity, []);
	}

	return cycles;
}
```

Update the call site in `build()` to drop the now-unused
`providingModulesByClassSymbol` parameter:

```ts
cycles: this.detectCycles(moduleClasses),
```

and update the method signature accordingly (remove the second parameter and
its `Map<ts.Symbol, NexusClass[]>` type import if no longer used elsewhere —
it is still used by `indexProvidersByClassSymbol`/`resolveScopesFor`, so only
the `detectCycles` parameter list changes).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-application-graph-builder`
Expected: PASS — including the earlier tests from Tasks 5-6 (the fixtures
there have no factory-provider cycles, so `cycles` stays `[]` for them).

- [ ] **Step 5: Commit**

```bash
git add packages/type-checker/src/analysis/nexus-application-graph-builder.ts \
  packages/type-checker/__test__/nexus-application-graph-builder.test.ts
git commit -m "feat(type-checker): detect factory-provider cycles by token identity"
```

---

### Task 8: End-to-end integration test across the full pipeline

**Files:**
- Test: `packages/type-checker/__test__/nexus-application-graph-builder.test.ts`

**Interfaces:**
- Consumes: `createNexusAnalyzer`, `createNexusApplicationAnalyzer`,
  `createNexusApplicationGraphBuilder` (all prior tasks) chained exactly as a
  real consumer (IDE tooling, lint, future compiler) would.

- [ ] **Step 1: Write the test**

Add one fixture exercising imports, re-exports through a pass-through module,
a global module, `useFactory` with mixed string/class `inject`, and an
unresolved optional dependency, then assert the full graph shape:

```ts
const END_TO_END_FILES = new Map<string, string>([
	[
		"/app/app.module.ts",
		`import { Injectable as Service, Inject as Dependency, NsModule as Module, Optional as Maybe } from "@nexus-ioc/core";
import { CoreModule } from "./core.module";
import { LoggerModule } from "./logger.module";

@Service()
export class ApiService {
  constructor(
    @Dependency("DATABASE") db: unknown,
    @Dependency("LOGGER") logger: unknown,
    @Dependency("MISSING") @Maybe() missing: unknown,
  ) {}
}

@Module({ imports: [CoreModule, LoggerModule], providers: [ApiService] })
export class AppModule {}
`,
	],
	[
		"/app/core.module.ts",
		`import { NsModule as Module } from "@nexus-ioc/core";
import { DatabaseModule } from "./database.module";

@Module({ imports: [DatabaseModule], exports: [DatabaseModule] })
export class CoreModule {}
`,
	],
	[
		"/app/database.module.ts",
		`import { NsModule as Module } from "@nexus-ioc/core";

@Module({
  providers: [{ provide: "DATABASE", useFactory: () => ({}) }],
  exports: ["DATABASE"],
})
export class DatabaseModule {}
`,
	],
	[
		"/app/logger.module.ts",
		`import { Global as NexusGlobal, NsModule as Module } from "@nexus-ioc/core";

@Module({ providers: [{ provide: "LOGGER", useValue: console }], exports: ["LOGGER"] })
@NexusGlobal()
export class LoggerModule {}
`,
	],
]);

it("resolves a realistic multi-module application end to end", () => {
	const { program, entryPoint } = createProgram("/app/app.module.ts", "AppModule", END_TO_END_FILES);
	const analyzer = createNexusAnalyzer(program);
	const application = createNexusApplicationAnalyzer(analyzer).analyze(entryPoint);
	const graph = createNexusApplicationGraphBuilder(analyzer).build(application);

	const resolvedByName = new Map(
		graph.resolved.map((item) => [item.dependencyName, item]),
	);

	expect(resolvedByName.get("db")?.providingModule.name).toBe("DatabaseModule");
	expect(resolvedByName.get("logger")?.providingModule.name).toBe("LoggerModule");
	expect(graph.unresolved).toEqual([]);
	expect(graph.cycles).toEqual([]);
});
```

This proves the `CoreModule` pass-through re-export (`exports: [DatabaseModule]`
re-exporting an *imported* module rather than one of its own providers) works,
alongside the `@Global()` fallback for `LoggerModule` (reached with no direct
import from `ApiService`'s owning module chain other than `AppModule`
importing it directly here — this fixture imports it explicitly to keep the
graph closed; global-without-import is already covered by Task 6's dedicated
test).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @nexus-ioc/type-checker vitest run nexus-application-graph-builder`
Expected: likely PASS already if Tasks 5-7 are correct — if it fails, treat
this as a real regression: read the failure, fix the builder logic (most
likely culprit: `CoreModule`'s `exports: [DatabaseModule]` pass-through path
in `resolveExportedProviders`), do not weaken the assertions.

- [ ] **Step 3: Run the full type-checker suite**

Run: `pnpm --filter @nexus-ioc/type-checker test`
Expected: PASS, all files.

- [ ] **Step 4: Commit**

```bash
git add packages/type-checker/__test__/nexus-application-graph-builder.test.ts
git commit -m "test(type-checker): cover a realistic multi-module application graph end to end"
```

---

### Task 9: Document the new contract in the package README

**Files:**
- Modify: `packages/type-checker/README.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Add a "Module-level semantic analysis" section**

Following the existing style of the "Class-level semantic analysis" and
"Application-level semantic analysis" sections (`README.md:50-157`), add a new
section documenting: `NexusAnalyzer.getModule()`, the `NexusProvider`/
`NexusModule` shapes (with the same kind of short example as the existing
`NexusClass` section), and a note that `NexusClass.module` is only populated
for classes decorated with `@NsModule(...)`.

- [ ] **Step 2: Add an "Application graph" section**

Document `NexusApplicationGraphBuilder`/`createNexusApplicationGraphBuilder`,
`NexusApplicationGraph`, `NexusResolvedDependency`, `NexusUnresolvedDependency`,
`NexusProviderCycle`. Include one short end-to-end example (Program →
`NexusAnalyzer` → `NexusApplicationAnalyzer` → `NexusApplicationGraphBuilder`).

- [ ] **Step 3: Update the scope-limitation note**

Replace the existing sentence at `README.md:157` ("The current implementation
intentionally stops at semantic reachability. It does not define provider
resolution, a full application graph, lifecycle analysis, or circular
dependency reporting.") with an accurate, equally explicit statement of what
is now covered and what remains out of scope, matching
`docs/superpowers/specs/2026-09-13-nexus-application-graph.md`'s "Out of
scope" section verbatim in substance (legacy `language-service` migration,
`Scope` instance semantics, compiler/ESLint consumption).

- [ ] **Step 4: Commit**

```bash
git add packages/type-checker/README.md
git commit -m "docs(type-checker): document NexusModule and NexusApplicationGraph"
```

---

## Self-Review Notes

- **Spec coverage:** Requirement 1 (module metadata) → Tasks 1-3. Requirement
  2 (module-structure reachability) → Task 4. Requirement 3 (provider
  resolution with scoping) → Tasks 5-6, proven end to end in Task 8.
  Requirement 4 (symbol-identity cycles) → Task 7. Requirement 5 (AST-free,
  deterministic API) → enforced throughout (no `ts.Node` in any produced
  type; `NexusApplicationGraphBuilder` takes/returns only `Nexus*` types).
- **Out-of-scope items are not silently absorbed:** Task 9 explicitly updates
  the README's scope note rather than letting the old "does not define
  provider resolution" sentence go stale.
- **Type consistency check:** `NexusProvider.factoryInject` (Task 1) is used
  identically in the cycle detector (Task 7) and dependency resolution
  (`resolveOwnProviderMap`, Task 5); `NexusModule.imports[].module` (Task 2)
  is the exact field read in `NexusApplicationAnalyzer`'s new `enqueue` calls
  (Task 4) and in `resolveVisibleProviders` (Task 5); `NexusClass.module`
  (Task 3) is the field every later task guards with `?? []`/`!== undefined`
  checks — no task invents a differently-named field.
