![npm](https://img.shields.io/npm/v/@nexus-ioc/core)
![license](https://img.shields.io/npm/l/@nexus-ioc/cpre)
![build](https://img.shields.io/github/actions/workflow/status/Isqanderm/ioc/build.yml)

[Nexus IoC](https://www.npmjs.com/package/@nexus-ioc/core) is a powerful and flexible Inversion of Control (IoC) container for TypeScript applications. Inspired by Angular and NestJS, it leverages decorators to provide a simple and efficient way to manage dependencies and modules.



## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Example Project](#example-project)
- [Roadmap](#roadmap)
- [License](#license)
- [Author](#author)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)
- [Wiki](#wiki)

## Features

This plugin adds the ability to autocomplete for dependencies and highlight type errors.

## Installation

```bash
npm install @nexus-ioc/language-service
```

## Quick Start

### Step 1: Define plugin in tsconfig.json

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@nexus-ioc/language-service"
      }
    ]
  }
}

```

## Example Project

A comprehensive example project is available in the `example/` directory that demonstrates all plugin features:

- ✅ Auto-completion for `@Inject()` decorators
- ✅ Go-to-definition for dependency tokens
- ✅ Semantic diagnostics for DI errors
- ✅ Working examples with proper module configuration
- ✅ Error examples showing common mistakes

**Quick Start**:
```bash
# From monorepo root
cd packages/language-service/example
npm install
npm run build

# Open in your IDE
code .
```

See [`example/README.md`](./example/README.md) for detailed setup instructions and [`example/TESTING_GUIDE.md`](./example/TESTING_GUIDE.md) for comprehensive testing procedures.

## Roadmap

See [`ROADMAP.md`](./ROADMAP.md) for the complete feature roadmap including:
- Current capabilities and limitations
- Planned enhancements (Phases 2-6)
- Effort estimates and prioritization
- Success metrics

**Highlights**:
- **Phase 2**: Support for `@Optional()`, `@Global()`, property injection, circular dependency detection
- **Phase 3**: Quick fixes (auto-add providers, import modules, fix type mismatches)
- **Phase 4**: Refactoring support (rename tokens, extract to module)
- **Phase 5**: Performance optimizations, hover info, inlay hints
- **Phase 6**: Dependency graph visualization, testing support

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
