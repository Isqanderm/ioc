![npm](https://img.shields.io/npm/v/@nexus-ioc/shared)
![license](https://img.shields.io/npm/l/@nexus-ioc/shared)
![CI](https://github.com/Isqanderm/ioc/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/Isqanderm/ioc/branch/main/graph/badge.svg)](https://codecov.io/gh/Isqanderm/ioc)

# @nexus-ioc/shared

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

