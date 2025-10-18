# Changelog

All notable changes to the @nexus-ioc/graph-analyzer package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-18

**First public release of @nexus-ioc/graph-analyzer!**

This release represents a complete, production-ready static analysis tool for Nexus IoC dependency injection graphs.

### Added
- **Circular Dependency Detection** - Detect circular imports and provider dependencies using DFS algorithm
- **Unused Provider Detection** - Find providers that are registered but never injected
- **Module Depth Analysis** - Analyze module hierarchy depth and complexity metrics using BFS algorithm
- **Provider Scope Analysis** - Detect scope mismatches (Singleton depending on Request-scoped providers)
- **Interactive HTML Visualization** - Modern, interactive graph visualization with Cytoscape.js
  - Click nodes to explore dependencies
  - Pan and zoom controls
  - Search functionality
  - View mode filtering (all, modules only, providers only)
  - Dark theme support
  - IDE integration (VSCode, WebStorm, IntelliJ IDEA)
  - Visual error indicators for circular dependencies and missing decorators
- **Missing Decorator Detection** - Identify dependencies without explicit `@Inject` decorators
- **Factory Provider Support** - Full support for `useFactory` providers with `inject` arrays
- **Provider Scope Extraction** - Extract and analyze provider scopes (Singleton, Request)
- **CLI Analysis Flags** - `--check-circular`, `--check-unused`, `--check-depth`, `--check-scope`, `--check-ci`
- **Comprehensive Test Suite** - 443 tests across 26 test files
- **Complete Documentation** - README, API Reference, Architecture, CLI Guide, HTML Visualization docs

### Fixed
- **Canvas Click/Drag UX** - Prevent unwanted panning on simple clicks in HTML visualization
- **Factory Provider Parsing** - Remove extra quotes from inject array tokens
- **Scope Detection** - Respect explicit scopes on all provider types (UseValue, UseFactory)
- **Quote Stripping** - Properly handle string tokens in dependency injection

### Changed
- **Package Name** - Renamed to `@nexus-ioc/graph-analyzer` for npm publication
- **Output Format** - HTML is now the recommended default format (was PNG)
- **Test Coverage** - Increased from 35 to 443 tests
- **Documentation** - Complete rewrite with comprehensive examples and troubleshooting

### Removed
- **Generated Files** - Removed all generated HTML/JSON files from repository
- **Outdated Documentation** - Removed implementation plan and roadmap (features complete)

## [0.1.14](https://github.com/Isqanderm/ioc/compare/v0.1.13...v0.1.14) (2024-07-17)

### [0.1.13](https://github.com/Isqanderm/ioc/compare/v0.1.11...v0.1.13) (2024-07-16)

### [0.1.12](https://github.com/Isqanderm/ioc/compare/v0.1.11...v0.1.12) (2024-07-16)

### [0.1.11](https://github.com/Isqanderm/ioc/compare/v0.1.10...v0.1.11) (2024-07-16)

### [0.1.10](https://github.com/Isqanderm/ioc/compare/v0.1.9...v0.1.10) (2024-07-16)


### Features

* **graph-visualizer:** add graph-visualizer package ([69bb005](https://github.com/Isqanderm/ioc/commit/69bb00585c395d7766675d1a4620320efed14736))
* **graph:** add container inheritance ([e5c0571](https://github.com/Isqanderm/ioc/commit/e5c05711f301314ec545881a6356db7c9f0de612)), closes [#21](https://github.com/Isqanderm/ioc/issues/21)

### [0.1.9](https://github.com/Isqanderm/ioc/compare/v0.1.8...v0.1.9) (2024-07-07)


### Features

* **graph:** add new graph hooks and api for container ([a082f3e](https://github.com/Isqanderm/ioc/commit/a082f3e48450995cdd8f4761e8a0e6a7330b05b1))

### [0.1.8](https://github.com/Isqanderm/ioc/compare/v0.1.7...v0.1.8) (2024-07-03)

### [0.1.7](https://github.com/Isqanderm/ioc/compare/v0.1.6...v0.1.7) (2024-07-02)


### Features

* **container:** add forRoot/forRootAsync ([533c1c4](https://github.com/Isqanderm/ioc/commit/533c1c4a6bc99a611584574e5b4717416f86af0f))

### [0.1.6](https://github.com/Isqanderm/ioc/compare/v0.1.5...v0.1.6) (2024-07-02)


### Features

* **container:** add forFeature/forFeatureAsync ([427d2df](https://github.com/Isqanderm/ioc/commit/427d2dfaa1792746c68c6909ecec35a5805024ae))

### [0.1.5](https://github.com/Isqanderm/ioc/compare/v0.1.4...v0.1.5) (2024-07-01)

### [0.1.4](https://github.com/Isqanderm/ioc/compare/v0.1.3...v0.1.4) (2024-06-30)

### 0.1.3 (2024-06-30)


### Features

* **application:** create first version of app ([086e0ff](https://github.com/Isqanderm/ioc/commit/086e0ff1fad889c253b7bf25e134f0048976c1eb))

### 0.1.2 (2024-06-30)


### Features

* **application:** create first version of app ([086e0ff](https://github.com/Isqanderm/ioc/commit/086e0ff1fad889c253b7bf25e134f0048976c1eb))

### 0.1.1 (2024-06-30)


### Features

* **application:** create first version of app ([086e0ff](https://github.com/Isqanderm/ioc/commit/086e0ff1fad889c253b7bf25e134f0048976c1eb))
