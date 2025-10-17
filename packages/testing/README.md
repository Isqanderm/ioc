# @nexus-ioc/testing

[![npm version](https://img.shields.io/npm/v/@nexus-ioc/testing.svg)](https://www.npmjs.com/package/@nexus-ioc/testing)
[![npm downloads](https://img.shields.io/npm/dm/@nexus-ioc/testing.svg)](https://www.npmjs.com/package/@nexus-ioc/testing)
[![npm downloads](https://img.shields.io/npm/dt/@nexus-ioc/testing.svg)](https://www.npmjs.com/package/@nexus-ioc/testing)
[![License: MIT](https://img.shields.io/npm/l/@nexus-ioc/testing.svg)](https://github.com/Isqanderm/ioc/blob/main/LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@nexus-ioc/testing)](https://bundlephobia.com/package/@nexus-ioc/testing)
[![CI](https://github.com/Isqanderm/ioc/actions/workflows/ci.yml/badge.svg)](https://github.com/Isqanderm/ioc/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Isqanderm/ioc/branch/main/graph/badge.svg)](https://codecov.io/gh/Isqanderm/ioc)
[![Dependencies](https://img.shields.io/librariesio/release/npm/@nexus-ioc/testing)](https://libraries.io/npm/@nexus-ioc%2Ftesting)
[![GitHub stars](https://img.shields.io/github/stars/Isqanderm/ioc.svg?style=social&label=Star)](https://github.com/Isqanderm/ioc)
[![GitHub issues](https://img.shields.io/github/issues/Isqanderm/ioc.svg)](https://github.com/Isqanderm/ioc/issues)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Isqanderm/ioc/blob/main/CONTRIBUTING.md)

> Test library for Nexus IoC

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [License](#license)
- [Author](#author)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)
- [Wiki](#wiki)

## Installation

```bash
npm install @nexus-ioc/core @nexus-ioc/testing
```

## Quick Start

```typescript
import { Injectable } from '@nexus-ioc/core';
import { Test } from '@nexus-ioc/testing';

describe('AppModule', () => {
  it('should create instance', async () => {
    @Injectable()
    class AppService {}

    const appModule = await Test.createModule({
      providers: [AppService],
    }).compile();

    const appService = await appModule.get<AppService>(AppService);
    expect(appService).toBeInstanceOf(AppService);
  });
});
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
