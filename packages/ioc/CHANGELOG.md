# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.6.1](https://github.com/Isqanderm/ioc/compare/@nexus-ioc/core@0.6.0...@nexus-ioc/core@0.6.1) (2025-10-17)

### Bug Fixes

- add publishConfig for scoped packages to enable NPM publishing ([839da89](https://github.com/Isqanderm/ioc/commit/839da890ee9e7dce21c4492643acecc0381c64b0))

# [0.6.0](https://github.com/Isqanderm/ioc/compare/@nexus-ioc/core@0.5.0...@nexus-ioc/core@0.6.0) (2025-10-17)

### Features

- add .npmignore files to exclude unnecessary files from NPM packages ([d136e8c](https://github.com/Isqanderm/ioc/commit/d136e8cae32d5dd76eecc691a95b5e9265449d4c))

# 0.5.0 (2025-10-17)

### Bug Fixes

- **all packages:** update deps, fix ioc graph analyzer, remove plugins from ioc graph ([33058a0](https://github.com/Isqanderm/ioc/commit/33058a0da18ed4b0e4a924607a97796233d23ca0)), closes [#34](https://github.com/Isqanderm/ioc/issues/34)
- correct property injection tests with missing decorators ([f4045e3](https://github.com/Isqanderm/ioc/commit/f4045e39fe9ba58f7d938dcda6f656b56b7ed6d4))
- **ioc:** enable property inject ([a93e6c8](https://github.com/Isqanderm/ioc/commit/a93e6c8d5e4bd790d938f19dbf3956097e2197b9))
- **ioc:** fix module export logic ([79a09ab](https://github.com/Isqanderm/ioc/commit/79a09abe4a8512697a843d3e5a42035cf5eeee82)), closes [#34](https://github.com/Isqanderm/ioc/issues/34)
- **packages:** fix build ([8160275](https://github.com/Isqanderm/ioc/commit/816027551b630769a3d53157f9a330a0873e6cb5)), closes [#34](https://github.com/Isqanderm/ioc/issues/34)
- replace Object.hasOwn with compatible alternative in shared.utils.ts ([5691c8a](https://github.com/Isqanderm/ioc/commit/5691c8a8ab5f2e0f4a58fb4ea121b5865599bd2d))
- resolve all linting errors across packages ([d21f9f6](https://github.com/Isqanderm/ioc/commit/d21f9f6a981a57085909c9877a2af124b74c76b2))
- resolve TypeScript compilation errors ([58655a6](https://github.com/Isqanderm/ioc/commit/58655a69e86383c9fe6ac80f94c0050526520ad7))
- use 'in' operator instead of Object.prototype.hasOwnProperty.call ([31f7339](https://github.com/Isqanderm/ioc/commit/31f73393127b23ac75f3722d542a14b226393764))

### Features

- **graph-visualizer:** add graph-visualizer package ([69bb005](https://github.com/Isqanderm/ioc/commit/69bb00585c395d7766675d1a4620320efed14736))
- **ioc:** add a new api for container inheritance ([#45](https://github.com/Isqanderm/ioc/issues/45)) ([7fb4be6](https://github.com/Isqanderm/ioc/commit/7fb4be612a55aab7f4d364767515584101a2aeb5)), closes [#44](https://github.com/Isqanderm/ioc/issues/44)
- **ioc:** add errors on compile step ([a9ab869](https://github.com/Isqanderm/ioc/commit/a9ab86933977e5eae472efa65436161e1900e34a))
- **ioc:** add Optional decorator ([1092db9](https://github.com/Isqanderm/ioc/commit/1092db9886d9c358ffe0bce685321729644d1692)), closes [#32](https://github.com/Isqanderm/ioc/issues/32)
- **ioc:** add resolve circular dependency ([3c2df88](https://github.com/Isqanderm/ioc/commit/3c2df885b584eb1f4446985f2857574e8dbcd2f3)), closes [#12](https://github.com/Isqanderm/ioc/issues/12)
- **ioc:** collect compile container errors ([f018f0d](https://github.com/Isqanderm/ioc/commit/f018f0d1d4da5c3cee9ed76d58efe03c5dfdc385))
- Resolve circular dependency, add CI/CD, and comprehensive testing ([#47](https://github.com/Isqanderm/ioc/issues/47)) ([da45982](https://github.com/Isqanderm/ioc/commit/da45982d1be52488b10fc75b68c96d69817ccec4))
- **testing:** move testing helpers to new package ([4cd98d1](https://github.com/Isqanderm/ioc/commit/4cd98d11cc9e707b64d31618bd0c078d8c4b8a8a))

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.1.14](https://github.com/Isqanderm/ioc/compare/v0.1.13...v0.1.14) (2024-07-17)

### [0.1.13](https://github.com/Isqanderm/ioc/compare/v0.1.11...v0.1.13) (2024-07-16)

### [0.1.12](https://github.com/Isqanderm/ioc/compare/v0.1.11...v0.1.12) (2024-07-16)

### [0.1.11](https://github.com/Isqanderm/ioc/compare/v0.1.10...v0.1.11) (2024-07-16)

### [0.1.10](https://github.com/Isqanderm/ioc/compare/v0.1.9...v0.1.10) (2024-07-16)

### Features

- **graph-visualizer:** add graph-visualizer package ([69bb005](https://github.com/Isqanderm/ioc/commit/69bb00585c395d7766675d1a4620320efed14736))
- **graph:** add container inheritance ([e5c0571](https://github.com/Isqanderm/ioc/commit/e5c05711f301314ec545881a6356db7c9f0de612)), closes [#21](https://github.com/Isqanderm/ioc/issues/21)

### [0.1.9](https://github.com/Isqanderm/ioc/compare/v0.1.8...v0.1.9) (2024-07-07)

### Features

- **graph:** add new graph hooks and api for container ([a082f3e](https://github.com/Isqanderm/ioc/commit/a082f3e48450995cdd8f4761e8a0e6a7330b05b1))

### [0.1.8](https://github.com/Isqanderm/ioc/compare/v0.1.7...v0.1.8) (2024-07-03)

### [0.1.7](https://github.com/Isqanderm/ioc/compare/v0.1.6...v0.1.7) (2024-07-02)

### Features

- **container:** add forRoot/forRootAsync ([533c1c4](https://github.com/Isqanderm/ioc/commit/533c1c4a6bc99a611584574e5b4717416f86af0f))

### [0.1.6](https://github.com/Isqanderm/ioc/compare/v0.1.5...v0.1.6) (2024-07-02)

### Features

- **container:** add forFeature/forFeatureAsync ([427d2df](https://github.com/Isqanderm/ioc/commit/427d2dfaa1792746c68c6909ecec35a5805024ae))

### [0.1.5](https://github.com/Isqanderm/ioc/compare/v0.1.4...v0.1.5) (2024-07-01)

### [0.1.4](https://github.com/Isqanderm/ioc/compare/v0.1.3...v0.1.4) (2024-06-30)

### 0.1.3 (2024-06-30)

### Features

- **application:** create first version of app ([086e0ff](https://github.com/Isqanderm/ioc/commit/086e0ff1fad889c253b7bf25e134f0048976c1eb))

### 0.1.2 (2024-06-30)

### Features

- **application:** create first version of app ([086e0ff](https://github.com/Isqanderm/ioc/commit/086e0ff1fad889c253b7bf25e134f0048976c1eb))

### 0.1.1 (2024-06-30)

### Features

- **application:** create first version of app ([086e0ff](https://github.com/Isqanderm/ioc/commit/086e0ff1fad889c253b7bf25e134f0048976c1eb))
