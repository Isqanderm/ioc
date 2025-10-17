# @nexus-ioc/shared

[![npm version](https://img.shields.io/npm/v/@nexus-ioc/shared.svg)](https://www.npmjs.com/package/@nexus-ioc/shared)
[![npm downloads](https://img.shields.io/npm/dm/@nexus-ioc/shared.svg)](https://www.npmjs.com/package/@nexus-ioc/shared)
[![npm downloads](https://img.shields.io/npm/dt/@nexus-ioc/shared.svg)](https://www.npmjs.com/package/@nexus-ioc/shared)
[![License: MIT](https://img.shields.io/npm/l/@nexus-ioc/shared.svg)](https://github.com/Isqanderm/ioc/blob/main/LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@nexus-ioc/shared)](https://bundlephobia.com/package/@nexus-ioc/shared)
[![CI](https://github.com/Isqanderm/ioc/actions/workflows/ci.yml/badge.svg)](https://github.com/Isqanderm/ioc/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Isqanderm/ioc/branch/main/graph/badge.svg)](https://codecov.io/gh/Isqanderm/ioc)
[![Dependencies](https://img.shields.io/librariesio/release/npm/@nexus-ioc/shared)](https://libraries.io/npm/@nexus-ioc%2Fshared)
[![GitHub stars](https://img.shields.io/github/stars/Isqanderm/ioc.svg?style=social&label=Star)](https://github.com/Isqanderm/ioc)
[![GitHub issues](https://img.shields.io/github/issues/Isqanderm/ioc.svg)](https://github.com/Isqanderm/ioc/issues)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Isqanderm/ioc/blob/main/CONTRIBUTING.md)

Shared interfaces, types, and utilities for Nexus IoC packages.

## Overview

This package contains shared interfaces and base classes used across the Nexus IoC ecosystem, particularly between `@nexus-ioc/core` and `@nexus-ioc/testing` packages.

## Purpose

The `@nexus-ioc/shared` package was created to:
- Eliminate circular dependencies between core and testing packages
- Provide a single source of truth for shared interfaces
- Enable better separation of concerns
- Facilitate easier maintenance and evolution of the codebase

## Contents

- **Interfaces**: Core interfaces like `ContainerInterface`, `HashUtilInterface`, `ModuleContainerInterface`
- **Errors**: Shared error classes like `ContainerNotCompiledError`

## Installation

This package is typically installed as a dependency of other Nexus IoC packages and is not meant to be used directly.

```bash
npm install @nexus-ioc/shared
```

## License

MIT

