# Dependency Injection Metadata Extraction - Detailed Implementation Plan

## 📋 Overview

This document provides a comprehensive, step-by-step implementation plan for the **Dependency Injection Metadata Extraction** component of the graph-analyzer package. This is the most critical P0 feature needed to complete the static analysis tool.

## 🎯 Objective

Extract complete dependency injection metadata from TypeScript source files using static AST parsing, including:
- Constructor parameter dependencies (with `@Inject` decorators)
- Property dependencies (with `@Inject` decorators)
- Dependency tokens (class types, strings, symbols)
- Optional dependencies (with `@Optional` decorator)
- Support for both legacy and TC39 Stage 3 decorator syntax

## 📚 Background: How DI Works in Nexus IoC

### Runtime Metadata Storage

At runtime, Nexus IoC uses `reflect-metadata` to store dependency information:

**Constructor Dependencies:**
- Metadata key: `SELF_DECLARED_DEPS_METADATA = "self:paramtypes"`
- Stored on: The class itself
- Format: `Array<{ index: number, laze: boolean, param: Type | string | symbol }>`
- Set by: `@Inject()` parameter decorator

**Property Dependencies:**
- Metadata key: `PROPERTY_DEPS_METADATA = "self:properties_metadata"`
- Stored on: The class constructor
- Format: `Array<{ key: string | symbol, laze: boolean, type: Type | string | symbol }>`
- Set by: `@Inject()` property decorator

**Example Runtime Code:**
```typescript
@Injectable()
class UserService {
  constructor(
    @Inject(DatabaseService) private db: DatabaseService,
    @Inject('CONFIG') private config: any
  ) {}
  
  @Inject(LoggerService)
  private logger: LoggerService;
}

// At runtime, metadata is stored as:
// Reflect.getMetadata('self:paramtypes', UserService) = [
//   { index: 0, laze: false, param: DatabaseService },
//   { index: 1, laze: false, param: 'CONFIG' }
// ]
// Reflect.getMetadata('self:properties_metadata', UserService) = [
//   { key: 'logger', laze: false, type: LoggerService }
// ]
```

### Injection Token Types

Nexus IoC supports multiple token types:
```typescript
type InjectionToken = string | symbol | Type<T> | Abstract<T> | Function;
```

**Examples:**
- Class token: `@Inject(DatabaseService)`
- String token: `@Inject('DATABASE_CONNECTION')`
- Symbol token: `@Inject(Symbol.for('logger'))`

## 🔍 Static Analysis Challenge

We need to extract this same information **without executing the code**, using only TypeScript AST parsing.

### Key Challenges:

1. **No Runtime Metadata**: We can't use `Reflect.getMetadata()` - must parse decorators from AST
2. **Decorator Syntax**: Must support both legacy and TC39 Stage 3 decorators
3. **Token Resolution**: Must resolve class names to their actual types
4. **Import Resolution**: Must follow imports to find token definitions
5. **Optional Dependencies**: Must detect `@Optional()` decorator

## 🏗️ Architecture

### Current State

<augment_code_snippet path="packages/graph-analyzer/src/parser/provider/class-parser.ts" mode="EXCERPT">
````typescript
export class ClassParser implements ProvidersInterface {
	public readonly type = "Class";
	constructor(public readonly _token: string) {}
	parse(): this {
		return this;
	}
	get token(): string {
		return this._token;
	}
}
````
</augment_code_snippet>

**Problem**: The current `ClassParser` only extracts the class name, not its dependencies.

### Target State

We need to enhance `ClassParser` to extract:
```typescript
interface ClassProviderWithDependencies {
  type: "Class";
  token: string;
  dependencies: Dependency[];  // NEW!
}

interface Dependency {
  type: "constructor" | "property";
  index?: number;           // For constructor params
  key?: string;            // For properties
  token: string;           // The dependency token
  tokenType: "class" | "string" | "symbol";
  optional: boolean;
  raw: string;             // Original AST text
}
```

## 📝 Implementation Steps

### Phase 1: AST Query Setup (1-2 hours)

**Goal**: Set up TypeScript AST querying infrastructure for decorator parsing.

**Files to Modify:**
- `packages/graph-analyzer/src/parser/provider/class-parser.ts`

**Steps:**

1. **Import tsquery and TypeScript compiler API:**
```typescript
import { tsquery } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';
```

2. **Add helper method to get class AST node:**
```typescript
private getClassNode(className: string, sourceFile: ts.SourceFile): ts.ClassDeclaration | null {
  const query = `ClassDeclaration:has(Identifier[name="${className}"])`;
  const nodes = tsquery(sourceFile, query);
  return nodes[0] as ts.ClassDeclaration || null;
}
```

3. **Add method to get source file from class name:**
```typescript
private getSourceFile(className: string): ts.SourceFile | null {
  // This will need to be passed in from the parser context
  // For now, we'll add it as a constructor parameter
}
```

**Testing:**
- Create a test file with a simple class
- Verify we can find the class node in the AST

### Phase 2: Constructor Dependency Extraction (3-4 hours)

**Goal**: Extract all constructor parameter dependencies with their `@Inject` decorators.

**Steps:**

1. **Query for constructor:**
```typescript
private getConstructor(classNode: ts.ClassDeclaration): ts.ConstructorDeclaration | null {
  const query = 'Constructor';
  const nodes = tsquery(classNode, query);
  return nodes[0] as ts.ConstructorDeclaration || null;
}
```

2. **Extract constructor parameters:**
```typescript
private getConstructorParameters(constructor: ts.ConstructorDeclaration): ts.ParameterDeclaration[] {
  return Array.from(constructor.parameters);
}
```

3. **Parse @Inject decorator from parameter:**
```typescript
private getInjectDecorator(param: ts.ParameterDeclaration): ts.Decorator | null {
  if (!param.decorators) return null;
  
  for (const decorator of param.decorators) {
    const expression = decorator.expression;
    if (ts.isCallExpression(expression)) {
      const identifier = expression.expression;
      if (ts.isIdentifier(identifier) && identifier.text === 'Inject') {
        return decorator;
      }
    }
  }
  return null;
}
```

4. **Extract token from @Inject decorator:**
```typescript
private extractTokenFromDecorator(decorator: ts.Decorator): {
  token: string;
  tokenType: 'class' | 'string' | 'symbol';
} {
  const expression = decorator.expression as ts.CallExpression;
  const args = expression.arguments;
  
  if (args.length === 0) {
    throw new Error('@Inject decorator requires a token argument');
  }
  
  const tokenArg = args[0];
  
  // Class token: @Inject(DatabaseService)
  if (ts.isIdentifier(tokenArg)) {
    return {
      token: tokenArg.text,
      tokenType: 'class'
    };
  }
  
  // String token: @Inject('DATABASE_CONNECTION')
  if (ts.isStringLiteral(tokenArg)) {
    return {
      token: tokenArg.text,
      tokenType: 'string'
    };
  }
  
  // Symbol token: @Inject(Symbol.for('logger'))
  if (ts.isCallExpression(tokenArg)) {
    // Handle Symbol.for() calls
    return {
      token: tokenArg.getText(),
      tokenType: 'symbol'
    };
  }
  
  throw new Error(`Unsupported token type in @Inject decorator: ${tokenArg.getText()}`);
}
```

5. **Check for @Optional decorator:**
```typescript
private hasOptionalDecorator(param: ts.ParameterDeclaration): boolean {
  if (!param.decorators) return false;
  
  return param.decorators.some(decorator => {
    const expression = decorator.expression;
    if (ts.isCallExpression(expression)) {
      const identifier = expression.expression;
      return ts.isIdentifier(identifier) && identifier.text === 'Optional';
    }
    if (ts.isIdentifier(expression)) {
      return expression.text === 'Optional';
    }
    return false;
  });
}
```

6. **Combine into constructor dependency extraction:**
```typescript
private extractConstructorDependencies(classNode: ts.ClassDeclaration): Dependency[] {
  const constructor = this.getConstructor(classNode);
  if (!constructor) return [];
  
  const params = this.getConstructorParameters(constructor);
  const dependencies: Dependency[] = [];
  
  params.forEach((param, index) => {
    const injectDecorator = this.getInjectDecorator(param);
    if (!injectDecorator) {
      // No @Inject decorator - might use TypeScript's design:paramtypes
      // For static analysis, we'll skip these for now
      return;
    }
    
    const { token, tokenType } = this.extractTokenFromDecorator(injectDecorator);
    const optional = this.hasOptionalDecorator(param);
    
    dependencies.push({
      type: 'constructor',
      index,
      token,
      tokenType,
      optional,
      raw: param.getText()
    });
  });
  
  return dependencies;
}
```

**Testing:**
- Test with class having no constructor
- Test with constructor having no parameters
- Test with constructor having @Inject decorators
- Test with different token types (class, string, symbol)
- Test with @Optional decorator

### Phase 3: Property Dependency Extraction (2-3 hours)

**Goal**: Extract all property dependencies with `@Inject` decorators.

**Steps:**

1. **Query for class properties:**
```typescript
private getClassProperties(classNode: ts.ClassDeclaration): ts.PropertyDeclaration[] {
  const query = 'PropertyDeclaration';
  const nodes = tsquery(classNode, query);
  return nodes as ts.PropertyDeclaration[];
}
```

2. **Extract property dependencies:**
```typescript
private extractPropertyDependencies(classNode: ts.ClassDeclaration): Dependency[] {
  const properties = this.getClassProperties(classNode);
  const dependencies: Dependency[] = [];
  
  for (const prop of properties) {
    if (!prop.decorators) continue;
    
    const injectDecorator = prop.decorators.find(decorator => {
      const expression = decorator.expression;
      if (ts.isCallExpression(expression)) {
        const identifier = expression.expression;
        return ts.isIdentifier(identifier) && identifier.text === 'Inject';
      }
      return false;
    });
    
    if (!injectDecorator) continue;
    
    const { token, tokenType } = this.extractTokenFromDecorator(injectDecorator);
    const optional = this.hasOptionalDecoratorOnProperty(prop);
    const key = (prop.name as ts.Identifier).text;
    
    dependencies.push({
      type: 'property',
      key,
      token,
      tokenType,
      optional,
      raw: prop.getText()
    });
  }
  
  return dependencies;
}
```

**Testing:**
- Test with class having no properties
- Test with properties without decorators
- Test with @Inject decorated properties
- Test with @Optional decorator on properties

### Phase 4: Integration with Parser (1-2 hours)

**Goal**: Integrate dependency extraction into the main parsing flow.

**Files to Modify:**
- `packages/graph-analyzer/src/parser/provider/class-parser.ts`
- `packages/graph-analyzer/src/interfaces/providers.interface.ts`

**Steps:**

1. **Update ProvidersInterface:**
```typescript
export interface ProvidersInterface {
  type: string;
  token: string | null;
  value?: string | null;
  dependencies?: Dependency[];  // NEW!
}

export interface Dependency {
  type: "constructor" | "property";
  index?: number;
  key?: string;
  token: string;
  tokenType: "class" | "string" | "symbol";
  optional: boolean;
  raw: string;
}
```

2. **Update ClassParser.parse():**
```typescript
parse(sourceFile: ts.SourceFile): this {
  const classNode = this.getClassNode(this._token, sourceFile);
  if (!classNode) {
    this._dependencies = [];
    return this;
  }
  
  const constructorDeps = this.extractConstructorDependencies(classNode);
  const propertyDeps = this.extractPropertyDependencies(classNode);
  
  this._dependencies = [...constructorDeps, ...propertyDeps];
  
  return this;
}
```

3. **Add dependencies getter:**
```typescript
get dependencies(): Dependency[] {
  return this._dependencies || [];
}
```

**Testing:**
- End-to-end test with complete class
- Verify dependencies are correctly extracted and accessible

### Phase 5: TC39 Stage 3 Decorator Support (2-3 hours)

**Goal**: Support the new static dependencies pattern for TC39 decorators.

**Background**: According to the memory, the project is migrating to TC39 Stage 3 decorators where parameter decorators are replaced with static dependencies arrays.

**Pattern to Support:**
```typescript
@Injectable()
class UserService {
  static dependencies = [
    { index: 0, token: DatabaseService, optional: false },
    { index: 1, token: 'CONFIG', optional: false }
  ];
  
  constructor(db: DatabaseService, config: any) {}
}
```

**Steps:**

1. **Detect static dependencies property:**
```typescript
private getStaticDependencies(classNode: ts.ClassDeclaration): ts.PropertyDeclaration | null {
  const query = 'PropertyDeclaration:has(Identifier[name="dependencies"]):has(StaticKeyword)';
  const nodes = tsquery(classNode, query);
  return nodes[0] as ts.PropertyDeclaration || null;
}
```

2. **Parse static dependencies array:**
```typescript
private parseStaticDependencies(staticProp: ts.PropertyDeclaration): Dependency[] {
  if (!staticProp.initializer) return [];
  
  if (!ts.isArrayLiteralExpression(staticProp.initializer)) {
    throw new Error('static dependencies must be an array');
  }
  
  const dependencies: Dependency[] = [];
  
  for (const element of staticProp.initializer.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue;
    
    let index: number | undefined;
    let token: string = '';
    let tokenType: 'class' | 'string' | 'symbol' = 'class';
    let optional = false;
    
    for (const prop of element.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      
      const name = (prop.name as ts.Identifier).text;
      const value = prop.initializer;
      
      if (name === 'index' && ts.isNumericLiteral(value)) {
        index = parseInt(value.text);
      } else if (name === 'token') {
        if (ts.isIdentifier(value)) {
          token = value.text;
          tokenType = 'class';
        } else if (ts.isStringLiteral(value)) {
          token = value.text;
          tokenType = 'string';
        }
      } else if (name === 'optional') {
        optional = value.kind === ts.SyntaxKind.TrueKeyword;
      }
    }
    
    if (index !== undefined && token) {
      dependencies.push({
        type: 'constructor',
        index,
        token,
        tokenType,
        optional,
        raw: element.getText()
      });
    }
  }
  
  return dependencies.sort((a, b) => (a.index || 0) - (b.index || 0));
}
```

3. **Update parse() to check both patterns:**
```typescript
parse(sourceFile: ts.SourceFile): this {
  const classNode = this.getClassNode(this._token, sourceFile);
  if (!classNode) {
    this._dependencies = [];
    return this;
  }
  
  // Try TC39 Stage 3 pattern first
  const staticDeps = this.getStaticDependencies(classNode);
  if (staticDeps) {
    this._dependencies = this.parseStaticDependencies(staticDeps);
    return this;
  }
  
  // Fall back to legacy decorator pattern
  const constructorDeps = this.extractConstructorDependencies(classNode);
  const propertyDeps = this.extractPropertyDependencies(classNode);
  
  this._dependencies = [...constructorDeps, ...propertyDeps];
  
  return this;
}
```

**Testing:**
- Test with TC39 Stage 3 static dependencies
- Test with legacy @Inject decorators
- Test mixed scenarios (if applicable)

## 🧪 Testing Strategy

### Unit Tests

Create `packages/graph-analyzer/src/parser/provider/__tests__/class-parser.spec.ts`:

```typescript
describe('ClassParser - Dependency Extraction', () => {
  describe('Constructor Dependencies', () => {
    it('should extract class token from @Inject decorator', () => {
      const source = `
        class UserService {
          constructor(@Inject(DatabaseService) private db: DatabaseService) {}
        }
      `;
      // Test implementation
    });
    
    it('should extract string token from @Inject decorator', () => {
      const source = `
        class UserService {
          constructor(@Inject('CONFIG') private config: any) {}
        }
      `;
      // Test implementation
    });
    
    it('should detect @Optional decorator', () => {
      const source = `
        class UserService {
          constructor(
            @Inject(LoggerService)
            @Optional()
            private logger?: LoggerService
          ) {}
        }
      `;
      // Test implementation
    });
  });
  
  describe('Property Dependencies', () => {
    it('should extract property dependencies', () => {
      const source = `
        class UserService {
          @Inject(LoggerService)
          private logger: LoggerService;
        }
      `;
      // Test implementation
    });
  });
  
  describe('TC39 Stage 3 Decorators', () => {
    it('should parse static dependencies array', () => {
      const source = `
        class UserService {
          static dependencies = [
            { index: 0, token: DatabaseService, optional: false }
          ];
          constructor(db: DatabaseService) {}
        }
      `;
      // Test implementation
    });
  });
});
```

### Integration Tests

Test with the example application in `packages/graph-analyzer/example/`.

## 📊 Success Criteria

- [ ] Extract constructor dependencies with @Inject decorators
- [ ] Extract property dependencies with @Inject decorators
- [ ] Support class, string, and symbol tokens
- [ ] Detect @Optional decorator
- [ ] Support TC39 Stage 3 static dependencies pattern
- [ ] All unit tests passing
- [ ] Integration test with example app passing
- [ ] Dependencies correctly appear in JSON output

## 🔄 Next Steps After Completion

Once dependency extraction is complete:
1. Update JSON output format to include dependencies
2. Update visualization to show dependency relationships
3. Implement CLI interface
4. Add comprehensive documentation

## 📚 References

- TypeScript Compiler API: https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
- tsquery Documentation: https://github.com/phenomnomnominal/tsquery
- Nexus IoC @Inject implementation: `packages/ioc/src/decorators/inject.ts`
- Runtime dependency resolution: `packages/ioc/src/core/graph/module-graph.ts`

