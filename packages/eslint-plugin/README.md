# @nexus-ioc/eslint-plugin

ESLint plugin for [Nexus IoC](https://github.com/Isqanderm/ioc) dependency injection framework. Provides linting rules to enforce type safety and best practices in your dependency injection code.

## Features

- ✅ **Decorator Validation**: Ensure classes using `@Inject` are decorated with `@Injectable`
- 🎯 **Module Validation**: Validate that classes ending with "Module" are decorated with `@NsModule`
- 🚀 **IDE Integration**: Works seamlessly with WebStorm, VS Code, and other IDEs that support ESLint
- 📦 **Shared Type Checker**: Built on top of `@nexus-ioc/type-checker` for consistent validation across tools

## Installation

```bash
npm install --save-dev @nexus-ioc/eslint-plugin @typescript-eslint/parser
```

## Configuration

### ESLint Flat Config (eslint.config.js)

```javascript
import nexusIoc from '@nexus-ioc/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@nexus-ioc': nexusIoc,
    },
    rules: {
      '@nexus-ioc/check-dependency-types': 'error',
      '@nexus-ioc/no-circular-dependencies': 'error',
      '@nexus-ioc/valid-provider-config': 'warn',
    },
  },
];
```

### Legacy ESLint Config (.eslintrc.json)

```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "plugins": ["@nexus-ioc"],
  "rules": {
    "@nexus-ioc/check-dependency-types": "error",
    "@nexus-ioc/no-circular-dependencies": "error",
    "@nexus-ioc/valid-provider-config": "warn"
  }
}
```

## Rules

### `check-dependency-types`

Ensures that classes using `@Inject` decorators are properly marked as `@Injectable`.

**❌ Incorrect:**
```typescript
class UserService {
  constructor(@Inject('Logger') private logger: Logger) {}
  //          ^^^^^^^ Error: Class uses @Inject but is not decorated with @Injectable
}
```

**✅ Correct:**
```typescript
@Injectable()
class UserService {
  constructor(@Inject('Logger') private logger: Logger) {}
}
```

### `no-circular-dependencies`

Placeholder rule for detecting circular dependencies between modules and services. This rule is currently a placeholder and will be fully implemented in a future version. Complex circular dependency detection is better suited for the TypeScript Language Service Plugin.

### `valid-provider-config`

Ensures that classes with names ending in "Module" are decorated with `@NsModule`.

**❌ Incorrect:**
```typescript
class AppModule {
  // Error: Class name ends with 'Module' but is not decorated with @NsModule
}
```

**✅ Correct:**
```typescript
@NsModule({
  providers: [UserService],
  exports: [UserService]
})
class AppModule {}
```

## Requirements

- ESLint 8.0.0 or higher (or ESLint 9.0.0 for flat config)
- TypeScript 4.0.0 or higher
- @typescript-eslint/parser 8.0.0 or higher

## IDE Support

This plugin works in all IDEs that support ESLint:

- ✅ **WebStorm / IntelliJ IDEA** - Full support
- ✅ **VS Code** - Full support (with ESLint extension)
- ✅ **Sublime Text** - Full support (with SublimeLinter-eslint)
- ✅ **Vim / Neovim** - Full support (with ALE or coc-eslint)

## Related Packages

- [@nexus-ioc/core](https://www.npmjs.com/package/@nexus-ioc/core) - Core dependency injection framework
- [@nexus-ioc/language-service](https://www.npmjs.com/package/@nexus-ioc/language-service) - TypeScript Language Service Plugin for VS Code
- [@nexus-ioc/type-checker](https://www.npmjs.com/package/@nexus-ioc/type-checker) - Shared type-checking logic

## License

MIT © [Isqanderm](https://github.com/Isqanderm)

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

## Issues

Found a bug or have a feature request? Please [open an issue](https://github.com/Isqanderm/ioc/issues).

