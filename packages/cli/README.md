# @nexus-ioc/cli

[![npm version](https://img.shields.io/npm/v/@nexus-ioc/cli.svg)](https://www.npmjs.com/package/@nexus-ioc/cli)
[![npm downloads](https://img.shields.io/npm/dm/@nexus-ioc/cli.svg)](https://www.npmjs.com/package/@nexus-ioc/cli)
[![npm downloads](https://img.shields.io/npm/dt/@nexus-ioc/cli.svg)](https://www.npmjs.com/package/@nexus-ioc/cli)
[![License: MIT](https://img.shields.io/npm/l/@nexus-ioc/cli.svg)](https://github.com/Isqanderm/ioc/blob/main/LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@nexus-ioc/cli)](https://bundlephobia.com/package/@nexus-ioc/cli)
[![CI](https://github.com/Isqanderm/ioc/actions/workflows/ci.yml/badge.svg)](https://github.com/Isqanderm/ioc/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Isqanderm/ioc/branch/main/graph/badge.svg)](https://codecov.io/gh/Isqanderm/ioc)
[![Dependencies](https://img.shields.io/librariesio/release/npm/@nexus-ioc/cli)](https://libraries.io/npm/@nexus-ioc%2Fcli)
[![GitHub stars](https://img.shields.io/github/stars/Isqanderm/ioc.svg?style=social&label=Star)](https://github.com/Isqanderm/ioc)
[![GitHub issues](https://img.shields.io/github/issues/Isqanderm/ioc.svg)](https://github.com/Isqanderm/ioc/issues)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Isqanderm/ioc/blob/main/CONTRIBUTING.md)

`@nexus-ioc/cli` is a command-line interface (CLI) tool for working with the Nexus IoC library. It helps developers create services, modules, and other components, simplifying the development and setup process.

## Installation

### Global Installation

You can install the CLI globally using npm:

```bash
npm install -g @nexus-ioc/cli
```

### Using with `npx`

You can also use the CLI without global installation using `npx`:

```bash
npx @nexus-ioc/cli <command> [options]
```

## Commands

### Interactive Mode (TUI)

Launch the interactive Terminal User Interface for a guided experience:

```bash
nexus-tui
```

or with the main CLI:

```bash
nexus-cli --interactive
# or simply run without arguments
nexus-cli
```

The interactive mode provides:
- 🎨 Beautiful menu-driven interface
- 🧙 Step-by-step wizards for generating services and modules
- 👁️ Code preview before generation
- 🔍 Smart dependency discovery and injection
- ✨ Syntax highlighting and validation

### `generate` (or `g`)

Generates a new component, such as a service or module.

#### Syntax

```bash
nexus-cli generate <type> <name> [path]
```

or the shorthand form:

```bash
nexus-cli g <type> <name> [path]
```

- `<type>`: The type of component to generate (e.g., `service`, `module`).
- `<name>`: The name of the new component.
- `[path]`: (Optional) The path where the new component will be created.

#### Examples

Creating a new `auth` service in the `./apps/auth` folder:

```bash
nexus-cli generate service auth ./apps/auth
```

or

```bash
nexus-cli g service auth ./apps/auth
```

Creating a new `user` module in the current directory:

```bash
nexus-cli generate module user
```

### `install` (or `i`)

Installs the Nexus IoC package.

#### Syntax

```bash
nexus-cli install
```

or the shorthand form:

```bash
nexus-cli i
```

Installs `@nexus-ioc/core` in your project.

#### Example

```bash
nexus-cli install
```

## Options

- `--help`: Shows help for using the command.
- `--version`: Shows the CLI version.

## Usage Examples

1. **Check the CLI version:**

   ```bash
   nexus-cli --version
   ```

2. **Get help for the generate command:**

   ```bash
   nexus-cli generate --help
   ```

3. **Generate a new service:**

   ```bash
   nexus-cli g service auth ./apps/auth
   ```

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Author

Isqanderm (Aleksandr Melnik) - [LinkedIn](www.linkedin.com/in/isqander-melnik)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Acknowledgements

Special thanks to the developers of Angular and NestJS for the inspiration.

## Wiki

For more detailed documentation, please visit the [Wiki](https://github.com/Isqanderm/ioc/wiki/Testing).
